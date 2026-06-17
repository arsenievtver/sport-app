from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_invite_code,
    hash_pin,
    verify_pin,
)
from app.models.enums import UserRole
from app.models.user import AthleteProfile, CoachProfile, User
from app.schemas.athlete import JoinCoachRequest
from app.schemas.auth import (
    AthleteProfileResponse,
    CoachProfileResponse,
    InvitePreviewResponse,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services.athlete import AthleteService


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_user_by_phone(self, phone: str) -> User | None:
        result = await self.db.execute(
            select(User)
            .where(User.phone == phone)
            .options(
                selectinload(User.coach_profile),
                selectinload(User.athlete_profile),
            )
        )
        return result.scalar_one_or_none()

    async def register(self, data: RegisterRequest) -> User:
        existing = await self._get_user_by_phone(data.phone)
        if existing and existing.roles:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Этот телефон уже зарегистрирован. Войдите или попросите администратора добавить роль.",
            )

        if existing:
            user, _ = await self.grant_roles(
                phone=data.phone,
                roles=[data.role],
                display_name=data.display_name,
                pin=data.pin,
                update_pin=True,
            )
            user.is_active = True
            return user

        user = User(
            phone=data.phone,
            password_hash=hash_pin(data.pin),
            roles=[data.role],
        )
        self.db.add(user)
        await self.db.flush()

        if data.role == UserRole.coach:
            profile = CoachProfile(
                user_id=user.id,
                display_name=data.display_name,
                invite_code=await self._unique_invite_code(),
            )
            self.db.add(profile)
        elif data.role == UserRole.athlete:
            if data.claim_athlete_id is not None:
                if not data.invite_code:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Для привязки к существующему профилю нужен код приглашения",
                    )
                profile = await self._claim_managed_athlete(
                    user=user,
                    claim_athlete_id=data.claim_athlete_id,
                    invite_code=data.invite_code,
                    display_name=data.display_name,
                )
            else:
                profile = AthleteProfile(
                    user_id=user.id,
                    display_name=data.display_name,
                )
                self.db.add(profile)
                await self.db.flush()
                if data.invite_code:
                    athlete_service = AthleteService(self.db)
                    await athlete_service.join_coach(profile, JoinCoachRequest(invite_code=data.invite_code))

        await self.db.flush()
        await self.db.refresh(user, attribute_names=["coach_profile", "athlete_profile"])
        return user

    async def grant_roles(
        self,
        phone: str,
        roles: list[UserRole],
        display_name: str,
        pin: str | None = None,
        *,
        update_pin: bool = False,
    ) -> tuple[User, list[UserRole]]:
        """Add roles to an existing user (by phone) or create a new one.

        Phone is the single identity key — one person, one User, many roles.
        Returns the user and the list of roles that were newly granted.
        """
        if not roles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не указаны роли для выдачи")

        unique_roles: list[UserRole] = []
        for role in roles:
            if role not in unique_roles:
                unique_roles.append(role)

        user = await self._get_user_by_phone(phone)
        added: list[UserRole] = []

        if user is None:
            if pin is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Для создания нового пользователя нужен PIN",
                )
            user = User(phone=phone, password_hash=hash_pin(pin), roles=list(unique_roles))
            self.db.add(user)
            await self.db.flush()
            added = list(unique_roles)
        else:
            current_roles = list(user.roles or [])
            for role in unique_roles:
                if role not in current_roles:
                    added.append(role)
            if added:
                user.roles = [*current_roles, *added]
            if update_pin and pin is not None:
                user.password_hash = hash_pin(pin)

        await self._ensure_profiles(user, display_name, unique_roles)
        await self.db.flush()
        await self.db.refresh(user, attribute_names=["coach_profile", "athlete_profile"])
        return user, added

    async def _ensure_profiles(self, user: User, display_name: str, roles: list[UserRole]) -> None:
        if UserRole.coach in roles and user.coach_profile is None:
            self.db.add(
                CoachProfile(
                    user_id=user.id,
                    display_name=display_name,
                    invite_code=await self._unique_invite_code(),
                )
            )
        if UserRole.athlete in roles and user.athlete_profile is None:
            self.db.add(
                AthleteProfile(
                    user_id=user.id,
                    display_name=display_name,
                )
            )

    async def login(self, phone: str, pin: str) -> User:
        user = await self._get_user_by_phone(phone)
        if user is None or not verify_pin(pin, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный телефон или PIN")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт отключён")

        user.last_login_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(user, attribute_names=["coach_profile", "athlete_profile"])
        return user

    async def refresh(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != TOKEN_TYPE_REFRESH:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный refresh-токен")
            user_id = UUID(payload["sub"])
        except (JWTError, ValueError, KeyError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный или просроченный refresh-токен",
            ) from exc

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден или отключён")

        return self.issue_tokens(user.id)

    @staticmethod
    def issue_tokens(user_id: UUID) -> TokenResponse:
        return TokenResponse(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
            expires_in=settings.access_token_expire_minutes * 60,
        )

    async def invite_preview(self, invite_code: str, claim_athlete_id: UUID | None = None) -> InvitePreviewResponse:
        code = invite_code.strip().upper()
        if not code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Введите код приглашения")

        coach_result = await self.db.execute(select(CoachProfile).where(CoachProfile.invite_code == code))
        coach = coach_result.scalar_one_or_none()
        if coach is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тренер с таким кодом не найден")

        suggested_display_name: str | None = None
        if claim_athlete_id is not None:
            athlete_result = await self.db.execute(
                select(AthleteProfile).where(
                    AthleteProfile.id == claim_athlete_id,
                    AthleteProfile.managed_by_coach_id == coach.id,
                    AthleteProfile.user_id.is_(None),
                )
            )
            athlete = athlete_result.scalar_one_or_none()
            if athlete is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Приглашение недействительно или уже использовано",
                )
            suggested_display_name = athlete.display_name

        return InvitePreviewResponse(
            coach_name=coach.display_name,
            invite_code=coach.invite_code,
            suggested_display_name=suggested_display_name,
        )

    async def _claim_managed_athlete(
        self,
        *,
        user: User,
        claim_athlete_id: UUID,
        invite_code: str,
        display_name: str,
    ) -> AthleteProfile:
        code = invite_code.strip().upper()
        coach_result = await self.db.execute(select(CoachProfile).where(CoachProfile.invite_code == code))
        coach = coach_result.scalar_one_or_none()
        if coach is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тренер с таким кодом не найден")

        result = await self.db.execute(
            select(AthleteProfile).where(
                AthleteProfile.id == claim_athlete_id,
                AthleteProfile.user_id.is_(None),
                AthleteProfile.managed_by_coach_id == coach.id,
            )
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Профиль для привязки не найден или уже занят",
            )

        profile.user_id = user.id
        profile.claimed_at = datetime.now(UTC)
        name = display_name.strip()
        if name:
            profile.display_name = name
        await self.db.flush()
        return profile

    async def _unique_invite_code(self) -> str:
        for _ in range(10):
            code = generate_invite_code()
            existing = await self.db.execute(select(CoachProfile).where(CoachProfile.invite_code == code))
            if existing.scalar_one_or_none() is None:
                return code
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сгенерировать код приглашения")


def user_to_response(user: User) -> UserResponse:
    coach_profile: CoachProfileResponse | None = None
    athlete_profile: AthleteProfileResponse | None = None

    if user.coach_profile:
        coach_profile = CoachProfileResponse(
            display_name=user.coach_profile.display_name,
            avatar_url=user.coach_profile.avatar_url,
            invite_code=user.coach_profile.invite_code,
            is_verified=user.coach_profile.is_verified,
        )
    if user.athlete_profile:
        athlete_profile = AthleteProfileResponse.model_validate(user.athlete_profile)

    return UserResponse(
        id=user.id,
        phone=user.phone,
        roles=list(user.roles),
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        coach_profile=coach_profile,
        athlete_profile=athlete_profile,
    )

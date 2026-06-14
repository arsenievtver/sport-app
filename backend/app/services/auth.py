from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.schemas.auth import (
    AthleteProfileResponse,
    CoachProfileResponse,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> User:
        existing = await self.db.execute(select(User).where(User.phone == data.phone))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone already registered. Log in or ask admin to add a role to your account.",
            )

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
            profile = AthleteProfile(
                user_id=user.id,
                display_name=data.display_name,
            )
            self.db.add(profile)

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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No roles to grant")

        unique_roles: list[UserRole] = []
        for role in roles:
            if role not in unique_roles:
                unique_roles.append(role)

        result = await self.db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
        added: list[UserRole] = []

        if user is None:
            if pin is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="PIN required to create a new user",
                )
            user = User(phone=phone, password_hash=hash_pin(pin), roles=list(unique_roles))
            self.db.add(user)
            await self.db.flush()
            added = list(unique_roles)
        else:
            for role in unique_roles:
                if role not in user.roles:
                    added.append(role)
            if added:
                user.roles = [*user.roles, *added]
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
        result = await self.db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
        if user is None or not verify_pin(pin, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid phone or pin")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

        user.last_login_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(user, attribute_names=["coach_profile", "athlete_profile"])
        return user

    async def refresh(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != TOKEN_TYPE_REFRESH:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
            user_id = UUID(payload["sub"])
        except (JWTError, ValueError, KeyError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            ) from exc

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

        return self.issue_tokens(user.id)

    @staticmethod
    def issue_tokens(user_id: UUID) -> TokenResponse:
        return TokenResponse(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
            expires_in=settings.access_token_expire_minutes * 60,
        )

    async def _unique_invite_code(self) -> str:
        for _ in range(10):
            code = generate_invite_code()
            existing = await self.db.execute(select(CoachProfile).where(CoachProfile.invite_code == code))
            if existing.scalar_one_or_none() is None:
                return code
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate invite code")


def user_to_response(user: User) -> UserResponse:
    coach_profile: CoachProfileResponse | None = None
    athlete_profile: AthleteProfileResponse | None = None

    if user.coach_profile:
        coach_profile = CoachProfileResponse(
            display_name=user.coach_profile.display_name,
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

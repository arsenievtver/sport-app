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
from app.schemas.auth import RegisterRequest, TokenResponse, UserProfileResponse, UserResponse


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> User:
        existing = await self.db.execute(select(User).where(User.phone == data.phone))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone already registered")

        user = User(
            phone=data.phone,
            password_hash=hash_pin(data.pin),
            role=data.role,
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
        else:
            profile = AthleteProfile(
                user_id=user.id,
                display_name=data.display_name,
            )
            self.db.add(profile)

        await self.db.flush()
        await self.db.refresh(user, attribute_names=["coach_profile", "athlete_profile"])
        return user

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
    profile: UserProfileResponse | None = None
    if user.role == UserRole.coach and user.coach_profile:
        profile = UserProfileResponse(
            display_name=user.coach_profile.display_name,
            invite_code=user.coach_profile.invite_code,
            is_verified=user.coach_profile.is_verified,
        )
    elif user.role == UserRole.athlete and user.athlete_profile:
        profile = UserProfileResponse(
            display_name=user.athlete_profile.display_name,
            timezone=user.athlete_profile.timezone,
        )

    return UserResponse(
        id=user.id,
        phone=user.phone,
        role=user.role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        profile=profile,
    )

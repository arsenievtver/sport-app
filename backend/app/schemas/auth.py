from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.core.security import validate_phone, validate_pin
from app.models.enums import UserRole
from app.schemas.athlete import AthleteProfileResponse

PHONE_EXAMPLE = "79106492742"
PIN_EXAMPLE = "123456"


class PhonePinLogin(BaseModel):
    phone: str = Field(examples=[PHONE_EXAMPLE])
    pin: str = Field(examples=[PIN_EXAMPLE])

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        return validate_phone(value)

    @field_validator("pin")
    @classmethod
    def check_pin(cls, value: str) -> str:
        return validate_pin(value)


class RegisterRequest(PhonePinLogin):
    role: UserRole = Field(examples=[UserRole.athlete])
    display_name: str = Field(min_length=1, max_length=120, examples=["Иван"])

    @field_validator("role")
    @classmethod
    def check_register_role(cls, value: UserRole) -> UserRole:
        if value == UserRole.admin:
            raise ValueError("Аккаунты администратора нельзя регистрировать через API")
        return value


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class CoachProfileResponse(BaseModel):
    display_name: str
    avatar_url: str | None = None
    invite_code: str
    is_verified: bool

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: UUID
    phone: str
    roles: list[UserRole]
    is_active: bool
    last_login_at: datetime | None
    coach_profile: CoachProfileResponse | None = None
    athlete_profile: AthleteProfileResponse | None = None

    model_config = {"from_attributes": True}

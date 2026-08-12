from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class AdminPushDayStat(BaseModel):
    date: str
    subscription_count: int


class AdminPushStatsResponse(BaseModel):
    vapid_configured: bool
    subscription_count: int
    user_count: int
    pending_scheduled_count: int
    by_day: list[AdminPushDayStat] = Field(default_factory=list)


class AdminPushSendRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=2000)
    url: str | None = Field(default="/", max_length=512)

    @field_validator("title", "body")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Поле не может быть пустым")
        return cleaned


class AdminPushSendResponse(BaseModel):
    users_targeted: int
    users_sent: int
    devices_sent: int


class AdminScheduledPushCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=2000)
    send_at: datetime
    url: str | None = Field(default="/", max_length=512)

    @field_validator("title", "body")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Поле не может быть пустым")
        return cleaned


class AdminScheduledPushResponse(BaseModel):
    id: UUID
    title: str
    body: str
    url: str | None = None
    send_at: datetime
    status: str
    created_at: datetime
    sent_at: datetime | None = None
    error: str | None = None
    users_sent: int = 0
    devices_sent: int = 0

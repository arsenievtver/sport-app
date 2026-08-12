from pydantic import BaseModel, Field


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=255)


class PushSubscriptionCreateRequest(BaseModel):
    endpoint: str = Field(min_length=8, max_length=2048)
    keys: PushSubscriptionKeys
    user_agent: str | None = Field(default=None, max_length=512)


class PushSubscriptionDeleteRequest(BaseModel):
    endpoint: str = Field(min_length=8, max_length=2048)


class PushSubscriptionStatusResponse(BaseModel):
    enabled: bool

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class WhoopConnectResponse(BaseModel):
    authorization_url: str


class WhoopStatusResponse(BaseModel):
    connected: bool
    provider: str
    external_user_id: str | None = None
    connected_at: datetime | None = None
    last_sync_at: datetime | None = None
    last_sync_error: str | None = None
    last_sync: dict[str, Any] | None = None


class WhoopSyncResponse(BaseModel):
    synced_at: str
    profile: dict[str, Any]
    body_measurement: dict[str, Any]
    recovery: dict[str, Any]
    sleep: dict[str, Any]
    workouts: dict[str, Any]
    cycles: dict[str, Any]

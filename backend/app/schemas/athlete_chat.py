from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


MAX_CHAT_MESSAGE_LENGTH = 2000
MAX_CHAT_MESSAGES_PER_THREAD = 100
MAX_CHAT_HISTORY_FOR_LLM = 40


class AthleteAiChatThreadCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class AthleteAiChatMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_CHAT_MESSAGE_LENGTH)


class AthleteAiChatThreadResponse(BaseModel):
    id: UUID
    title: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AthleteAiChatMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AthleteAiChatSendResponse(BaseModel):
    user_message: AthleteAiChatMessageResponse
    assistant_message: AthleteAiChatMessageResponse

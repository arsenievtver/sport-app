from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import AthleteUser
from app.schemas.athlete_chat import (
    AthleteAiChatMessageCreateRequest,
    AthleteAiChatMessageResponse,
    AthleteAiChatSendResponse,
    AthleteAiChatThreadCreateRequest,
    AthleteAiChatThreadResponse,
)
from app.services.athlete_chat import AthleteChatService

router = APIRouter(prefix="/athlete/chat", tags=["athlete-chat"])


def _require_profile(user: AthleteUser):
    from fastapi import HTTPException

    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")
    return user.athlete_profile


@router.get("/threads", response_model=list[AthleteAiChatThreadResponse])
async def list_chat_threads(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AthleteAiChatThreadResponse]:
    profile = _require_profile(user)
    return await AthleteChatService(db).list_threads(profile)


@router.post(
    "/threads",
    response_model=AthleteAiChatThreadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_chat_thread(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    data: AthleteAiChatThreadCreateRequest | None = None,
) -> AthleteAiChatThreadResponse:
    profile = _require_profile(user)
    return await AthleteChatService(db).create_thread(
        profile, data or AthleteAiChatThreadCreateRequest()
    )


@router.get("/threads/{thread_id}/messages", response_model=list[AthleteAiChatMessageResponse])
async def list_chat_messages(
    thread_id: UUID,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AthleteAiChatMessageResponse]:
    profile = _require_profile(user)
    return await AthleteChatService(db).list_messages(profile, thread_id)


@router.post(
    "/threads/{thread_id}/messages",
    response_model=AthleteAiChatSendResponse,
)
async def send_chat_message(
    thread_id: UUID,
    data: AthleteAiChatMessageCreateRequest,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteAiChatSendResponse:
    profile = _require_profile(user)
    return await AthleteChatService(db).send_message(profile, thread_id, data)

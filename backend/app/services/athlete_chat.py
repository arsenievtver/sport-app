"""Persistence and orchestration for athlete AI chat."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.athlete_ai_chat import AthleteAiChatMessage, AthleteAiChatThread
from app.models.enums import AiChatMessageRole
from app.models.user import AthleteProfile
from app.schemas.athlete_chat import (
    MAX_CHAT_HISTORY_FOR_LLM,
    MAX_CHAT_MESSAGES_PER_THREAD,
    AthleteAiChatMessageCreateRequest,
    AthleteAiChatMessageResponse,
    AthleteAiChatSendResponse,
    AthleteAiChatThreadCreateRequest,
    AthleteAiChatThreadResponse,
)
from app.services.athlete_chat_agent import AthleteChatAgent, AthleteChatAgentError
from app.services.athlete_chat_tools import build_athlete_tool_registry
from app.services.llm_chat import LlmMessage


class AthleteChatService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_threads(self, profile: AthleteProfile) -> list[AthleteAiChatThreadResponse]:
        result = await self.db.execute(
            select(AthleteAiChatThread)
            .where(AthleteAiChatThread.athlete_id == profile.id)
            .order_by(AthleteAiChatThread.updated_at.desc())
        )
        threads = result.scalars().all()
        return [AthleteAiChatThreadResponse.model_validate(t) for t in threads]

    async def create_thread(
        self,
        profile: AthleteProfile,
        data: AthleteAiChatThreadCreateRequest | None = None,
    ) -> AthleteAiChatThreadResponse:
        title = None
        if data and data.title:
            title = data.title.strip() or None
        thread = AthleteAiChatThread(athlete_id=profile.id, title=title)
        self.db.add(thread)
        await self.db.commit()
        await self.db.refresh(thread)
        return AthleteAiChatThreadResponse.model_validate(thread)

    async def get_thread_or_404(
        self, profile: AthleteProfile, thread_id: UUID
    ) -> AthleteAiChatThread:
        result = await self.db.execute(
            select(AthleteAiChatThread).where(
                AthleteAiChatThread.id == thread_id,
                AthleteAiChatThread.athlete_id == profile.id,
            )
        )
        thread = result.scalar_one_or_none()
        if thread is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Диалог не найден")
        return thread

    async def list_messages(
        self, profile: AthleteProfile, thread_id: UUID
    ) -> list[AthleteAiChatMessageResponse]:
        await self.get_thread_or_404(profile, thread_id)
        result = await self.db.execute(
            select(AthleteAiChatMessage)
            .where(
                AthleteAiChatMessage.thread_id == thread_id,
                AthleteAiChatMessage.role.in_(
                    [AiChatMessageRole.user, AiChatMessageRole.assistant]
                ),
            )
            .order_by(AthleteAiChatMessage.created_at.asc())
        )
        messages = result.scalars().all()
        return [
            AthleteAiChatMessageResponse(
                id=m.id,
                role=m.role.value if hasattr(m.role, "value") else str(m.role),
                content=m.content,
                created_at=m.created_at,
            )
            for m in messages
        ]

    async def send_message(
        self,
        profile: AthleteProfile,
        thread_id: UUID,
        data: AthleteAiChatMessageCreateRequest,
    ) -> AthleteAiChatSendResponse:
        thread = await self.get_thread_or_404(profile, thread_id)
        content = data.content.strip()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Сообщение не может быть пустым",
            )

        count_result = await self.db.execute(
            select(func.count())
            .select_from(AthleteAiChatMessage)
            .where(
                AthleteAiChatMessage.thread_id == thread.id,
                AthleteAiChatMessage.role.in_(
                    [AiChatMessageRole.user, AiChatMessageRole.assistant]
                ),
            )
        )
        message_count = int(count_result.scalar_one())
        if message_count >= MAX_CHAT_MESSAGES_PER_THREAD:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="В этом диалоге слишком много сообщений — создайте новый",
            )

        user_msg = AthleteAiChatMessage(
            thread_id=thread.id,
            role=AiChatMessageRole.user,
            content=content,
        )
        self.db.add(user_msg)
        if thread.title is None:
            thread.title = content[:80]
        await self.db.flush()
        await self.db.refresh(user_msg)

        history = await self._load_llm_history(thread.id)
        registry = build_athlete_tool_registry(self.db)
        agent = AthleteChatAgent(registry)
        try:
            answer = await agent.run(profile, history)
        except AthleteChatAgentError as exc:
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc

        assistant_msg = AthleteAiChatMessage(
            thread_id=thread.id,
            role=AiChatMessageRole.assistant,
            content=answer,
        )
        self.db.add(assistant_msg)
        await self.db.commit()
        await self.db.refresh(assistant_msg)

        return AthleteAiChatSendResponse(
            user_message=AthleteAiChatMessageResponse(
                id=user_msg.id,
                role="user",
                content=user_msg.content,
                created_at=user_msg.created_at,
            ),
            assistant_message=AthleteAiChatMessageResponse(
                id=assistant_msg.id,
                role="assistant",
                content=assistant_msg.content,
                created_at=assistant_msg.created_at,
            ),
        )

    async def _load_llm_history(self, thread_id: UUID) -> list[LlmMessage]:
        result = await self.db.execute(
            select(AthleteAiChatMessage)
            .where(
                AthleteAiChatMessage.thread_id == thread_id,
                AthleteAiChatMessage.role.in_(
                    [AiChatMessageRole.user, AiChatMessageRole.assistant]
                ),
            )
            .order_by(AthleteAiChatMessage.created_at.asc())
        )
        messages = list(result.scalars().all())
        if len(messages) > MAX_CHAT_HISTORY_FOR_LLM:
            messages = messages[-MAX_CHAT_HISTORY_FOR_LLM:]
        return [
            LlmMessage(
                role=m.role.value if hasattr(m.role, "value") else str(m.role),
                content=m.content,
            )
            for m in messages
        ]

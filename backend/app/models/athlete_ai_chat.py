import uuid

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import AiChatMessageRole

ai_chat_message_role_enum = SQLEnum(
    AiChatMessageRole,
    name="aichatmessagerole",
    create_constraint=False,
    native_enum=False,
)


class AthleteAiChatThread(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Диалог спортсмена с AI-ассистентом."""

    __tablename__ = "athlete_ai_chat_threads"

    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)

    messages: Mapped[list["AthleteAiChatMessage"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="AthleteAiChatMessage.created_at",
    )


class AthleteAiChatMessage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "athlete_ai_chat_messages"

    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("athlete_ai_chat_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[AiChatMessageRole] = mapped_column(
        ai_chat_message_role_enum,
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tool_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tool_call_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tool_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    thread: Mapped["AthleteAiChatThread"] = relationship(back_populates="messages")

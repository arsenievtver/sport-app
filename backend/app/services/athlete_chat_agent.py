"""Athlete AI chat agent: LLM ↔ tools loop."""

from __future__ import annotations

import logging
from typing import Protocol

from app.models.user import AthleteProfile
from app.services.athlete_chat_tools import AthleteToolRegistry
from app.services.llm_chat import LlmChatResult, LlmMessage, LlmToolSpec
from app.services.yandex_foundation import YandexFoundationClient, YandexFoundationError

logger = logging.getLogger(__name__)

DEFAULT_MAX_TOOL_ITERATIONS = 4

ATHLETE_CHAT_SYSTEM_PROMPT = (
    "You are a sports assistant for one authenticated athlete. "
    "Use tools for any facts about plan, workouts, weight, meals, schedule, WHOOP. "
    "Never invent numbers or dates. If a tool says data is missing, say so. "
    "Reply in Russian, briefly and clearly. "
    "Do not give medical diagnoses or prescriptions."
)


class LlmChatProvider(Protocol):
    def is_configured(self) -> bool: ...

    async def complete_chat(
        self,
        messages: list[LlmMessage],
        tools: list[LlmToolSpec] | None = None,
        *,
        temperature: float = 0.1,
        max_tokens: int = 1500,
    ) -> LlmChatResult: ...


class AthleteChatAgentError(RuntimeError):
    pass


class AthleteChatAgent:
    def __init__(
        self,
        registry: AthleteToolRegistry,
        llm: LlmChatProvider | None = None,
        *,
        max_tool_iterations: int = DEFAULT_MAX_TOOL_ITERATIONS,
        system_prompt: str = ATHLETE_CHAT_SYSTEM_PROMPT,
    ) -> None:
        self.registry = registry
        self.llm = llm or YandexFoundationClient()
        self.max_tool_iterations = max_tool_iterations
        self.system_prompt = system_prompt

    async def run(
        self,
        profile: AthleteProfile,
        history: list[LlmMessage],
    ) -> str:
        if not self.llm.is_configured():
            raise AthleteChatAgentError(
                "AI не настроен: задайте YANDEX_AI_API_KEY и YANDEX_AI_FOLDER_ID"
            )

        messages: list[LlmMessage] = [
            LlmMessage(role="system", content=self.system_prompt),
            *history,
        ]
        tools = self.registry.specs()

        for _ in range(self.max_tool_iterations):
            try:
                result = await self.llm.complete_chat(messages, tools)
            except YandexFoundationError as exc:
                raise AthleteChatAgentError(str(exc)) from exc

            if result.tool_calls:
                messages.append(
                    LlmMessage(
                        role="assistant",
                        content=result.content or "",
                        tool_calls=result.tool_calls,
                    )
                )
                for call in result.tool_calls:
                    tool_result = await self.registry.call(call.name, profile, call.arguments)
                    messages.append(
                        LlmMessage(
                            role="tool",
                            content=tool_result,
                            tool_call_id=call.id,
                            name=call.name,
                        )
                    )
                continue

            answer = (result.content or "").strip()
            if answer:
                return answer
            raise AthleteChatAgentError("Пустой ответ ассистента")

        # Final turn without tools to force an answer
        try:
            result = await self.llm.complete_chat(messages, tools=[])
        except YandexFoundationError as exc:
            raise AthleteChatAgentError(str(exc)) from exc
        answer = (result.content or "").strip()
        if not answer:
            raise AthleteChatAgentError("Ассистент не завершил ответ после вызова инструментов")
        return answer

"""Athlete AI chat agent: LLM ↔ tools loop."""

from __future__ import annotations

import logging
from typing import Protocol

from app.models.user import AthleteProfile
from app.services.athlete_chat_tools import AthleteToolRegistry
from app.services.llm_chat import LlmChatResult, LlmMessage, LlmToolSpec
from app.services.yandex_foundation import (
    YandexFoundationClient,
    YandexFoundationError,
    _parse_tool_protocol_text,
)

logger = logging.getLogger(__name__)

DEFAULT_MAX_TOOL_ITERATIONS = 5

ATHLETE_CHAT_SYSTEM_PROMPT = (
    "You are a sports assistant for one authenticated athlete. "
    "For any facts about plan, workouts, weight, meals, schedule, WHOOP — call tools first. "
    "Never invent numbers or dates. Never say you will fetch data later — call the tool now. "
    "Never narrate tool usage; only JSON tool_calls or a final answer. "
    "Reply to the athlete in Russian, briefly and clearly. "
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
        known_tool_names: set[str] | None = None,
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
        known_names = {t.name for t in tools}

        for _ in range(self.max_tool_iterations):
            try:
                result = await self.llm.complete_chat(
                    messages,
                    tools,
                    known_tool_names=known_names,
                )
            except YandexFoundationError as exc:
                raise AthleteChatAgentError(str(exc)) from exc

            result = self._coerce_tool_calls(result, known_names)

            if result.tool_calls:
                messages.append(
                    LlmMessage(
                        role="assistant",
                        content="",
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
            if answer and not _looks_like_pending_tool_narration(answer, known_names):
                return answer
            if answer:
                # Model stalled on "please wait" — nudge it to call tools as JSON.
                messages.append(LlmMessage(role="assistant", content=answer))
                messages.append(
                    LlmMessage(
                        role="user",
                        content=(
                            'Do not wait. Reply with JSON tool_calls now, e.g. '
                            '{"tool_calls":[{"name":"get_session_history","arguments":{"days":30}}]}'
                        ),
                    )
                )
                continue
            raise AthleteChatAgentError("Пустой ответ ассистента")

        try:
            result = await self.llm.complete_chat(
                messages,
                tools=[],
                known_tool_names=known_names,
            )
        except YandexFoundationError as exc:
            raise AthleteChatAgentError(str(exc)) from exc
        answer = (result.content or "").strip()
        if not answer:
            raise AthleteChatAgentError("Ассистент не завершил ответ после вызова инструментов")
        return answer

    def _coerce_tool_calls(
        self, result: LlmChatResult, known_names: set[str]
    ) -> LlmChatResult:
        if result.tool_calls:
            return result
        if not result.content:
            return result
        parsed = _parse_tool_protocol_text(result.content, known_tools=known_names)
        if parsed.tool_calls:
            return parsed
        return result


def _looks_like_pending_tool_narration(text: str, known_names: set[str]) -> bool:
    lower = text.lower()
    waiting = any(
        marker in lower
        for marker in (
            "подожд",
            "загружа",
            "получен",
            "сейчас запрошу",
            "нужно получить",
            "использование функции",
            "идёт получение",
            "идет получение",
        )
    )
    if not waiting:
        return False
    return any(name in text for name in known_names) or "функц" in lower

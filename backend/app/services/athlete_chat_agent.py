"""Athlete AI chat agent: LLM ↔ tools loop."""

from __future__ import annotations

import logging
from typing import Protocol

from app.models.user import AthleteProfile
from app.services.athlete_chat_tools import AthleteToolRegistry
from app.services.llm_chat import LlmChatResult, LlmMessage, LlmToolCall, LlmToolSpec
from app.services.yandex_foundation import (
    YandexFoundationClient,
    YandexFoundationError,
    _parse_tool_protocol_text,
)

logger = logging.getLogger(__name__)

DEFAULT_MAX_TOOL_ITERATIONS = 5

# Always loaded so answers can compare actuals vs goals/plan.
BASELINE_TOOL_NAMES = (
    "get_profile",
    "get_plan",
    "get_week_progress",
    "get_weight_dynamics",
    "get_sessions_stats",
)

ATHLETE_CHAT_SYSTEM_PROMPT = (
    "You are a professional sports coach assistant for one athlete. "
    "Use only CONTEXT and tool results; never invent numbers or dates. "
    "Never ask the athlete to use tools, fetch stats, or 'выполнить запрос' — you call tools yourself. "
    "Every answer must: (1) use their goals/plan (workouts/week, activity, calories, weight targets, personal goal), "
    "(2) compare current data to those targets, (3) give a clear conclusion to THEIR question, "
    "(4) add 1-2 concrete next steps. "
    "Tone: useful, professional, concise Russian. No medical diagnoses."
)

ANSWER_NUDGE = (
    "CONTEXT with goals/plan is already available. "
    "If you need more facts, reply with JSON tool_calls. "
    "Otherwise reply with JSON {\"answer\":\"...\"}: answer the athlete question, "
    "compare to goals/desired load, give a conclusion and 1-2 next steps. "
    "Never tell the user to use tools."
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

        baseline = await self._load_baseline_context(profile)
        messages: list[LlmMessage] = [
            LlmMessage(role="system", content=self.system_prompt),
            LlmMessage(
                role="system",
                content=(
                    "CONTEXT (goals, plan, week progress, weight, session totals) — already loaded:\n"
                    f"{baseline}"
                ),
            ),
            *history,
        ]
        tools = self.registry.specs()
        known_names = {t.name for t in tools}
        tools_already_used = set(BASELINE_TOOL_NAMES) & known_names

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
                    tools_already_used.add(call.name)
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
            if answer and not _needs_tool_retry(answer):
                return answer

            if answer:
                messages.append(LlmMessage(role="assistant", content=answer))
                # Auto-fetch useful extras once if the model stalled on meta-excuse.
                extra = await self._fetch_extra_tools(profile, tools_already_used)
                if extra:
                    for name, payload in extra:
                        tools_already_used.add(name)
                        call = LlmToolCall(id=f"auto-{name}", name=name, arguments={})
                        messages.append(
                            LlmMessage(role="assistant", content="", tool_calls=[call])
                        )
                        messages.append(
                            LlmMessage(
                                role="tool",
                                content=payload,
                                tool_call_id=call.id,
                                name=name,
                            )
                        )
                messages.append(LlmMessage(role="user", content=ANSWER_NUDGE))
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
        if _needs_tool_retry(answer):
            # Last resort: don't return the meta-excuse to the athlete.
            raise AthleteChatAgentError(
                "Не удалось сформировать ответ по данным. Попробуйте переформулировать вопрос."
            )
        return answer

    async def _load_baseline_context(self, profile: AthleteProfile) -> str:
        chunks: list[str] = []
        for name in BASELINE_TOOL_NAMES:
            if self.registry.get(name) is None:
                continue
            payload = await self.registry.call(name, profile, {})
            chunks.append(f"{name}={payload}")
        return "\n".join(chunks) if chunks else "{}"

    async def _fetch_extra_tools(
        self,
        profile: AthleteProfile,
        already: set[str],
    ) -> list[tuple[str, str]]:
        extras = (
            "get_session_history",
            "get_upcoming_schedule",
            "get_meals",
            "get_whoop_summary",
        )
        out: list[tuple[str, str]] = []
        for name in extras:
            if name in already or self.registry.get(name) is None:
                continue
            args: dict = {}
            if name == "get_session_history":
                args = {"days": 30}
            elif name == "get_meals":
                args = {"days": 7}
            elif name == "get_upcoming_schedule":
                args = {"days": 7}
            payload = await self.registry.call(name, profile, args)
            out.append((name, payload))
            # One extra batch is enough to unblock a stuck turn.
            if len(out) >= 2:
                break
        return out

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


def _needs_tool_retry(text: str) -> bool:
    """True when the model stalled instead of answering the athlete."""
    lower = text.lower()
    markers = (
        "используйте инструмент",
        "использовать инструмент",
        "необходимо использовать",
        "необходимо больше данных",
        "нужно больше данных",
        "выполните запрос",
        "пожалуйста, используйте",
        "пожалуйста, выполните",
        "для получения ответа",
        "для получения данных",
        "нужно получить данные",
        "необходимо получить",
        "подожд",
        "загружа",
        "использование функции",
        "идёт получение",
        "идет получение",
        "please use the tool",
        "please fetch",
    )
    return any(marker in lower for marker in markers)

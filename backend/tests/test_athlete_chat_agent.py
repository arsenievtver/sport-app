from types import SimpleNamespace

import pytest

from app.services.athlete_chat_agent import AthleteChatAgent, AthleteChatAgentError
from app.services.athlete_chat_tools import build_stub_registry
from app.services.llm_chat import LlmChatResult, LlmMessage, LlmToolCall
from app.services.yandex_foundation import _parse_tool_protocol_text


class FakeLlm:
    def __init__(self, turns: list[LlmChatResult]) -> None:
        self.turns = list(turns)
        self.calls = 0

    def is_configured(self) -> bool:
        return True

    async def complete_chat(
        self,
        messages,
        tools=None,
        *,
        temperature=0.1,
        max_tokens=1500,
        known_tool_names=None,
    ):
        self.calls += 1
        if not self.turns:
            return LlmChatResult(content="fallback")
        return self.turns.pop(0)


@pytest.mark.asyncio
async def test_agent_calls_tool_then_answers() -> None:
    profile = SimpleNamespace(id="11111111-1111-1111-1111-111111111111", display_name="Алекс")
    llm = FakeLlm(
        [
            LlmChatResult(
                tool_calls=[
                    LlmToolCall(id="1", name="get_profile", arguments={}),
                ]
            ),
            LlmChatResult(content="Тебя зовут Алекс."),
        ]
    )
    agent = AthleteChatAgent(build_stub_registry(), llm=llm)
    answer = await agent.run(profile, [LlmMessage(role="user", content="Как меня зовут?")])
    assert "Алекс" in answer
    assert llm.calls == 2


@pytest.mark.asyncio
async def test_agent_recovers_russian_tool_narration() -> None:
    profile = SimpleNamespace(id="11111111-1111-1111-1111-111111111111", display_name="Алекс")
    llm = FakeLlm(
        [
            LlmChatResult(
                content=(
                    "Для анализа нагрузки мне нужно получить данные.\n"
                    "[Использование функции 'get_profile' с параметром '_unused: x']\n"
                    "Подождите, пожалуйста..."
                )
            ),
            LlmChatResult(content="Тебя зовут Алекс."),
        ]
    )
    agent = AthleteChatAgent(build_stub_registry(), llm=llm)
    answer = await agent.run(profile, [LlmMessage(role="user", content="Как меня зовут?")])
    assert "Алекс" in answer
    assert llm.calls == 2


@pytest.mark.asyncio
async def test_agent_direct_answer_without_tools() -> None:
    profile = SimpleNamespace(display_name="Алекс")
    llm = FakeLlm([LlmChatResult(content="Привет!")])
    agent = AthleteChatAgent(build_stub_registry(), llm=llm)
    answer = await agent.run(profile, [LlmMessage(role="user", content="Привет")])
    assert answer == "Привет!"


@pytest.mark.asyncio
async def test_agent_requires_configured_llm() -> None:
    class Unconfigured:
        def is_configured(self) -> bool:
            return False

        async def complete_chat(self, *args, **kwargs):
            raise AssertionError("should not call")

    agent = AthleteChatAgent(build_stub_registry(), llm=Unconfigured())
    with pytest.raises(AthleteChatAgentError):
        await agent.run(SimpleNamespace(display_name="x"), [LlmMessage(role="user", content="hi")])


def test_parse_tool_protocol_answer() -> None:
    result = _parse_tool_protocol_text('{"answer":"Ок"}')
    assert result.content == "Ок"
    assert result.tool_calls == []


def test_parse_tool_protocol_tool_calls() -> None:
    result = _parse_tool_protocol_text(
        '```json\n{"tool_calls":[{"name":"get_plan","arguments":{}}]}\n```'
    )
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "get_plan"


def test_parse_russian_function_narration() -> None:
    text = (
        "Для анализа нагрузки за последний месяц мне нужно получить данные о ваших тренировках. "
        "[Использование функции 'get_session_history' с параметром 'days: 30'] "
        "Подождите, пожалуйста, идёт получение данных..."
    )
    result = _parse_tool_protocol_text(
        text, known_tools={"get_session_history", "get_plan"}
    )
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "get_session_history"
    assert result.tool_calls[0].arguments.get("days") == 30

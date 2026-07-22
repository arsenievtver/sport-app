from types import SimpleNamespace

import pytest

from app.services.athlete_chat_tools import build_stub_registry
from app.services.yandex_foundation import _parse_tool_protocol_text


EXPECTED_LIVE_TOOLS = {
    "get_profile",
    "get_plan",
    "get_week_progress",
    "get_sessions_stats",
    "get_session_history",
    "get_upcoming_schedule",
    "get_weight_dynamics",
    "get_meals",
    "get_whoop_summary",
}


def test_stub_registry_has_ping_and_profile() -> None:
    registry = build_stub_registry()
    names = {s.name for s in registry.specs()}
    assert names == {"ping", "get_profile"}


@pytest.mark.asyncio
async def test_stub_ping_tool() -> None:
    registry = build_stub_registry()
    profile = SimpleNamespace(display_name="Test", id=None)
    raw = await registry.call("ping", profile, {"message": "hi"})
    assert '"ok": true' in raw or '"ok":true' in raw
    assert "hi" in raw


@pytest.mark.asyncio
async def test_unknown_tool_returns_error_json() -> None:
    registry = build_stub_registry()
    profile = SimpleNamespace(display_name="Test")
    raw = await registry.call("nope", profile, {})
    assert "Unknown tool" in raw


def test_live_tool_names_constant() -> None:
    # Keep expected set in sync with build_athlete_tool_registry registrations.
    assert len(EXPECTED_LIVE_TOOLS) == 9


def test_parse_single_tool_shorthand() -> None:
    result = _parse_tool_protocol_text('{"name":"get_meals","arguments":{"days":3}}')
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "get_meals"
    assert result.tool_calls[0].arguments["days"] == 3

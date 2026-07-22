"""Shared LLM chat types (provider-agnostic)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class LlmToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]


@dataclass
class LlmToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class LlmMessage:
    role: str  # system | user | assistant | tool
    content: str = ""
    tool_calls: list[LlmToolCall] = field(default_factory=list)
    tool_call_id: str | None = None
    name: str | None = None


@dataclass
class LlmChatResult:
    content: str | None = None
    tool_calls: list[LlmToolCall] = field(default_factory=list)

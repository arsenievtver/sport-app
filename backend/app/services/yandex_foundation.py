"""Thin HTTP client for Yandex Foundation Models (embeddings + completion)."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from typing import Any

import httpx

from app.core.config import settings
from app.models.activity_type import ACTIVITY_EMBEDDING_DIM
from app.services.llm_chat import LlmChatResult, LlmMessage, LlmToolCall, LlmToolSpec

logger = logging.getLogger(__name__)

YANDEX_EMBEDDING_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding"
YANDEX_COMPLETION_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
YANDEX_CHAT_COMPLETIONS_URL = "https://llm.api.cloud.yandex.net/v1/chat/completions"


class YandexFoundationError(RuntimeError):
    pass


class YandexFoundationClient:
    def api_key(self) -> str | None:
        return settings.yandex_ai_api_key or settings.yandex_translate_api_key

    def folder_id(self) -> str | None:
        return settings.yandex_ai_folder_id or settings.yandex_translate_folder_id

    def is_configured(self) -> bool:
        return bool(self.api_key() and self.folder_id())

    def _headers(self) -> dict[str, str]:
        key = self.api_key()
        folder = self.folder_id()
        if not key or not folder:
            raise YandexFoundationError(
                "Yandex AI не настроен: задайте YANDEX_AI_API_KEY и YANDEX_AI_FOLDER_ID "
                "(или те же значения в YANDEX_TRANSLATE_*)"
            )
        return {
            "Authorization": f"Api-Key {key}",
            "x-folder-id": folder,
            "Content-Type": "application/json",
        }

    def _model_uri(self, kind: str, name: str) -> str:
        folder = self.folder_id()
        if not folder:
            raise YandexFoundationError("Yandex folder id не задан")
        return f"{kind}://{folder}/{name}"

    async def embed_text(self, text: str, *, for_document: bool) -> list[float]:
        cleaned = text.strip()
        if not cleaned:
            raise YandexFoundationError("Пустой текст для embedding")

        model = (
            settings.yandex_embedding_doc_model
            if for_document
            else settings.yandex_embedding_query_model
        )
        payload = {
            "modelUri": self._model_uri("emb", model),
            "text": cleaned[:8000],
        }
        last_error = ""
        for attempt in range(8):
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    YANDEX_EMBEDDING_URL,
                    headers=self._headers(),
                    json=payload,
                )
            if response.status_code == 429:
                wait_s = min(8.0, 0.4 * (2**attempt))
                last_error = response.text[:300]
                logger.warning(
                    "Yandex embedding 429, retry in %.1fs (attempt %s)",
                    wait_s,
                    attempt + 1,
                )
                await asyncio.sleep(wait_s)
                continue
            if response.status_code >= 400:
                logger.warning(
                    "Yandex embedding error %s: %s",
                    response.status_code,
                    response.text[:500],
                )
                raise YandexFoundationError(
                    f"Yandex embedding HTTP {response.status_code}: {response.text[:300]}"
                )
            data = response.json()
            embedding = data.get("embedding")
            if not isinstance(embedding, list) or not embedding:
                raise YandexFoundationError("Yandex embedding: пустой ответ")
            if len(embedding) != ACTIVITY_EMBEDDING_DIM:
                raise YandexFoundationError(
                    f"Ожидали embedding dim={ACTIVITY_EMBEDDING_DIM}, получили {len(embedding)}"
                )
            return [float(x) for x in embedding]

        raise YandexFoundationError(
            f"Yandex embedding HTTP 429 after retries: {last_error}"
        )

    async def complete(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.1,
        max_tokens: int = 1500,
    ) -> str:
        payload: dict[str, Any] = {
            "modelUri": self._model_uri("gpt", settings.yandex_gpt_model),
            "completionOptions": {
                "stream": False,
                "temperature": temperature,
                "maxTokens": max_tokens,
            },
            "messages": [
                {"role": "system", "text": system},
                {"role": "user", "text": user},
            ],
        }
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                YANDEX_COMPLETION_URL,
                headers=self._headers(),
                json=payload,
            )
        if response.status_code >= 400:
            logger.warning(
                "Yandex completion error %s: %s",
                response.status_code,
                response.text[:500],
            )
            raise YandexFoundationError(
                f"YandexGPT HTTP {response.status_code}: {response.text[:300]}"
            )
        data = response.json()
        try:
            text = data["result"]["alternatives"][0]["message"]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise YandexFoundationError("YandexGPT: неожиданный формат ответа") from exc
        if not isinstance(text, str) or not text.strip():
            raise YandexFoundationError("YandexGPT: пустой ответ")
        return text.strip()

    async def complete_chat(
        self,
        messages: list[LlmMessage],
        tools: list[LlmToolSpec] | None = None,
        *,
        temperature: float = 0.1,
        max_tokens: int = 1500,
        known_tool_names: set[str] | None = None,
    ) -> LlmChatResult:
        """Multi-turn chat with tools via JSON protocol (reliable on YandexGPT-lite)."""
        tools = tools or []
        # Native OpenAI-style tool_calls are flaky on lite: the model narrates
        # "[Использование функции ...]" instead of structured calls. Prefer JSON.
        result = await self._complete_chat_json_protocol(
            messages, tools, temperature=temperature, max_tokens=max_tokens
        )
        if result.tool_calls:
            return result
        if result.content and (known_tool_names or {t.name for t in tools}):
            names = known_tool_names or {t.name for t in tools}
            prose = _parse_tool_protocol_text(result.content, known_tools=names)
            if prose.tool_calls:
                return prose
        return result


    async def _complete_chat_openai(
        self,
        messages: list[LlmMessage],
        tools: list[LlmToolSpec],
        temperature: float,
        max_tokens: int,
    ) -> LlmChatResult:
        payload: dict[str, Any] = {
            "model": self._model_uri("gpt", settings.yandex_gpt_model),
            "messages": [_to_openai_message(m) for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    },
                }
                for t in tools
            ]
            payload["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                YANDEX_CHAT_COMPLETIONS_URL,
                headers=self._headers(),
                json=payload,
            )
        if response.status_code >= 400:
            raise YandexFoundationError(
                f"Yandex chat completions HTTP {response.status_code}: {response.text[:300]}"
            )
        data = response.json()
        try:
            choice = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise YandexFoundationError("Yandex chat: unexpected response") from exc

        content = choice.get("content")
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "") if isinstance(part, dict) else str(part) for part in content
            )
        tool_calls_raw = choice.get("tool_calls") or []
        tool_calls = [_parse_openai_tool_call(tc) for tc in tool_calls_raw]
        tool_calls = [tc for tc in tool_calls if tc is not None]

        if not tool_calls and isinstance(content, str):
            parsed = _parse_tool_protocol_text(content)
            if parsed.tool_calls:
                return parsed

        return LlmChatResult(
            content=content.strip() if isinstance(content, str) and content.strip() else None,
            tool_calls=tool_calls,
        )

    async def _complete_chat_json_protocol(
        self,
        messages: list[LlmMessage],
        tools: list[LlmToolSpec],
        *,
        temperature: float,
        max_tokens: int,
    ) -> LlmChatResult:
        tools_blob = json.dumps(
            [{"name": t.name, "description": t.description, "parameters": t.parameters} for t in tools],
            ensure_ascii=False,
        )
        protocol = (
            "Reply with ONE JSON object only. "
            'Need more facts: {"tool_calls":[{"name":"get_session_history","arguments":{"days":30}}]}. '
            'Final reply: {"answer":"..."}. '
            "answer must compare to goals/plan from CONTEXT, conclude on the user question, "
            "and give 1-2 next steps in Russian. "
            "Never invent numbers. Never ask the user to use tools or fetch data."
        )
        system_parts = [protocol, f"Tools: {tools_blob}"]
        for m in messages:
            if m.role == "system" and m.content:
                system_parts.append(m.content)
        system = "\n".join(system_parts)[:4000]

        transcript: list[str] = []
        for m in messages:
            if m.role == "system":
                continue
            if m.role == "tool":
                transcript.append(f"TOOL[{m.name or m.tool_call_id}]: {m.content}")
            elif m.tool_calls:
                transcript.append(
                    "ASSISTANT_TOOLS: "
                    + json.dumps(
                        [{"name": tc.name, "arguments": tc.arguments} for tc in m.tool_calls],
                        ensure_ascii=False,
                    )
                )
            else:
                transcript.append(f"{m.role.upper()}: {m.content}")
        user = "\n".join(transcript)[-12000:]
        if not user.strip():
            user = "Hello"

        text = await self.complete(
            system=system,
            user=user,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        known = {t.name for t in tools}
        return _parse_tool_protocol_text(text, known_tools=known or None)


def _to_openai_message(message: LlmMessage) -> dict[str, Any]:
    if message.role == "tool":
        return {
            "role": "tool",
            "tool_call_id": message.tool_call_id or "tool",
            "content": message.content,
            **({"name": message.name} if message.name else {}),
        }
    if message.tool_calls:
        return {
            "role": "assistant",
            "content": message.content or None,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": json.dumps(tc.arguments, ensure_ascii=False),
                    },
                }
                for tc in message.tool_calls
            ],
        }
    return {"role": message.role, "content": message.content}


def _parse_openai_tool_call(raw: Any) -> LlmToolCall | None:
    if not isinstance(raw, dict):
        return None
    fn = raw.get("function") or {}
    name = fn.get("name") or raw.get("name")
    if not name:
        return None
    args_raw = fn.get("arguments") or raw.get("arguments") or "{}"
    if isinstance(args_raw, dict):
        arguments = args_raw
    else:
        try:
            arguments = json.loads(args_raw) if args_raw else {}
        except json.JSONDecodeError:
            arguments = {}
    if not isinstance(arguments, dict):
        arguments = {}
    return LlmToolCall(
        id=str(raw.get("id") or uuid.uuid4()),
        name=str(name),
        arguments=arguments,
    )


def _parse_tool_protocol_text(
    text: str,
    *,
    known_tools: set[str] | None = None,
) -> LlmChatResult:
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fence:
        cleaned = fence.group(1).strip()

    # Prefer JSON object if present
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    json_candidate = cleaned
    if start >= 0 and end > start:
        json_candidate = cleaned[start : end + 1]
    try:
        data = json.loads(json_candidate)
    except json.JSONDecodeError:
        data = None

    if isinstance(data, dict) and "answer" in data and "tool_calls" not in data:
        answer = data.get("answer")
        return LlmChatResult(content=str(answer).strip() if answer is not None else None)

    calls_raw = None
    if isinstance(data, dict):
        if "tool_calls" in data:
            calls_raw = data["tool_calls"]
        elif "tool" in data or "name" in data:
            calls_raw = [data]

    if isinstance(calls_raw, list) and calls_raw:
        tool_calls = _tool_calls_from_raw_list(calls_raw)
        if tool_calls:
            return LlmChatResult(tool_calls=tool_calls)

    prose_calls = _extract_prose_tool_calls(text, known_tools=known_tools)
    if prose_calls:
        return LlmChatResult(tool_calls=prose_calls)

    return LlmChatResult(content=text.strip() or None)


def _tool_calls_from_raw_list(calls_raw: list[Any]) -> list[LlmToolCall]:
    tool_calls: list[LlmToolCall] = []
    for item in calls_raw:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("tool")
        if not name:
            continue
        args = item.get("arguments") or item.get("args") or {}
        if not isinstance(args, dict):
            args = {}
        tool_calls.append(
            LlmToolCall(id=str(item.get("id") or uuid.uuid4()), name=str(name), arguments=args)
        )
    return tool_calls


def _extract_prose_tool_calls(
    text: str,
    *,
    known_tools: set[str] | None = None,
) -> list[LlmToolCall]:
    """Parse Yandex narrations like [Использование функции 'get_session_history' ...]."""
    calls: list[LlmToolCall] = []
    seen: set[str] = set()

    def add(name: str, arguments: dict[str, Any]) -> None:
        if known_tools and name not in known_tools:
            return
        key = f"{name}:{json.dumps(arguments, sort_keys=True, ensure_ascii=False)}"
        if key in seen:
            return
        seen.add(key)
        calls.append(LlmToolCall(id=str(uuid.uuid4()), name=name, arguments=arguments))

    # [Использование функции 'NAME' с параметром 'days: 30']
    for match in re.finditer(
        r"Использование функции\s+['\"]([a-zA-Z_][\w]*)['\"]"
        r"(?:\s+с\s+параметр\w*\s+['\"]([^'\"]+)['\"])?",
        text,
        flags=re.IGNORECASE,
    ):
        name = match.group(1)
        args = _parse_loose_args(match.group(2) or "")
        add(name, args)

    # NAME(days=30) / NAME({"days": 30})
    for match in re.finditer(r"\b([a-zA-Z_][\w]*)\s*\(([^)]*)\)", text):
        name = match.group(1)
        if known_tools and name not in known_tools:
            continue
        if name in {"json", "dict", "list"}:
            continue
        args = _parse_loose_args(match.group(2) or "")
        add(name, args)

    # Bare known tool mention + waiting language → call with empty/default args
    if not calls and known_tools:
        lower = text.lower()
        waiting = any(
            marker in lower
            for marker in (
                "подожд",
                "загружа",
                "получен",
                "сейчас запрошу",
                "нужно получить",
                "using function",
                "calling tool",
            )
        )
        if waiting:
            for name in known_tools:
                if re.search(rf"\b{re.escape(name)}\b", text):
                    add(name, {})
                    break

    return calls


def _parse_loose_args(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    args: dict[str, Any] = {}
    # days: 30 | days=30 | 'days: 30'
    for match in re.finditer(
        r"['\"]?([a-zA-Z_][\w]*)['\"]?\s*[:=]\s*['\"]?([^,'\"}\s]+)['\"]?",
        raw,
    ):
        key = match.group(1)
        value: Any = match.group(2)
        if re.fullmatch(r"-?\d+", value):
            value = int(value)
        elif re.fullmatch(r"-?\d+\.\d+", value):
            value = float(value)
        args[key] = value
    return args

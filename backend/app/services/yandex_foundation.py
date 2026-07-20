"""Thin HTTP client for Yandex Foundation Models (embeddings + completion)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.models.activity_type import ACTIVITY_EMBEDDING_DIM

logger = logging.getLogger(__name__)

YANDEX_EMBEDDING_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding"
YANDEX_COMPLETION_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


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
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                YANDEX_EMBEDDING_URL,
                headers=self._headers(),
                json=payload,
            )
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

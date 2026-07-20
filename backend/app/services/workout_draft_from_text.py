"""Draft custom workout from coach free-text via embeddings + YandexGPT."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_type import ActivityType
from app.schemas.custom_workout import (
    CustomWorkoutDraftFromTextRequest,
    CustomWorkoutDraftInterval,
    CustomWorkoutDraftResponse,
)
from app.services.activity_embedding import ActivityEmbeddingService
from app.services.coach_custom_workout import calculate_weighted_average_met
from app.services.yandex_foundation import YandexFoundationClient, YandexFoundationError

logger = logging.getLogger(__name__)

SEGMENT_SPLIT_RE = re.compile(
    r"(?:\n+|;\s*|(?:,\s*)?(?:потом|затем|далее)\s+|→|->)",
    re.IGNORECASE,
)
DURATION_WITH_UNIT_RE = re.compile(
    r"(\d+)\s*(?:мин(?:ут[ыа]?)?|min(?:utes?)?)",
    re.IGNORECASE,
)
TRAILING_MINUTES_RE = re.compile(r"(\d+)\s*$")
JSON_BLOCK_RE = re.compile(r"\{[\s\S]*\}")

SYSTEM_PROMPT = """Ты помощник тренера по фитнесу.
По тексту тренировки и кандидатам из справочника Compendium выбери активность для каждого этапа.
Ответь ТОЛЬКО валидным JSON без markdown:
{"name":"краткое название","intervals":[{"source_activity_type_id":"uuid","duration_min":10,"label":"фраза этапа"}]}
Правила:
- source_activity_type_id бери ТОЛЬКО из списка кандидатов указанного этапа (поле id).
- duration_min — целое от 5 до 120; если в тексте нет минут, используй suggested_duration_min этапа.
- label — короткая фраза тренера для этапа (можно из текста).
- Не выдумывай uuid. Если для этапа нет подходящего кандидата — пропусти этап.
- Хотя бы один interval обязателен.
"""


@dataclass
class _Segment:
    phrase: str
    duration_min: int


def _parse_segment(part: str) -> _Segment:
    match = DURATION_WITH_UNIT_RE.search(part)
    if match:
        duration = int(match.group(1))
        phrase = DURATION_WITH_UNIT_RE.sub(" ", part)
    else:
        trailing = TRAILING_MINUTES_RE.search(part)
        if trailing:
            duration = int(trailing.group(1))
            phrase = part[: trailing.start()]
        else:
            duration = 10
            phrase = part
    duration = max(5, min(120, duration))
    phrase = re.sub(r"\s+", " ", phrase).strip(" ,.-–—")
    if not phrase:
        phrase = part
    return _Segment(phrase=phrase, duration_min=duration)


def split_coach_text(text: str) -> list[_Segment]:
    cleaned = text.strip()
    parts = [p.strip(" ,.-–—") for p in SEGMENT_SPLIT_RE.split(cleaned) if p and p.strip()]
    if len(parts) <= 1 and "," in cleaned:
        # "разминка 10, бег 20, растяжка 10"
        maybe = [p.strip(" ,.-–—") for p in cleaned.split(",") if p.strip()]
        if len(maybe) > 1 and sum(
            1 for p in maybe if DURATION_WITH_UNIT_RE.search(p) or TRAILING_MINUTES_RE.search(p)
        ) >= 2:
            parts = maybe
    if not parts:
        parts = [cleaned]
    return [_parse_segment(part) for part in parts]


def _extract_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    match = JSON_BLOCK_RE.search(text)
    if not match:
        raise ValueError("В ответе модели нет JSON")
    data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("JSON должен быть объектом")
    return data


class WorkoutDraftFromTextService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.client = YandexFoundationClient()
        self.embeddings = ActivityEmbeddingService(db, self.client)

    async def draft(self, data: CustomWorkoutDraftFromTextRequest) -> CustomWorkoutDraftResponse:
        if not self.client.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Yandex AI не настроен. Задайте YANDEX_AI_API_KEY и YANDEX_AI_FOLDER_ID "
                    "(ключ со scope foundationModels)."
                ),
            )

        try:
            filled = await self.embeddings.ensure_picker_embeddings()
            if filled:
                logger.info("Auto-filled %s activity embeddings before draft", filled)
        except YandexFoundationError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc

        segments = split_coach_text(data.text)
        per_stage: list[tuple[_Segment, list[ActivityType]]] = []
        try:
            for segment in segments:
                hits = await self.embeddings.search_similar(segment.phrase, limit=8)
                per_stage.append((segment, hits))
        except YandexFoundationError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc

        if not any(hits for _, hits in per_stage):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Не удалось найти похожие активности. Сначала прогоните embeddings.",
            )

        user_prompt = self._build_user_prompt(data.text, per_stage)
        try:
            raw = await self.client.complete(system=SYSTEM_PROMPT, user=user_prompt)
            parsed = _extract_json(raw)
        except (YandexFoundationError, ValueError, json.JSONDecodeError) as exc:
            logger.warning("Draft LLM failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Не удалось разобрать ответ модели: {exc}",
            ) from exc

        return await self._to_response(parsed, per_stage)

    def _build_user_prompt(
        self,
        original: str,
        per_stage: list[tuple[_Segment, list[ActivityType]]],
    ) -> str:
        lines = [f"Текст тренера:\n{original.strip()}\n", "Этапы и кандидаты:"]
        for index, (segment, hits) in enumerate(per_stage, start=1):
            lines.append(
                f"\nЭтап {index}: phrase={segment.phrase!r}, "
                f"suggested_duration_min={segment.duration_min}"
            )
            if not hits:
                lines.append("  (кандидатов нет)")
                continue
            for hit in hits:
                lines.append(
                    f"  - id={hit.id} | {hit.name_ru} | {hit.name_en} | "
                    f"MET {hit.met_value} | {hit.major_heading}"
                )
        lines.append("\nВерни JSON с name и intervals.")
        return "\n".join(lines)

    async def _to_response(
        self,
        parsed: dict,
        per_stage: list[tuple[_Segment, list[ActivityType]]],
    ) -> CustomWorkoutDraftResponse:
        allowed: set[UUID] = set()
        for _, hits in per_stage:
            for hit in hits:
                allowed.add(hit.id)

        name = str(parsed.get("name") or "").strip() or "Тренировка из текста"
        name = name[:200]
        raw_intervals = parsed.get("intervals")
        if not isinstance(raw_intervals, list) or not raw_intervals:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Модель не вернула этапы",
            )

        chosen_ids: list[UUID] = []
        draft_rows: list[tuple[UUID, int, str | None]] = []
        for item in raw_intervals:
            if not isinstance(item, dict):
                continue
            raw_id = item.get("source_activity_type_id")
            try:
                activity_id = UUID(str(raw_id))
            except (TypeError, ValueError):
                continue
            if activity_id not in allowed:
                continue
            try:
                duration = int(item.get("duration_min"))
            except (TypeError, ValueError):
                duration = 10
            duration = max(5, min(120, duration))
            # Snap to 5-min steps like the UI wheel.
            duration = max(5, min(120, round(duration / 5) * 5))
            label = item.get("label")
            label_str = str(label).strip()[:120] if label else None
            draft_rows.append((activity_id, duration, label_str or None))
            chosen_ids.append(activity_id)

        if not draft_rows:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Модель выбрала id вне списка кандидатов",
            )

        activities = await self.embeddings.get_by_ids(set(chosen_ids))
        intervals: list[CustomWorkoutDraftInterval] = []
        met_durations: list[tuple[float, int]] = []
        for activity_id, duration, label in draft_rows:
            activity = activities.get(activity_id)
            if activity is None:
                continue
            load = round(activity.met_value * duration, 1)
            met_durations.append((activity.met_value, duration))
            intervals.append(
                CustomWorkoutDraftInterval(
                    source_activity_type_id=activity.id,
                    source_activity_name=activity.name_ru,
                    source_met_value=activity.met_value,
                    duration_min=duration,
                    label=label,
                    load_met_minutes=load,
                )
            )

        if not intervals:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось сопоставить этапы с активностями",
            )

        average_met, total_duration, total_load = calculate_weighted_average_met(met_durations)
        return CustomWorkoutDraftResponse(
            name=name,
            average_met=average_met,
            total_duration_min=total_duration,
            total_load_met_minutes=total_load,
            intervals=intervals,
            warnings=[],
        )

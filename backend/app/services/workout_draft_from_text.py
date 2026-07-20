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
    r"(?:\r?\n+|;\s*|(?:,\s*)?(?:потом|затем|далее)\s+|→|->)",
    re.IGNORECASE,
)
DURATION_WITH_UNIT_RE = re.compile(
    r"(\d+)\s*(?:мин(?:ут[ыа]?)?|min(?:utes?)?)",
    re.IGNORECASE,
)
TRAILING_MINUTES_RE = re.compile(r"(\d+)\s*$")

# Expand coach slang before embedding so retrieval finds Compendium names.
QUERY_HINTS: tuple[tuple[str, str], ...] = (
    ("суставн", "warm-up mobility joint calisthenics stretching flexibility light conditioning"),
    ("разминк", "warm-up calisthenics stretching light conditioning"),
    ("заминк", "cool-down stretching flexibility"),
    ("растяж", "stretching flexibility yoga"),
    ("гребл", "rowing ergometer rower machine"),
    ("тренажер", "resistance machines weight training strength conditioning gym"),
    ("тренажёр", "resistance machines weight training strength conditioning gym"),
    ("бегов", "running treadmill jog"),
    ("велосипед", "bicycling cycling stationary bike"),
    ("плаван", "swimming water"),
)

SYSTEM_PROMPT = """Ты помощник тренера по фитнесу.
Для КАЖДОГО этапа выбери ровно один id из списка кандидатов этого этапа.
Ответь одним JSON-объектом и больше ничем (без markdown и пояснений):
{"name":"краткое название","picks":[{"stage":1,"source_activity_type_id":"uuid"},{"stage":2,"source_activity_type_id":"uuid"}]}
Правила:
- В picks должно быть ровно столько элементов, сколько этапов во входных данных.
- stage — номер этапа (1, 2, 3, …).
- source_activity_type_id только из кандидатов ЭТОГО stage.
- Не пропускай этапы. Не выдумывай uuid.
"""


@dataclass
class _Segment:
    phrase: str
    duration_min: int


def expand_query_for_embedding(phrase: str) -> str:
    """Append English/Compendium hints for common Russian coach phrases."""
    lower = phrase.lower()
    hints: list[str] = []
    for needle, hint in QUERY_HINTS:
        if needle in lower and hint not in hints:
            hints.append(hint)
    if not hints:
        return phrase
    return f"{phrase} / {' / '.join(hints)}"


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
    text = re.sub(r"```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = text.replace("```", "").strip()
    start = text.find("{")
    if start < 0:
        raise ValueError("В ответе модели нет JSON")
    try:
        data, _end = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError as exc:
        raise ValueError(f"Не удалось разобрать JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("JSON должен быть объектом")
    return data


def _snap_duration(minutes: int) -> int:
    return max(5, min(120, round(minutes / 5) * 5))


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
                query = expand_query_for_embedding(segment.phrase)
                hits = await self.embeddings.search_similar(query, limit=8)
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

        parsed: dict = {}
        raw = ""
        try:
            raw = await self.client.complete(
                system=SYSTEM_PROMPT,
                user=self._build_user_prompt(data.text, per_stage),
                max_tokens=2000,
            )
            parsed = _extract_json(raw)
        except (YandexFoundationError, ValueError, json.JSONDecodeError) as exc:
            logger.warning("Draft LLM failed, falling back to top embedding hits: %s", exc)
            parsed = {}

        return await self._to_response(parsed, per_stage, llm_raw=raw)

    def _build_user_prompt(
        self,
        original: str,
        per_stage: list[tuple[_Segment, list[ActivityType]]],
    ) -> str:
        lines = [
            f"Текст тренера:\n{original.strip()}\n",
            f"Всего этапов: {len(per_stage)}. Верни picks для каждого stage от 1 до {len(per_stage)}.",
            "Этапы и кандидаты:",
        ]
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
        lines.append(
            f'\nВерни JSON: {{"name":"...","picks":[{{"stage":1,"source_activity_type_id":"..."}},...]}} '
            f"с {len(per_stage)} picks."
        )
        return "\n".join(lines)

    def _llm_pick_by_stage(
        self,
        parsed: dict,
        per_stage: list[tuple[_Segment, list[ActivityType]]],
    ) -> dict[int, UUID]:
        """Map stage number → activity id chosen by LLM (only if id is in that stage's candidates)."""
        picks_raw = parsed.get("picks")
        if not isinstance(picks_raw, list):
            # Backward-compatible: old "intervals" list in order.
            picks_raw = parsed.get("intervals")
        if not isinstance(picks_raw, list):
            return {}

        by_stage: dict[int, UUID] = {}
        for index, item in enumerate(picks_raw):
            if not isinstance(item, dict):
                continue
            stage_num = item.get("stage")
            if stage_num is None:
                stage_num = index + 1
            try:
                stage = int(stage_num)
            except (TypeError, ValueError):
                continue
            if stage < 1 or stage > len(per_stage):
                continue
            try:
                activity_id = UUID(str(item.get("source_activity_type_id")))
            except (TypeError, ValueError):
                continue
            allowed_ids = {hit.id for hit in per_stage[stage - 1][1]}
            if activity_id in allowed_ids:
                by_stage[stage] = activity_id
        return by_stage

    async def _to_response(
        self,
        parsed: dict,
        per_stage: list[tuple[_Segment, list[ActivityType]]],
        *,
        llm_raw: str = "",
    ) -> CustomWorkoutDraftResponse:
        name = str(parsed.get("name") or "").strip() or "Тренировка из текста"
        name = name[:200]
        llm_picks = self._llm_pick_by_stage(parsed, per_stage)
        warnings: list[str] = []

        draft_rows: list[tuple[UUID, int, str | None]] = []
        for index, (segment, hits) in enumerate(per_stage, start=1):
            if not hits:
                warnings.append(f"Этап {index}: нет кандидатов для «{segment.phrase}»")
                continue
            chosen = llm_picks.get(index)
            if chosen is None:
                chosen = hits[0].id
                warnings.append(
                    f"Этап {index}: модель не выбрала id — взят ближайший по смыслу "
                    f"«{hits[0].name_ru}»"
                )
            draft_rows.append((chosen, _snap_duration(segment.duration_min), segment.phrase))

        if not draft_rows:
            logger.warning("Draft empty. LLM raw (truncated): %s", llm_raw[:800])
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось сопоставить ни одного этапа",
            )

        if len(draft_rows) < len(per_stage):
            warnings.append(
                f"Собрано {len(draft_rows)} из {len(per_stage)} этапов — часть без кандидатов"
            )

        activities = await self.embeddings.get_by_ids({row[0] for row in draft_rows})
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
            warnings=warnings,
        )

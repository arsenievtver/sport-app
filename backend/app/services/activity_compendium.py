from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from sqlalchemy import func, nulls_first, nulls_last, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.activity_compendium import (
    DEFAULT_MAJOR_HEADING_LABELS,
    MANUAL_COMPENDIUM_CODE_MAX_SEQ,
    MANUAL_COMPENDIUM_CODE_PREFIX,
    MANUAL_COMPENDIUM_CODE_SEQ_WIDTH,
)
from app.models.activity_compendium_import import ActivityCompendiumImport
from app.models.activity_major_heading_label import ActivityMajorHeadingLabel
from app.models.activity_type import ActivityType
from app.models.enums import ActivityCategory
from app.models.user import AthleteProfile
from app.schemas.activity_compendium import ActivityCompendiumStats
from app.services.compendium_parser import CompendiumActivityRow
from app.services.food_translation import COMPENDIUM_SOURCE, FoodTranslationService

logger = logging.getLogger(__name__)

NAMESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")
TRANSLATE_BATCH_SIZE = 50

ProgressCallback = Callable[[str, int, int, str], Awaitable[None] | None]

ActivitySortField = Literal[
    "compendium_code",
    "major_heading",
    "name_en",
    "name_ru",
    "met_value",
    "is_active",
    "updated_at",
]
ActivitySortDir = Literal["asc", "desc"]

DEFAULT_SORT_BY: ActivitySortField = "major_heading"
DEFAULT_SORT_DIR: ActivitySortDir = "asc"

HEADING_TO_CATEGORY: dict[str, ActivityCategory] = {
    "Bicycling": ActivityCategory.cardio,
    "Running": ActivityCategory.cardio,
    "Walking": ActivityCategory.cardio,
    "Water Activities": ActivityCategory.cardio,
    "Winter Activities": ActivityCategory.cardio,
    "Conditioning Exercise": ActivityCategory.strength,
    "Sports": ActivityCategory.team_sport,
    "Dancing": ActivityCategory.other,
}


def compendium_activity_id(code: str) -> UUID:
    return uuid.uuid5(NAMESPACE, f"pacompendium:{code}")


def compendium_external_id(code: str) -> int:
    return int(code)


def _resolve_sort(sort_by: str | None, sort_dir: str | None) -> tuple[ActivitySortField, ActivitySortDir]:
    allowed_fields: set[str] = {
        "compendium_code",
        "major_heading",
        "name_en",
        "name_ru",
        "met_value",
        "is_active",
        "updated_at",
    }
    field = sort_by if sort_by in allowed_fields else DEFAULT_SORT_BY
    direction: ActivitySortDir = "desc" if sort_dir == "desc" else "asc"
    return field, direction  # type: ignore[return-value]


def _order_clauses(sort_by: ActivitySortField, sort_dir: ActivitySortDir):
    columns = {
        "compendium_code": ActivityType.compendium_code,
        "major_heading": ActivityType.major_heading,
        "name_en": ActivityType.name_en,
        "name_ru": ActivityType.name_ru,
        "met_value": ActivityType.met_value,
        "is_active": ActivityType.is_active,
        "updated_at": ActivityType.updated_at,
    }
    column = columns[sort_by]
    ascending = sort_dir == "asc"

    if sort_by == "major_heading":
        primary = (
            nulls_last(column.asc()) if ascending else nulls_first(column.desc())
        )
    else:
        primary = column.asc() if ascending else column.desc()

    if sort_by == "compendium_code":
        return (primary,)

    return (primary, ActivityType.compendium_code.asc())


class ActivityCompendiumService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self) -> ActivityCompendiumStats:
        translator = FoodTranslationService(self.db)
        total = await self._count_all()
        translated = await self._count_translated()
        imported_at = await self._get_imported_at()
        headings = await self._list_major_headings()
        labels = await self.get_major_heading_labels()
        return ActivityCompendiumStats(
            activity_count=total,
            translated_count=translated,
            untranslated_count=max(0, total - translated),
            imported_at=imported_at,
            translator_enabled=translator.is_enabled(),
            major_headings=headings,
            major_heading_labels=labels,
        )

    async def list_admin(
        self,
        *,
        page: int = 1,
        page_size: int = 100,
        query: str | None = None,
        major_heading: str | None = None,
        is_active: bool | None = None,
        sort_by: str | None = None,
        sort_dir: str | None = None,
    ) -> tuple[list[ActivityType], int]:
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        resolved_sort_by, resolved_sort_dir = _resolve_sort(sort_by, sort_dir)
        filters = []

        if major_heading:
            filters.append(ActivityType.major_heading == major_heading)

        if is_active is not None:
            filters.append(ActivityType.is_active.is_(is_active))

        q = (query or "").strip()
        if q:
            if q.isdigit() and len(q) <= 5:
                filters.append(ActivityType.compendium_code == q.zfill(5))
            else:
                pattern = f"%{q}%"
                filters.append(
                    or_(
                        ActivityType.name_en.ilike(pattern),
                        ActivityType.name_ru.ilike(pattern),
                        ActivityType.compendium_code.ilike(pattern),
                    ),
                )

        count_stmt = select(func.count()).select_from(ActivityType)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = int((await self.db.execute(count_stmt)).scalar_one())

        stmt = select(ActivityType)
        if filters:
            stmt = stmt.where(*filters)
        stmt = (
            stmt.order_by(*_order_clauses(resolved_sort_by, resolved_sort_dir))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return list(rows), total

    async def update_admin(
        self,
        activity_id: UUID,
        *,
        major_heading: str | None = None,
        name_en: str | None = None,
        name_ru: str | None = None,
        met_value: float | None = None,
        is_active: bool | None = None,
    ) -> ActivityType:
        row = await self._get_by_id(activity_id)
        translator = FoodTranslationService(self.db)

        if major_heading is not None:
            cleaned_heading = major_heading.strip()
            if not cleaned_heading:
                raise ValueError("Группа не может быть пустой")
            row.major_heading = cleaned_heading
            row.category = self._category_for_heading(cleaned_heading)

        if name_en is not None:
            cleaned_en = name_en.strip()
            if not cleaned_en:
                raise ValueError("Название EN не может быть пустым")
            if cleaned_en != row.name_en:
                row.name_en = cleaned_en

        if met_value is not None:
            if met_value <= 0:
                raise ValueError("MET должен быть больше нуля")
            row.met_value = met_value

        if name_ru is not None:
            cleaned = name_ru.strip()
            row.name_ru = cleaned
            if cleaned:
                await translator.save_verified_translation(
                    source=COMPENDIUM_SOURCE,
                    external_id=compendium_external_id(row.compendium_code),
                    source_name=row.name_en,
                    translated_name=cleaned,
                )

        if is_active is not None:
            row.is_active = is_active

        await self.db.flush()
        return row

    async def create_admin(
        self,
        *,
        major_heading: str,
        name_en: str,
        name_ru: str | None,
        met_value: float,
        is_active: bool,
    ) -> ActivityType:
        code = await self._allocate_manual_compendium_code()
        heading = major_heading.strip()
        english = name_en.strip()
        if not heading:
            raise ValueError("Укажите группу")
        if not english:
            raise ValueError("Укажите название EN")
        if met_value <= 0:
            raise ValueError("MET должен быть больше нуля")

        existing = await self.db.execute(
            select(ActivityType).where(ActivityType.compendium_code == code),
        )
        if existing.scalar_one_or_none() is not None:
            raise ValueError(f"Активность с кодом {code} уже существует")

        russian = (name_ru or "").strip()
        row = ActivityType(
            id=compendium_activity_id(code),
            compendium_code=code,
            name_en=english,
            name_ru=russian,
            major_heading=heading,
            category=self._category_for_heading(heading),
            met_value=met_value,
            sort_order=int(code),
            is_active=is_active,
        )
        self.db.add(row)
        await self.db.flush()

        if russian:
            await FoodTranslationService(self.db).save_verified_translation(
                source=COMPENDIUM_SOURCE,
                external_id=compendium_external_id(code),
                source_name=english,
                translated_name=russian,
            )

        return row

    async def get_major_heading_labels(self) -> dict[str, str]:
        overrides = await self._load_major_heading_label_overrides()
        merged = {**DEFAULT_MAJOR_HEADING_LABELS, **overrides}
        headings = await self._list_major_headings()
        return {heading: merged.get(heading, heading) for heading in headings}

    async def set_major_heading_label(self, heading: str, label_ru: str) -> str:
        source = heading.strip()
        label = label_ru.strip()
        if not source:
            raise ValueError("Укажите группу")
        if not label:
            raise ValueError("Укажите русское название")

        headings = await self._list_major_headings()
        if source not in headings:
            raise LookupError("Группа не найдена")

        default_label = DEFAULT_MAJOR_HEADING_LABELS.get(source)
        if default_label == label:
            await self._delete_major_heading_label_override(source)
            return label

        result = await self.db.execute(
            select(ActivityMajorHeadingLabel).where(ActivityMajorHeadingLabel.heading == source),
        )
        row = result.scalar_one_or_none()
        if row is None:
            self.db.add(ActivityMajorHeadingLabel(heading=source, label_ru=label))
        else:
            row.label_ru = label

        await self.db.flush()
        return label

    async def translate_group_label(self, label_ru: str) -> str:
        label = label_ru.strip()
        if not label:
            raise ValueError("Укажите русское название")
        translator = FoodTranslationService(self.db)
        if not translator.is_enabled():
            raise ValueError("Переводчик не настроен")
        translated = await translator.translate_from_russian([label])
        return self._title_case_heading(translated[0])

    async def create_group(
        self,
        *,
        label_ru: str,
        heading_en: str,
        activity_ids: list[UUID],
    ) -> tuple[str, str, int]:
        label = label_ru.strip()
        heading = heading_en.strip()
        if not label:
            raise ValueError("Укажите русское название")
        if not heading:
            raise ValueError("Укажите английское название группы")

        await self._upsert_major_heading_label(heading, label)
        moved = await self.bulk_move_activities(activity_ids, heading)
        return heading, label, moved

    async def bulk_move_activities(self, activity_ids: list[UUID], major_heading: str) -> int:
        if not activity_ids:
            return 0

        target = major_heading.strip()
        if not target:
            raise ValueError("Укажите группу")

        unique_ids = list(dict.fromkeys(activity_ids))
        result = await self.db.execute(select(ActivityType).where(ActivityType.id.in_(unique_ids)))
        rows = result.scalars().all()
        if len(rows) != len(unique_ids):
            raise LookupError("Некоторые активности не найдены")

        category = self._category_for_heading(target)
        for row in rows:
            row.major_heading = target
            row.category = category

        await self.db.flush()
        return len(rows)

    async def merge_major_heading(self, from_heading: str, to_heading: str) -> int:
        return await self.rename_major_heading(from_heading, to_heading)

    async def rename_major_heading(self, from_heading: str, to_heading: str) -> int:
        source = from_heading.strip()
        target = to_heading.strip()
        if not source or not target:
            raise ValueError("Укажите исходную и новую группу")
        if source == target:
            return 0

        rows = (
            await self.db.execute(select(ActivityType).where(ActivityType.major_heading == source))
        ).scalars().all()
        if not rows:
            raise LookupError("Группа не найдена")

        category = self._category_for_heading(target)
        for row in rows:
            row.major_heading = target
            row.category = category

        await self.db.flush()
        return len(rows)

    @staticmethod
    def _normalize_compendium_code(raw_code: str) -> str:
        code = raw_code.strip()
        if not code.isdigit():
            raise ValueError("Код Compendium должен состоять из цифр")
        if len(code) > 5:
            raise ValueError("Код Compendium — не более 5 цифр")
        return code.zfill(5)

    @staticmethod
    def format_manual_compendium_code(sequence: int) -> str:
        if sequence < 1 or sequence > MANUAL_COMPENDIUM_CODE_MAX_SEQ:
            raise ValueError("Недопустимый номер ручной активности")
        return f"{MANUAL_COMPENDIUM_CODE_PREFIX}{sequence:0{MANUAL_COMPENDIUM_CODE_SEQ_WIDTH}d}"

    async def _allocate_manual_compendium_code(self) -> str:
        prefix = MANUAL_COMPENDIUM_CODE_PREFIX
        prefix_len = len(prefix)
        result = await self.db.execute(
            select(ActivityType.compendium_code).where(
                ActivityType.compendium_code.like(f"{prefix}%"),
            )
        )
        max_sequence = 0
        for code in result.scalars().all():
            suffix = code[prefix_len:]
            if suffix.isdigit():
                max_sequence = max(max_sequence, int(suffix))

        next_sequence = max_sequence + 1
        if next_sequence > MANUAL_COMPENDIUM_CODE_MAX_SEQ:
            raise ValueError("Исчерпан диапазон кодов для ручных активностей")
        return self.format_manual_compendium_code(next_sequence)

    async def delete_admin(self, activity_id: UUID) -> None:
        row = await self._get_by_id(activity_id)
        id_str = str(activity_id)

        profiles = (await self.db.execute(select(AthleteProfile))).scalars().all()
        for profile in profiles:
            recent_ids = profile.recent_activity_type_ids or []
            if id_str in recent_ids:
                profile.recent_activity_type_ids = [value for value in recent_ids if value != id_str]

        await self.db.delete(row)
        await self.db.flush()

    async def import_rows(
        self,
        rows: list[CompendiumActivityRow],
        *,
        progress: ProgressCallback | None = None,
    ) -> int:
        total = len(rows)
        if progress:
            await _notify(progress, "import", 0, total, "Загружаем справочник в базу…")

        existing_result = await self.db.execute(select(ActivityType))
        existing_by_code = {row.compendium_code: row for row in existing_result.scalars().all()}

        imported = 0
        for index, item in enumerate(rows, start=1):
            existing = existing_by_code.get(item.compendium_code)
            if existing is not None:
                if existing.name_en != item.name_en:
                    existing.name_ru = ""
                    await FoodTranslationService(self.db).delete_translation(
                        compendium_external_id(item.compendium_code),
                        source=COMPENDIUM_SOURCE,
                    )
                existing.name_en = item.name_en
                existing.met_value = item.met_value
                existing.major_heading = item.major_heading
                existing.sort_order = int(item.compendium_code)
            else:
                self.db.add(
                    ActivityType(
                        id=compendium_activity_id(item.compendium_code),
                        compendium_code=item.compendium_code,
                        name_en=item.name_en,
                        name_ru="",
                        major_heading=item.major_heading,
                        category=self._category_for_heading(item.major_heading),
                        met_value=item.met_value,
                        sort_order=int(item.compendium_code),
                        is_active=False,
                    ),
                )
                imported += 1

            if progress and index % 100 == 0:
                await _notify(progress, "import", index, total, f"Импорт: {index}/{total}")

        await self._touch_import_metadata(total)
        await self.db.flush()

        if progress:
            await _notify(progress, "import", total, total, f"Импорт завершён: {total} активностей")
        return imported

    async def repair_stale_name_ru(self) -> int:
        """Clear RU titles that no longer match the current English compendium name."""
        translator = FoodTranslationService(self.db)
        rows = (
            await self.db.execute(
                select(ActivityType).where(
                    ActivityType.name_ru != "",
                    ActivityType.name_ru.is_not(None),
                ),
            )
        ).scalars().all()
        if not rows:
            return 0

        cached_map = await translator._get_translations_map(
            COMPENDIUM_SOURCE,
            [compendium_external_id(row.compendium_code) for row in rows],
            translator.target_lang,
        )

        cleared = 0
        for row in rows:
            ext_id = compendium_external_id(row.compendium_code)
            cached = cached_map.get(ext_id)
            keep_admin_override = (
                cached is not None
                and cached.provider == "admin"
                and cached.verified
                and cached.source_name == row.name_en
            )
            if keep_admin_override:
                continue

            stale = cached is None or cached.source_name != row.name_en
            if not stale:
                continue

            row.name_ru = ""
            if cached is not None:
                await translator.delete_translation(ext_id, source=COMPENDIUM_SOURCE)
            cleared += 1

        if cleared:
            await self.db.flush()
        return cleared

    async def translate_all_missing(self, *, progress: ProgressCallback | None = None) -> int:
        translator = FoodTranslationService(self.db)
        if not translator.is_enabled():
            return 0

        repaired = await self.repair_stale_name_ru()
        if progress and repaired:
            await _notify(
                progress,
                "translate",
                0,
                0,
                f"Сброшено устаревших переводов: {repaired}",
            )

        total = await self._count_untranslated()
        if total == 0:
            if progress:
                await _notify(progress, "translate", 0, 0, "Все названия уже переведены")
            return 0

        translated_total = 0
        processed = 0

        while True:
            result = await self.db.execute(
                select(ActivityType)
                .where(or_(ActivityType.name_ru == "", ActivityType.name_ru.is_(None)))
                .order_by(ActivityType.compendium_code)
                .limit(TRANSLATE_BATCH_SIZE),
            )
            batch = result.scalars().all()
            if not batch:
                break

            english_names = [row.name_en for row in batch]
            translated = await translator.translate_texts(english_names)
            for row, name_ru in zip(batch, translated, strict=True):
                processed += 1
                if not name_ru or name_ru == row.name_en:
                    continue
                row.name_ru = name_ru
                translated_total += 1
                await translator.save_verified_translation(
                    source=COMPENDIUM_SOURCE,
                    external_id=compendium_external_id(row.compendium_code),
                    source_name=row.name_en,
                    translated_name=name_ru,
                    provider="yandex",
                    verified=False,
                )
                if progress:
                    await _notify(
                        progress,
                        "translate",
                        processed,
                        total,
                        f"Переводим названия: {processed}/{total}",
                    )

            await self.db.flush()

        if progress:
            await _notify(
                progress,
                "translate",
                total,
                total,
                f"Перевод завершён: {translated_total} новых названий",
            )
        return translated_total

    async def _get_by_id(self, activity_id: UUID) -> ActivityType:
        result = await self.db.execute(select(ActivityType).where(ActivityType.id == activity_id))
        row = result.scalar_one_or_none()
        if row is None:
            raise LookupError("Activity not found")
        return row

    async def _count_all(self) -> int:
        result = await self.db.execute(select(func.count()).select_from(ActivityType))
        return int(result.scalar_one())

    async def _count_translated(self) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(ActivityType)
            .where(ActivityType.name_ru != "", ActivityType.name_ru.is_not(None)),
        )
        return int(result.scalar_one())

    async def _count_untranslated(self) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(ActivityType)
            .where(or_(ActivityType.name_ru == "", ActivityType.name_ru.is_(None))),
        )
        return int(result.scalar_one())

    async def _get_imported_at(self) -> datetime | None:
        result = await self.db.execute(
            select(ActivityCompendiumImport).where(ActivityCompendiumImport.id == 1),
        )
        row = result.scalar_one_or_none()
        return row.imported_at if row else None

    async def _list_major_headings(self) -> list[str]:
        from_activity = await self.db.execute(
            select(ActivityType.major_heading)
            .where(ActivityType.major_heading.is_not(None))
            .distinct(),
        )
        from_labels = await self.db.execute(select(ActivityMajorHeadingLabel.heading))
        combined = {
            value
            for value in (*from_activity.scalars().all(), *from_labels.scalars().all())
            if value
        }
        return sorted(combined)

    async def _upsert_major_heading_label(self, heading: str, label_ru: str) -> str:
        source = heading.strip()
        label = label_ru.strip()
        if not source:
            raise ValueError("Укажите группу")
        if not label:
            raise ValueError("Укажите русское название")

        default_label = DEFAULT_MAJOR_HEADING_LABELS.get(source)
        if default_label == label:
            await self._delete_major_heading_label_override(source)
            return label

        result = await self.db.execute(
            select(ActivityMajorHeadingLabel).where(ActivityMajorHeadingLabel.heading == source),
        )
        row = result.scalar_one_or_none()
        if row is None:
            self.db.add(ActivityMajorHeadingLabel(heading=source, label_ru=label))
        else:
            row.label_ru = label

        await self.db.flush()
        return label

    @staticmethod
    def _title_case_heading(text: str) -> str:
        return " ".join(word[:1].upper() + word[1:] if word else "" for word in text.split())

    async def _load_major_heading_label_overrides(self) -> dict[str, str]:
        result = await self.db.execute(select(ActivityMajorHeadingLabel))
        return {row.heading: row.label_ru for row in result.scalars().all()}

    async def _delete_major_heading_label_override(self, heading: str) -> None:
        result = await self.db.execute(
            select(ActivityMajorHeadingLabel).where(ActivityMajorHeadingLabel.heading == heading),
        )
        row = result.scalar_one_or_none()
        if row is not None:
            await self.db.delete(row)

    async def _touch_import_metadata(self, activity_count: int) -> None:
        now = datetime.now(UTC)
        result = await self.db.execute(
            select(ActivityCompendiumImport).where(ActivityCompendiumImport.id == 1),
        )
        row = result.scalar_one_or_none()
        if row is None:
            self.db.add(
                ActivityCompendiumImport(
                    id=1,
                    imported_at=now,
                    activity_count=activity_count,
                ),
            )
        else:
            row.imported_at = now
            row.activity_count = activity_count

    @staticmethod
    def _category_for_heading(major_heading: str) -> ActivityCategory:
        return HEADING_TO_CATEGORY.get(major_heading, ActivityCategory.other)


async def _notify(
    progress: ProgressCallback,
    phase: str,
    current: int,
    total: int,
    message: str,
) -> None:
    result = progress(phase, current, total, message)
    if result is not None:
        await result

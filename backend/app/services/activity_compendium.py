from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_compendium_import import ActivityCompendiumImport
from app.models.activity_type import ActivityType
from app.models.enums import ActivityCategory
from app.schemas.activity_compendium import ActivityCompendiumStats
from app.services.compendium_parser import CompendiumActivityRow
from app.services.food_translation import COMPENDIUM_SOURCE, FoodTranslationService

logger = logging.getLogger(__name__)

NAMESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")
TRANSLATE_BATCH_SIZE = 50

ProgressCallback = Callable[[str, int, int, str], Awaitable[None] | None]

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


class ActivityCompendiumService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self) -> ActivityCompendiumStats:
        translator = FoodTranslationService(self.db)
        total = await self._count_all()
        translated = await self._count_translated()
        imported_at = await self._get_imported_at()
        headings = await self._list_major_headings()
        return ActivityCompendiumStats(
            activity_count=total,
            translated_count=translated,
            untranslated_count=max(0, total - translated),
            imported_at=imported_at,
            translator_enabled=translator.is_enabled(),
            major_headings=headings,
        )

    async def list_admin(
        self,
        *,
        page: int = 1,
        page_size: int = 100,
        query: str | None = None,
        major_heading: str | None = None,
    ) -> tuple[list[ActivityType], int]:
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        filters = []

        if major_heading:
            filters.append(ActivityType.major_heading == major_heading)

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
            stmt.order_by(ActivityType.major_heading, ActivityType.compendium_code)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return list(rows), total

    async def update_admin(self, activity_id: UUID, *, name_ru: str | None, is_active: bool | None) -> ActivityType:
        row = await self._get_by_id(activity_id)
        translator = FoodTranslationService(self.db)

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

    async def translate_all_missing(self, *, progress: ProgressCallback | None = None) -> int:
        translator = FoodTranslationService(self.db)
        if not translator.is_enabled():
            return 0

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
        result = await self.db.execute(
            select(ActivityType.major_heading)
            .where(ActivityType.major_heading.is_not(None))
            .distinct()
            .order_by(ActivityType.major_heading),
        )
        return [value for value in result.scalars().all() if value]

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

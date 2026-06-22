from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.logmeal_dish_catalog import LogMealCatalogSync, LogMealDishCatalog
from app.schemas.athlete_meals import MealDishSearchItem, MealDishSearchResponse
from app.schemas.meal_catalog import MealCatalogStats
from app.services.food_translation import FoodTranslationService, LOGMEAL_SOURCE
from app.services.logmeal import LogMealService

logger = logging.getLogger(__name__)

CATALOG_DISH_TYPES = ("food", "drinks", "combo", "customRecipe", "ingredients", "sauces")
TRANSLATE_BATCH_SIZE = 50

ProgressCallback = Callable[[str, int, int, str], Awaitable[None] | None]


class LogMealCatalogService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self) -> MealCatalogStats:
        dish_count = await self._count_dishes()
        translated_count = await self._count_translated()
        synced_at = await self._get_synced_at()
        translator = FoodTranslationService(self.db)
        return MealCatalogStats(
            dish_count=dish_count,
            translated_count=translated_count,
            untranslated_count=max(0, dish_count - translated_count),
            synced_at=synced_at,
            search_ready=dish_count > 0,
            translator_enabled=translator.is_enabled(),
        )

    async def search(self, query: str, *, limit: int = 20) -> MealDishSearchResponse:
        normalized = query.strip().lower()
        if len(normalized) < 2:
            return MealDishSearchResponse(
                items=[],
                catalog_synced_at=await self._get_synced_at(),
                catalog_dish_count=await self._count_dishes(),
            )

        pattern = f"%{normalized}%"
        result = await self.db.execute(
            select(LogMealDishCatalog)
            .where(
                LogMealDishCatalog.dish_type.in_(CATALOG_DISH_TYPES),
                or_(
                    func.lower(LogMealDishCatalog.name_en).like(pattern),
                    func.lower(LogMealDishCatalog.name_ru).like(pattern),
                ),
            )
            .order_by(
                func.length(LogMealDishCatalog.name_en),
                LogMealDishCatalog.name_en,
            )
            .limit(limit),
        )
        rows = result.scalars().all()
        return MealDishSearchResponse(
            items=[self._to_search_item(row) for row in rows],
            catalog_synced_at=await self._get_synced_at(),
            catalog_dish_count=await self._count_dishes(),
        )

    async def sync_catalog(self, *, progress: ProgressCallback | None = None) -> datetime:
        if progress:
            await _notify(progress, "fetch", 0, 1, "Загружаем каталог из LogMeal…")

        dataset = await LogMealService(self.db).fetch_dish_dataset()
        now = datetime.now(UTC)

        entries: list[tuple[int, str, float | None, str]] = []
        for dish_type in CATALOG_DISH_TYPES:
            items = dataset.get(dish_type)
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                dish_id = item.get("id")
                name = item.get("name")
                if not isinstance(dish_id, int) or not isinstance(name, str) or not name.strip():
                    continue
                portion = item.get("portion_size")
                portion_size = float(portion) if isinstance(portion, (int, float)) else None
                entries.append((dish_id, name.strip(), portion_size, dish_type))

        total = len(entries)
        written = 0
        for index, (dish_id, name_en, portion_size, dish_type) in enumerate(entries, start=1):
            changed = await self._upsert_dish_if_changed(dish_id, name_en, portion_size, dish_type)
            if changed:
                written += 1
            if progress and index % 25 == 0:
                await _notify(
                    progress,
                    "upsert",
                    index,
                    total,
                    f"Обновляем каталог: {index}/{total} (изменено {written})",
                )

        await self._upsert_sync_meta(now, total)
        await self.db.flush()

        if progress:
            await _notify(
                progress,
                "upsert",
                total,
                total,
                f"Каталог обновлён: {total} позиций, записано изменений {written}",
            )
        return now

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
                select(LogMealDishCatalog)
                .where(LogMealDishCatalog.name_ru.is_(None))
                .order_by(LogMealDishCatalog.logmeal_id)
                .limit(TRANSLATE_BATCH_SIZE),
            )
            rows = result.scalars().all()
            if not rows:
                break

            english_names = [row.name_en for row in rows]
            translated = await translator._translate_ephemeral(english_names)
            for row, name_ru in zip(rows, translated, strict=True):
                processed += 1
                if name_ru == row.name_en:
                    continue
                row.name_ru = name_ru
                translated_total += 1
                await translator._upsert_translation(
                    source=LOGMEAL_SOURCE,
                    external_id=row.logmeal_id,
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

    async def _upsert_dish_if_changed(
        self,
        dish_id: int,
        name_en: str,
        portion_size: float | None,
        dish_type: str,
    ) -> bool:
        result = await self.db.execute(
            select(LogMealDishCatalog).where(LogMealDishCatalog.logmeal_id == dish_id),
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            unchanged = (
                existing.name_en == name_en
                and existing.portion_size_g == portion_size
                and existing.dish_type == dish_type
            )
            if unchanged:
                return False
            existing.name_en = name_en
            existing.portion_size_g = portion_size
            existing.dish_type = dish_type
            if existing.name_ru is not None:
                existing.name_ru = None
            return True

        self.db.add(
            LogMealDishCatalog(
                logmeal_id=dish_id,
                name_en=name_en,
                portion_size_g=portion_size,
                dish_type=dish_type,
            ),
        )
        return True

    async def _count_dishes(self) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(LogMealDishCatalog)
            .where(LogMealDishCatalog.dish_type.in_(CATALOG_DISH_TYPES)),
        )
        return int(result.scalar_one())

    async def _count_translated(self) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(LogMealDishCatalog)
            .where(
                LogMealDishCatalog.dish_type.in_(CATALOG_DISH_TYPES),
                LogMealDishCatalog.name_ru.is_not(None),
            ),
        )
        return int(result.scalar_one())

    async def _count_untranslated(self) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(LogMealDishCatalog)
            .where(
                LogMealDishCatalog.dish_type.in_(CATALOG_DISH_TYPES),
                LogMealDishCatalog.name_ru.is_(None),
            ),
        )
        return int(result.scalar_one())

    async def _get_synced_at(self) -> datetime | None:
        result = await self.db.execute(select(LogMealCatalogSync).where(LogMealCatalogSync.id == 1))
        row = result.scalar_one_or_none()
        return row.synced_at if row is not None else None

    async def _upsert_sync_meta(self, synced_at: datetime, dish_count: int) -> None:
        stmt = (
            insert(LogMealCatalogSync)
            .values(id=1, synced_at=synced_at, dish_count=dish_count)
            .on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "synced_at": synced_at,
                    "dish_count": dish_count,
                    "updated_at": func.now(),
                },
            )
        )
        await self.db.execute(stmt)

    @staticmethod
    def _to_search_item(row: LogMealDishCatalog) -> MealDishSearchItem:
        display_name = row.name_ru or row.name_en
        return MealDishSearchItem(
            logmeal_dish_id=row.logmeal_id,
            name=display_name,
            name_en=row.name_en,
            portion_size_g=row.portion_size_g,
            dish_type=row.dish_type,
        )


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

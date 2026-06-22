from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.food_name_translation import FoodNameTranslation
from app.schemas.athlete_meals import MealAnalysisResponse, MealDishPreview

logger = logging.getLogger(__name__)

LOGMEAL_SOURCE = "logmeal"
YANDEX_TRANSLATE_URL = "https://translate.api.cloud.yandex.net/translate/v2/translate"


class FoodTranslationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @property
    def target_lang(self) -> str:
        return settings.food_translation_target_lang

    @property
    def source_lang(self) -> str:
        return settings.food_translation_source_lang

    def is_enabled(self) -> bool:
        return bool(settings.yandex_translate_api_key and settings.yandex_translate_folder_id)

    async def localize_analysis(self, analysis: MealAnalysisResponse) -> MealAnalysisResponse:
        localized_dishes = await self.localize_dish_previews(analysis.dishes)
        title = ", ".join(dish.name for dish in localized_dishes) if localized_dishes else analysis.title

        calories = analysis.calories_kcal
        summary_parts = [f"Распознано: {title}", f"Калории: {round(calories)} ккал"]
        if analysis.protein_g is not None:
            summary_parts.append(f"Б: {round(analysis.protein_g, 1)} г")
        if analysis.fat_g is not None:
            summary_parts.append(f"Ж: {round(analysis.fat_g, 1)} г")
        if analysis.carbs_g is not None:
            summary_parts.append(f"У: {round(analysis.carbs_g, 1)} г")
        if analysis.weight_g is not None:
            summary_parts.append(f"Вес: ~{round(analysis.weight_g)} г")

        raw = dict(analysis.raw)
        if localized_dishes:
            raw["dishes"] = [dish.model_dump() for dish in localized_dishes]

        return analysis.model_copy(
            update={
                "title": title,
                "dishes": localized_dishes,
                "summary": " · ".join(summary_parts),
                "raw": raw,
            },
        )

    async def localize_dish_previews(self, dishes: list[MealDishPreview]) -> list[MealDishPreview]:
        if not dishes:
            return dishes

        with_ids: list[MealDishPreview] = []
        without_ids: list[MealDishPreview] = []
        for dish in dishes:
            if dish.logmeal_dish_id is not None:
                with_ids.append(dish)
            else:
                without_ids.append(dish)

        translated_by_id = await self._resolve_translations_with_ids(with_ids)
        translated_without_ids = await self._translate_ephemeral(
            [self._english_name(dish) for dish in without_ids],
        )

        localized: list[MealDishPreview] = []
        without_index = 0
        for dish in dishes:
            if dish.logmeal_dish_id is not None:
                localized_name = translated_by_id.get(dish.logmeal_dish_id, dish.name)
            else:
                localized_name = (
                    translated_without_ids[without_index]
                    if without_index < len(translated_without_ids)
                    else dish.name
                )
                without_index += 1
            localized.append(
                dish.model_copy(
                    update={
                        "name_en": self._english_name(dish),
                        "name": localized_name,
                    },
                ),
            )
        return localized

    async def record_user_overrides(self, ai_analysis: dict[str, Any] | None) -> None:
        if not isinstance(ai_analysis, dict):
            return

        dishes = ai_analysis.get("dishes")
        if not isinstance(dishes, list):
            return

        for item in dishes:
            if not isinstance(item, dict):
                continue
            dish_id = item.get("logmeal_dish_id")
            name = item.get("name")
            if not isinstance(dish_id, int) or not isinstance(name, str):
                continue

            translated_name = name.strip()
            if not translated_name:
                continue

            existing = await self._get_translation(LOGMEAL_SOURCE, dish_id, self.target_lang)
            if existing is not None and existing.translated_name == translated_name:
                continue

            source_name = existing.source_name if existing is not None else translated_name
            if isinstance(item.get("name_en"), str) and item["name_en"].strip():
                source_name = item["name_en"].strip()

            await self._upsert_translation(
                source=LOGMEAL_SOURCE,
                external_id=dish_id,
                source_name=source_name,
                translated_name=translated_name,
                provider="user",
                verified=True,
            )

    async def _resolve_translations_with_ids(self, dishes: list[MealDishPreview]) -> dict[int, str]:
        if not dishes:
            return {}

        dish_ids = [dish.logmeal_dish_id for dish in dishes if dish.logmeal_dish_id is not None]
        cached = await self._get_translations_map(LOGMEAL_SOURCE, dish_ids, self.target_lang)

        missing: list[MealDishPreview] = []
        resolved: dict[int, str] = {}
        for dish in dishes:
            dish_id = dish.logmeal_dish_id
            if dish_id is None:
                continue
            row = cached.get(dish_id)
            if row is not None:
                resolved[dish_id] = row.translated_name
            else:
                missing.append(dish)

        if not missing:
            return resolved

        english_names = [self._english_name(dish) for dish in missing]
        translated_names = await self._translate_ephemeral(english_names)
        for dish, translated_name in zip(missing, translated_names, strict=True):
            dish_id = dish.logmeal_dish_id
            if dish_id is None:
                continue
            await self._upsert_translation(
                source=LOGMEAL_SOURCE,
                external_id=dish_id,
                source_name=self._english_name(dish),
                translated_name=translated_name,
                provider="yandex",
                verified=False,
            )
            resolved[dish_id] = translated_name

        return resolved

    async def _get_translations_map(
        self,
        source: str,
        external_ids: list[int],
        target_lang: str,
    ) -> dict[int, FoodNameTranslation]:
        if not external_ids:
            return {}

        result = await self.db.execute(
            select(FoodNameTranslation).where(
                FoodNameTranslation.source == source,
                FoodNameTranslation.target_lang == target_lang,
                FoodNameTranslation.external_id.in_(external_ids),
            ),
        )
        rows = result.scalars().all()
        return {row.external_id: row for row in rows}

    async def _get_translation(
        self,
        source: str,
        external_id: int,
        target_lang: str,
    ) -> FoodNameTranslation | None:
        result = await self.db.execute(
            select(FoodNameTranslation).where(
                FoodNameTranslation.source == source,
                FoodNameTranslation.external_id == external_id,
                FoodNameTranslation.target_lang == target_lang,
            ),
        )
        return result.scalar_one_or_none()

    async def _upsert_translation(
        self,
        *,
        source: str,
        external_id: int,
        source_name: str,
        translated_name: str,
        provider: str,
        verified: bool,
    ) -> None:
        stmt = (
            insert(FoodNameTranslation)
            .values(
                id=uuid.uuid4(),
                source=source,
                external_id=external_id,
                source_name=source_name,
                source_lang=self.source_lang,
                target_lang=self.target_lang,
                translated_name=translated_name,
                provider=provider,
                verified=verified,
            )
            .on_conflict_do_update(
                constraint="uq_food_name_translation",
                set_={
                    "source_name": source_name,
                    "translated_name": translated_name,
                    "provider": provider,
                    "verified": verified,
                    "updated_at": func.now(),
                },
            )
        )
        await self.db.execute(stmt)

    async def _translate_ephemeral(self, texts: list[str]) -> list[str]:
        if not texts:
            return []

        if not self.is_enabled():
            return texts

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    YANDEX_TRANSLATE_URL,
                    headers={"Authorization": f"Api-Key {settings.yandex_translate_api_key}"},
                    json={
                        "folderId": settings.yandex_translate_folder_id,
                        "texts": texts,
                        "targetLanguageCode": self.target_lang,
                        "sourceLanguageCode": self.source_lang,
                    },
                )
        except httpx.HTTPError:
            logger.exception("Yandex Translate request failed")
            return texts

        if response.status_code >= 400:
            logger.warning("Yandex Translate error %s: %s", response.status_code, response.text[:500])
            return texts

        data = response.json()
        translations = data.get("translations")
        if not isinstance(translations, list):
            return texts

        result: list[str] = []
        for index, item in enumerate(translations):
            if isinstance(item, dict) and isinstance(item.get("text"), str) and item["text"].strip():
                result.append(item["text"].strip())
            elif index < len(texts):
                result.append(texts[index])
        while len(result) < len(texts):
            result.append(texts[len(result)])
        return result

    @staticmethod
    def _english_name(dish: MealDishPreview) -> str:
        if isinstance(dish.name_en, str) and dish.name_en.strip():
            return dish.name_en.strip()
        return dish.name.strip()

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meal_entry import AthleteMealEntry
from app.models.user import AthleteProfile
from app.schemas.athlete_meals import (
    AthleteMealCreateRequest,
    AthleteMealEntryResponse,
    AthleteMealListResponse,
    MealAnalysisResponse,
    MealConfirmRequest,
    MealDishPreview,
    MealDishSearchResponse,
)
from app.schemas.meal_catalog import MealCatalogStats
from app.services.food_translation import FoodTranslationService
from app.services.logmeal import LogMealService
from app.services.logmeal_catalog import LogMealCatalogService

MEAL_HISTORY_DAYS = 30
MEAL_HISTORY_LIMIT = 200


def _athlete_now(profile: AthleteProfile) -> datetime:
    tz_name = profile.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    return datetime.now(tz)


class AthleteMealsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_entries(
        self,
        profile: AthleteProfile,
        *,
        limit: int = MEAL_HISTORY_LIMIT,
        days: int = MEAL_HISTORY_DAYS,
    ) -> AthleteMealListResponse:
        since = _athlete_now(profile) - timedelta(days=days)
        result = await self.db.execute(
            select(AthleteMealEntry)
            .where(
                AthleteMealEntry.athlete_id == profile.id,
                AthleteMealEntry.entry_at >= since,
            )
            .order_by(AthleteMealEntry.entry_at.desc())
            .limit(limit)
        )
        entries = result.scalars().all()
        return AthleteMealListResponse(
            entries=[AthleteMealEntryResponse.model_validate(item) for item in entries],
        )

    async def analyze_photo(self, profile: AthleteProfile, image_bytes: bytes) -> MealAnalysisResponse:
        analysis = await LogMealService(self.db).analyze_photo(profile, image_bytes)
        return await FoodTranslationService(self.db).localize_analysis(analysis)

    async def search_dishes(
        self,
        query: str,
        *,
        limit: int = 20,
    ) -> MealDishSearchResponse:
        return await LogMealCatalogService(self.db).search(query, limit=limit)

    async def get_catalog_stats(self) -> MealCatalogStats:
        return await LogMealCatalogService(self.db).get_stats()

    async def get_dish_nutrition(self, profile: AthleteProfile, logmeal_dish_id: int) -> MealDishPreview:
        catalog = LogMealCatalogService(self.db)
        cached = await catalog.get_cached_dish_nutrition(logmeal_dish_id)
        if cached is not None:
            localized = await FoodTranslationService(self.db).localize_dish_previews([cached])
            return localized[0]

        dish = await LogMealService(self.db).get_nutrition_for_class_id(profile, logmeal_dish_id)
        await catalog.save_dish_nutrition_cache(logmeal_dish_id, dish)
        localized = await FoodTranslationService(self.db).localize_dish_previews([dish])
        return localized[0]

    async def confirm_dishes(self, profile: AthleteProfile, data: MealConfirmRequest) -> MealAnalysisResponse:
        items = [(item.food_item_position, item.logmeal_dish_id) for item in data.items]
        analysis = await LogMealService(self.db).confirm_dishes_and_refresh(
            profile,
            logmeal_image_id=data.logmeal_image_id,
            segmentation=data.segmentation,
            items=items,
        )
        return await FoodTranslationService(self.db).localize_analysis(analysis)

    async def create_entry(
        self,
        profile: AthleteProfile,
        data: AthleteMealCreateRequest,
    ) -> AthleteMealEntryResponse:
        entry_at = data.entry_at or _athlete_now(profile)
        if entry_at.tzinfo is None:
            entry_at = entry_at.replace(tzinfo=UTC)

        entry = AthleteMealEntry(
            athlete_id=profile.id,
            entry_at=entry_at,
            calories_kcal=round(data.calories_kcal, 1),
            title=data.title.strip() if data.title else None,
            weight_g=round(data.weight_g, 1) if data.weight_g is not None else None,
            protein_g=round(data.protein_g, 1) if data.protein_g is not None else None,
            carbs_g=round(data.carbs_g, 1) if data.carbs_g is not None else None,
            fat_g=round(data.fat_g, 1) if data.fat_g is not None else None,
            source=data.source,
            logmeal_image_id=data.logmeal_image_id,
            ai_analysis=data.ai_analysis,
            notes=data.notes.strip() if data.notes else None,
        )
        self.db.add(entry)
        if data.source == "ai":
            await FoodTranslationService(self.db).record_user_overrides(data.ai_analysis)
        await self.db.flush()
        return AthleteMealEntryResponse.model_validate(entry)

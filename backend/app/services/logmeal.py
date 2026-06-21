from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.token_crypto import decrypt_secret, encrypt_secret
from app.models.health import HealthConnection
from app.models.user import AthleteProfile
from app.schemas.athlete_meals import MealAnalysisResponse, MealDishPreview

LOGMEAL_PROVIDER = "logmeal"
LOGMEAL_BASE_URL = "https://api.logmeal.com"
MEAL_PHOTO_MAX_SIDE_PX = 1280


class LogMealService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _require_company_key(self) -> str:
        if not settings.logmeal_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="LogMeal не настроен: добавьте LOGMEAL_API_KEY в backend/.env",
            )
        return settings.logmeal_api_key

    async def _get_connection(self, profile: AthleteProfile) -> HealthConnection | None:
        result = await self.db.execute(
            select(HealthConnection).where(
                HealthConnection.athlete_id == profile.id,
                HealthConnection.provider == LOGMEAL_PROVIDER,
            )
        )
        return result.scalar_one_or_none()

    async def _ensure_api_user(self, profile: AthleteProfile) -> str:
        if settings.logmeal_use_shared_user:
            return self._require_company_key()

        connection = await self._get_connection(profile)
        if connection is not None:
            return decrypt_secret(connection.access_token_encrypted)

        company_key = self._require_company_key()
        username = f"sport-{profile.id}"
        payload = {"username": username, "language": settings.logmeal_language}

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{LOGMEAL_BASE_URL}/v2/users/signup",
                    headers={"Authorization": f"Bearer {company_key}"},
                    json=payload,
                )
            except httpx.HTTPError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Не удалось связаться с LogMeal",
                ) from exc

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_logmeal_error_message(response, "Не удалось создать пользователя LogMeal"),
            )

        data = response.json()
        token = data.get("token")
        user_id = data.get("id")
        if not isinstance(token, str) or not token:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LogMeal вернул неожиданный ответ при регистрации пользователя",
            )

        connection = HealthConnection(
            athlete_id=profile.id,
            provider=LOGMEAL_PROVIDER,
            external_user_id=str(user_id) if user_id is not None else None,
            access_token_encrypted=encrypt_secret(token),
        )
        self.db.add(connection)
        await self.db.flush()
        return token

    async def analyze_photo(self, profile: AthleteProfile, image_bytes: bytes) -> MealAnalysisResponse:
        user_token = await self._ensure_api_user(profile)
        language = settings.logmeal_language

        async with httpx.AsyncClient(timeout=60.0) as client:
            segmentation = await self._post_segmentation(client, user_token, image_bytes, language)
            image_id = segmentation.get("imageId")
            if not isinstance(image_id, int):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="LogMeal не распознал блюдо на фото",
                )

            nutrition = await self._post_nutrition(client, user_token, image_id, language)

        return _build_analysis_response(segmentation, nutrition)

    async def _post_segmentation(
        self,
        client: httpx.AsyncClient,
        user_token: str,
        image_bytes: bytes,
        language: str,
    ) -> dict[str, Any]:
        try:
            response = await client.post(
                f"{LOGMEAL_BASE_URL}/v2/image/segmentation/complete",
                params={"language": language},
                headers={"Authorization": f"Bearer {user_token}"},
                files={"image": ("meal.jpg", image_bytes, "image/jpeg")},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось отправить фото в LogMeal",
            ) from exc

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_logmeal_error_message(response, "LogMeal не смог распознать фото"),
            )

        data = response.json()
        if not isinstance(data, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LogMeal вернул неожиданный ответ распознавания",
            )
        return data

    async def _post_nutrition(
        self,
        client: httpx.AsyncClient,
        user_token: str,
        image_id: int,
        language: str,
    ) -> dict[str, Any]:
        try:
            response = await client.post(
                f"{LOGMEAL_BASE_URL}/v2/nutrition/recipe/nutritionalInfo",
                params={"language": language},
                headers={
                    "Authorization": f"Bearer {user_token}",
                    "Content-Type": "application/json",
                },
                json={"imageId": image_id},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось получить питательность из LogMeal",
            ) from exc

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_logmeal_error_message(response, "LogMeal не вернул данные о питательности"),
            )

        data = response.json()
        if not isinstance(data, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LogMeal вернул неожиданный ответ о питательности",
            )
        return data


def _logmeal_error_message(response: httpx.Response, fallback: str) -> str:
    try:
        body = response.json()
        if isinstance(body, dict):
            for key in ("message", "error", "detail"):
                value = body.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
    except ValueError:
        pass
    return fallback


def _build_analysis_response(segmentation: dict[str, Any], nutrition: dict[str, Any]) -> MealAnalysisResponse:
    image_id = segmentation.get("imageId")
    dishes = _extract_dishes(segmentation)
    title = _extract_title(nutrition, dishes)
    calories = _extract_calories(nutrition)
    protein = _extract_nutrient(nutrition, "PROCNT")
    carbs = _extract_nutrient(nutrition, "CHOCDF")
    fat = _extract_nutrient(nutrition, "FAT")
    weight = _extract_weight(segmentation)

    if calories is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LogMeal не смог определить калорийность. Попробуйте другое фото или введите вручную.",
        )

    summary_parts = [f"Распознано: {title}", f"Калории: {round(calories)} ккал"]
    if protein is not None:
        summary_parts.append(f"Б: {round(protein, 1)} г")
    if fat is not None:
        summary_parts.append(f"Ж: {round(fat, 1)} г")
    if carbs is not None:
        summary_parts.append(f"У: {round(carbs, 1)} г")
    if weight is not None:
        summary_parts.append(f"Вес: {round(weight)} г")

    return MealAnalysisResponse(
        logmeal_image_id=image_id if isinstance(image_id, int) else None,
        title=title,
        calories_kcal=round(calories, 1),
        weight_g=round(weight, 1) if weight is not None else None,
        protein_g=round(protein, 1) if protein is not None else None,
        carbs_g=round(carbs, 1) if carbs is not None else None,
        fat_g=round(fat, 1) if fat is not None else None,
        dishes=dishes,
        summary=" · ".join(summary_parts),
        raw={
            "segmentation": segmentation,
            "nutrition": nutrition,
        },
    )


def _extract_dishes(segmentation: dict[str, Any]) -> list[MealDishPreview]:
    dishes: list[MealDishPreview] = []
    segments = segmentation.get("segmentation_results")
    if not isinstance(segments, list):
        return dishes

    for segment in segments:
        if not isinstance(segment, dict):
            continue
        results = segment.get("recognition_results")
        if not isinstance(results, list) or not results:
            continue
        top = results[0]
        if not isinstance(top, dict):
            continue
        name = top.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        prob = top.get("prob")
        confidence = float(prob) if isinstance(prob, (int, float)) else None
        dishes.append(MealDishPreview(name=name.strip(), confidence=confidence))
    return dishes


def _extract_title(nutrition: dict[str, Any], dishes: list[MealDishPreview]) -> str:
    food_name = nutrition.get("foodName")
    if isinstance(food_name, str) and food_name.strip():
        return food_name.strip()
    if isinstance(food_name, list):
        names = [item.strip() for item in food_name if isinstance(item, str) and item.strip()]
        if names:
            return ", ".join(names)
    if dishes:
        return ", ".join(dish.name for dish in dishes)
    return "Блюдо"


def _extract_calories(nutrition: dict[str, Any]) -> float | None:
    nutritional_info = nutrition.get("nutritional_info")
    if isinstance(nutritional_info, dict):
        calories = nutritional_info.get("calories")
        if isinstance(calories, (int, float)):
            return float(calories)
        kcal = _extract_nutrient({"nutritional_info": nutritional_info}, "ENERC_KCAL")
        if kcal is not None:
            return kcal
    return _extract_nutrient(nutrition, "ENERC_KCAL")


def _extract_nutrient(payload: dict[str, Any], code: str) -> float | None:
    nutritional_info = payload.get("nutritional_info")
    if not isinstance(nutritional_info, dict):
        nutritional_info = payload
    total = nutritional_info.get("totalNutrients")
    if not isinstance(total, dict):
        return None
    item = total.get(code)
    if not isinstance(item, dict):
        return None
    quantity = item.get("quantity")
    if isinstance(quantity, (int, float)):
        return float(quantity)
    return None


def _extract_weight(segmentation: dict[str, Any]) -> float | None:
    segments = segmentation.get("segmentation_results")
    if not isinstance(segments, list):
        return None

    total = 0.0
    found = False
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        serving = segment.get("serving_size")
        if isinstance(serving, (int, float)) and serving > 0:
            total += float(serving)
            found = True
    return total if found else None

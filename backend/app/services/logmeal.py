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

    def _require_logmeal_config(self) -> None:
        if not settings.logmeal_api_company_token and not settings.logmeal_api_user_token:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "LogMeal не настроен: добавьте LOGMEAL_API_COMPANY_TOKEN и LOGMEAL_API_USER_TOKEN "
                    "(или хотя бы LOGMEAL_API_USER_TOKEN) в .env"
                ),
            )

    def _require_company_token(self) -> str:
        self._require_logmeal_config()
        if not settings.logmeal_api_company_token:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Нужен LOGMEAL_API_COMPANY_TOKEN для создания APIUser в LogMeal",
            )
        return settings.logmeal_api_company_token

    async def _get_connection(self, profile: AthleteProfile) -> HealthConnection | None:
        result = await self.db.execute(
            select(HealthConnection).where(
                HealthConnection.athlete_id == profile.id,
                HealthConnection.provider == LOGMEAL_PROVIDER,
            )
        )
        return result.scalar_one_or_none()

    async def _ensure_api_user(self, profile: AthleteProfile) -> str:
        """Recognition endpoints require an APIUser token, not the company/admin key."""
        if settings.logmeal_api_user_token:
            return settings.logmeal_api_user_token

        connection = await self._get_connection(profile)
        if connection is not None:
            return decrypt_secret(connection.access_token_encrypted)

        return await self._signup_api_user(profile)

    async def _signup_api_user(self, profile: AthleteProfile) -> str:
        company_key = self._require_company_token()
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
    dishes, totals = _merge_dish_details(segmentation, nutrition)
    title = _extract_title(nutrition, dishes)

    calories = totals["calories_kcal"]
    weight = totals["weight_g"]
    protein = totals["protein_g"]
    carbs = totals["carbs_g"]
    fat = totals["fat_g"]
    raw_calories = totals["calories_kcal"]

    if calories is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LogMeal не смог определить калорийность. Попробуйте другое фото или введите вручную.",
        )

    weight_is_estimated = bool(totals["weight_is_estimated"])
    summary_parts = [f"Распознано: {title}", f"Калории: {round(calories)} ккал"]
    if protein is not None:
        summary_parts.append(f"Б: {round(protein, 1)} г")
    if fat is not None:
        summary_parts.append(f"Ж: {round(fat, 1)} г")
    if carbs is not None:
        summary_parts.append(f"У: {round(carbs, 1)} г")
    if weight is not None:
        summary_parts.append(f"Вес: ~{round(weight)} г")

    portion_note = (
        "LogMeal подставляет типичные порции из базы — поправьте вес каждого компонента, "
        "калории и БЖУ пересчитаются автоматически."
    )

    return MealAnalysisResponse(
        logmeal_image_id=image_id if isinstance(image_id, int) else None,
        title=title,
        calories_kcal=round(calories, 1),
        weight_g=round(weight, 1) if weight is not None else None,
        weight_is_estimated=weight_is_estimated,
        protein_g=round(protein, 1) if protein is not None else None,
        carbs_g=round(carbs, 1) if carbs is not None else None,
        fat_g=round(fat, 1) if fat is not None else None,
        logmeal_raw_calories_kcal=round(raw_calories, 1) if raw_calories is not None else None,
        baseline_weight_g=None,
        baseline_calories_kcal=None,
        baseline_protein_g=None,
        baseline_carbs_g=None,
        baseline_fat_g=None,
        calories_derived_from_weight=False,
        dishes=dishes,
        summary=" · ".join(summary_parts),
        portion_note=portion_note,
        raw={
            "logmeal_image_id": image_id if isinstance(image_id, int) else None,
            "segment_count": len(segmentation.get("segmentation_results") or [])
            if isinstance(segmentation.get("segmentation_results"), list)
            else 0,
            "dishes": [dish.model_dump() for dish in dishes],
        },
    )


def _item_nutrition_values(per_item: dict[str, Any]) -> dict[str, float | None]:
    item_nutrition = per_item.get("nutritional_info")
    if not isinstance(item_nutrition, dict):
        return {
            "calories_kcal": None,
            "weight_g": None,
            "protein_g": None,
            "carbs_g": None,
            "fat_g": None,
        }

    calories = item_nutrition.get("calories")
    calories_val = float(calories) if isinstance(calories, (int, float)) else None
    weight_val = per_item.get("serving_size")
    weight = float(weight_val) if isinstance(weight_val, (int, float)) and weight_val > 0 else None
    return {
        "calories_kcal": calories_val,
        "weight_g": weight,
        "protein_g": _extract_nutrient(per_item, "PROCNT"),
        "carbs_g": _extract_nutrient(per_item, "CHOCDF"),
        "fat_g": _extract_nutrient(per_item, "FAT"),
    }


def _normalize_food_position(value: Any) -> int | str | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        if stripped.isdigit():
            return int(stripped)
        return stripped
    return None


def _nutrition_id_name_map(nutrition: dict[str, Any]) -> dict[int, str]:
    food_names = nutrition.get("foodName")
    ids = nutrition.get("ids")
    result: dict[int, str] = {}

    if isinstance(food_names, list) and isinstance(ids, list):
        for name, dish_id in zip(food_names, ids, strict=False):
            if isinstance(dish_id, int) and isinstance(name, str) and name.strip():
                result[dish_id] = name.strip()
        return result

    if isinstance(food_names, str) and food_names.strip():
        if isinstance(ids, list):
            for dish_id in ids:
                if isinstance(dish_id, int):
                    result[dish_id] = food_names.strip()
                    break
        elif isinstance(ids, int):
            result[ids] = food_names.strip()

    return result


def _dish_preview_from_parts(
    *,
    name: str,
    logmeal_dish_id: int | None,
    confidence: float | None,
    per_item: dict[str, Any],
    segment: dict[str, Any] | None = None,
) -> MealDishPreview:
    item_values = _item_nutrition_values(per_item)
    item_weight = item_values["weight_g"]

    if segment is not None:
        segment_weight = segment.get("serving_size")
        if item_weight is None and isinstance(segment_weight, (int, float)) and segment_weight > 0:
            item_weight = float(segment_weight)

    return MealDishPreview(
        name=name,
        name_en=name,
        logmeal_dish_id=logmeal_dish_id,
        confidence=confidence,
        weight_g=round(item_weight, 1) if item_weight is not None else None,
        calories_kcal=round(item_values["calories_kcal"], 1)
        if item_values["calories_kcal"] is not None
        else None,
        protein_g=round(item_values["protein_g"], 1) if item_values["protein_g"] is not None else None,
        carbs_g=round(item_values["carbs_g"], 1) if item_values["carbs_g"] is not None else None,
        fat_g=round(item_values["fat_g"], 1) if item_values["fat_g"] is not None else None,
    )


def _fill_missing_item_nutrition(
    dishes: list[MealDishPreview],
    nutrition: dict[str, Any],
) -> list[MealDishPreview]:
    total_calories = _extract_calories(nutrition)
    if total_calories is None or not dishes:
        return dishes

    missing = [dish for dish in dishes if dish.calories_kcal is None]
    if not missing:
        return dishes

    known_calories = sum(dish.calories_kcal or 0 for dish in dishes if dish.calories_kcal is not None)
    remaining_calories = max(0.0, total_calories - known_calories)
    missing_weight_sum = sum(
        dish.weight_g if dish.weight_g is not None and dish.weight_g > 0 else 100.0 for dish in missing
    )
    if missing_weight_sum <= 0:
        missing_weight_sum = float(len(missing) * 100)

    filled: list[MealDishPreview] = []
    for dish in dishes:
        if dish.calories_kcal is not None:
            filled.append(dish)
            continue

        weight = dish.weight_g if dish.weight_g is not None and dish.weight_g > 0 else 100.0
        share = weight / missing_weight_sum
        filled.append(
            dish.model_copy(
                update={
                    "weight_g": round(weight, 1),
                    "calories_kcal": round(remaining_calories * share, 1),
                },
            ),
        )
    return filled


def _merge_dish_details(
    segmentation: dict[str, Any],
    nutrition: dict[str, Any],
) -> tuple[list[MealDishPreview], dict[str, float | bool | None]]:
    segments = segmentation.get("segmentation_results")
    if not isinstance(segments, list):
        segments = []

    per_items = nutrition.get("nutritional_info_per_item")
    per_by_position: dict[int | str, dict[str, Any]] = {}
    if isinstance(per_items, list):
        for item in per_items:
            if isinstance(item, dict):
                position = _normalize_food_position(item.get("food_item_position"))
                if position is not None:
                    per_by_position[position] = item

    id_to_name = _nutrition_id_name_map(nutrition)
    dishes: list[MealDishPreview] = []
    seen_positions: set[int | str] = set()
    per_item_weight_sum = 0.0
    has_per_item_weight = False

    for segment in segments:
        if not isinstance(segment, dict):
            continue

        position = _normalize_food_position(segment.get("food_item_position"))
        if position is None:
            continue

        per_item = per_by_position.get(position, {})
        results = segment.get("recognition_results")
        if not isinstance(results, list) or not results:
            continue

        top = results[0]
        if not isinstance(top, dict):
            continue

        name = top.get("name")
        if not isinstance(name, str) or not name.strip():
            continue

        dish_id = top.get("id")
        logmeal_dish_id = dish_id if isinstance(dish_id, int) else None
        prob = top.get("prob")
        confidence = float(prob) if isinstance(prob, (int, float)) else None

        dish = _dish_preview_from_parts(
            name=name.strip(),
            logmeal_dish_id=logmeal_dish_id,
            confidence=confidence,
            per_item=per_item,
            segment=segment,
        )
        if dish.weight_g is not None:
            per_item_weight_sum += dish.weight_g
            has_per_item_weight = True

        dishes.append(dish)
        seen_positions.add(position)

    for position, per_item in per_by_position.items():
        if position in seen_positions:
            continue

        dish_id = per_item.get("id")
        logmeal_dish_id = dish_id if isinstance(dish_id, int) else None
        name = id_to_name.get(logmeal_dish_id) if logmeal_dish_id is not None else None
        if not isinstance(name, str) or not name.strip():
            continue

        dish = _dish_preview_from_parts(
            name=name.strip(),
            logmeal_dish_id=logmeal_dish_id,
            confidence=None,
            per_item=per_item,
        )
        if dish.weight_g is not None:
            per_item_weight_sum += dish.weight_g
            has_per_item_weight = True

        dishes.append(dish)
        seen_positions.add(position)

    dishes = _fill_missing_item_nutrition(dishes, nutrition)

    calories = _extract_calories(nutrition)
    protein = _extract_nutrient(nutrition, "PROCNT")
    carbs = _extract_nutrient(nutrition, "CHOCDF")
    fat = _extract_nutrient(nutrition, "FAT")

    top_level_weight = nutrition.get("serving_size")
    weight: float | None = None
    if isinstance(top_level_weight, (int, float)) and top_level_weight > 0:
        weight = float(top_level_weight)
    elif has_per_item_weight:
        weight = per_item_weight_sum

    has_detected_segment_weight = any(
        isinstance(segment, dict)
        and isinstance(segment.get("serving_size"), (int, float))
        and segment.get("serving_size") > 0
        for segment in segments
    )
    weight_is_estimated = weight is not None and not has_detected_segment_weight

    return dishes, {
        "calories_kcal": calories,
        "weight_g": weight,
        "protein_g": protein,
        "carbs_g": carbs,
        "fat_g": fat,
        "weight_is_estimated": weight_is_estimated,
    }


def _extract_title(nutrition: dict[str, Any], dishes: list[MealDishPreview]) -> str:
    if dishes:
        return ", ".join(dish.name for dish in dishes)

    food_name = nutrition.get("foodName")
    if isinstance(food_name, str) and food_name.strip():
        return food_name.strip()
    if isinstance(food_name, list):
        names = [item.strip() for item in food_name if isinstance(item, str) and item.strip()]
        if names:
            return ", ".join(names)
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

from datetime import UTC, datetime

from app.models.logmeal_dish_catalog import LogMealDishCatalog
from app.services.logmeal_catalog import (
    _dish_preview_from_catalog_cache,
    _has_nutrition_cache,
    _parse_catalog_portion_size,
)


def test_parse_catalog_portion_size_accepts_numbers() -> None:
    assert _parse_catalog_portion_size(250) == 250.0
    assert _parse_catalog_portion_size(100.5) == 100.5


def test_parse_catalog_portion_size_accepts_numeric_strings() -> None:
    assert _parse_catalog_portion_size("250") == 250.0
    assert _parse_catalog_portion_size("100,5") == 100.5


def test_parse_catalog_portion_size_rejects_empty_and_invalid() -> None:
    assert _parse_catalog_portion_size(None) is None
    assert _parse_catalog_portion_size("") is None
    assert _parse_catalog_portion_size("abc") is None
    assert _parse_catalog_portion_size(0) is None
    assert _parse_catalog_portion_size(True) is None


def test_has_nutrition_cache_requires_timestamp_and_calories() -> None:
    row = LogMealDishCatalog(
        logmeal_id=1,
        name_en="rice",
        dish_type="food",
        cached_calories_kcal=200,
        nutrition_cached_at=None,
    )
    assert _has_nutrition_cache(row) is False

    row.nutrition_cached_at = datetime.now(UTC)
    assert _has_nutrition_cache(row) is True


def test_dish_preview_from_catalog_cache_uses_russian_name() -> None:
    row = LogMealDishCatalog(
        logmeal_id=42,
        name_en="buckwheat",
        name_ru="Гречка",
        dish_type="food",
        cached_weight_g=150,
        cached_calories_kcal=165,
        cached_protein_g=6.0,
        cached_carbs_g=30.0,
        cached_fat_g=1.5,
        nutrition_cached_at=datetime.now(UTC),
    )
    preview = _dish_preview_from_catalog_cache(row)
    assert preview.name == "Гречка"
    assert preview.logmeal_dish_id == 42
    assert preview.weight_g == 150
    assert preview.calories_kcal == 165

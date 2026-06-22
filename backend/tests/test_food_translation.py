from app.schemas.athlete_meals import MealDishPreview
from app.services.food_translation import FoodTranslationService


def test_english_name_prefers_name_en() -> None:
    dish = MealDishPreview(name="Гречка", name_en="buckwheat", logmeal_dish_id=42)
    assert FoodTranslationService._english_name(dish) == "buckwheat"


def test_english_name_falls_back_to_name() -> None:
    dish = MealDishPreview(name="buckwheat", logmeal_dish_id=42)
    assert FoodTranslationService._english_name(dish) == "buckwheat"

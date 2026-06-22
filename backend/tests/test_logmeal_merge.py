"""Tests for LogMeal segmentation + nutrition merge logic."""

from app.schemas.athlete_meals import MealDishPreview
from app.services.logmeal import _extract_title, _merge_dish_details


def test_merge_multiple_segments_with_per_item_nutrition() -> None:
    segmentation = {
        "segmentation_results": [
            {
                "food_item_position": 1,
                "serving_size": 120,
                "recognition_results": [{"id": 10, "name": "potatoes", "prob": 0.9}],
            },
            {
                "food_item_position": 2,
                "serving_size": 80,
                "recognition_results": [{"id": 20, "name": "fried mushrooms", "prob": 0.85}],
            },
        ],
    }
    nutrition = {
        "foodName": ["potatoes", "fried mushrooms"],
        "ids": [10, 20],
        "nutritional_info": {"calories": 350},
        "nutritional_info_per_item": [
            {
                "food_item_position": 1,
                "id": 10,
                "serving_size": 120,
                "nutritional_info": {"calories": 200, "totalNutrients": {}},
            },
            {
                "food_item_position": 2,
                "id": 20,
                "serving_size": 80,
                "nutritional_info": {"calories": 150, "totalNutrients": {}},
            },
        ],
    }

    dishes, totals = _merge_dish_details(segmentation, nutrition)

    assert len(dishes) == 2
    assert [dish.name for dish in dishes] == ["potatoes", "fried mushrooms"]
    assert dishes[0].calories_kcal == 200
    assert dishes[1].calories_kcal == 150
    assert totals["calories_kcal"] == 350


def test_merge_position_key_string_vs_int() -> None:
    segmentation = {
        "segmentation_results": [
            {
                "food_item_position": 1,
                "recognition_results": [{"id": 10, "name": "potatoes", "prob": 0.9}],
            },
        ],
    }
    nutrition = {
        "foodName": ["potatoes"],
        "ids": [10],
        "nutritional_info": {"calories": 200},
        "nutritional_info_per_item": [
            {
                "food_item_position": "1",
                "id": 10,
                "serving_size": 150,
                "nutritional_info": {"calories": 200, "totalNutrients": {}},
            },
        ],
    }

    dishes, _ = _merge_dish_details(segmentation, nutrition)

    assert len(dishes) == 1
    assert dishes[0].weight_g == 150
    assert dishes[0].calories_kcal == 200


def test_merge_adds_nutrition_only_item_not_in_segmentation() -> None:
    segmentation = {
        "segmentation_results": [
            {
                "food_item_position": 1,
                "recognition_results": [{"id": 10, "name": "potatoes", "prob": 0.9}],
            },
        ],
    }
    nutrition = {
        "foodName": ["potatoes", "fried mushrooms"],
        "ids": [10, 20],
        "nutritional_info": {"calories": 350},
        "nutritional_info_per_item": [
            {
                "food_item_position": 1,
                "id": 10,
                "serving_size": 120,
                "nutritional_info": {"calories": 200, "totalNutrients": {}},
            },
            {
                "food_item_position": 2,
                "id": 20,
                "serving_size": 80,
                "nutritional_info": {"calories": 150, "totalNutrients": {}},
            },
        ],
    }

    dishes, _ = _merge_dish_details(segmentation, nutrition)

    assert len(dishes) == 2
    assert {dish.name for dish in dishes} == {"potatoes", "fried mushrooms"}


def test_merge_fills_missing_calories_from_total() -> None:
    segmentation = {
        "segmentation_results": [
            {
                "food_item_position": 1,
                "serving_size": 100,
                "recognition_results": [{"id": 10, "name": "potatoes", "prob": 0.9}],
            },
            {
                "food_item_position": 2,
                "serving_size": 100,
                "recognition_results": [{"id": 20, "name": "fried mushrooms", "prob": 0.8}],
            },
        ],
    }
    nutrition = {
        "foodName": ["potatoes", "fried mushrooms"],
        "ids": [10, 20],
        "nutritional_info": {"calories": 300},
        "nutritional_info_per_item": [
            {
                "food_item_position": 1,
                "id": 10,
                "serving_size": 100,
                "nutritional_info": {"calories": 180, "totalNutrients": {}},
            },
        ],
    }

    dishes, _ = _merge_dish_details(segmentation, nutrition)

    assert len(dishes) == 2
    assert dishes[0].calories_kcal == 180
    assert dishes[1].calories_kcal == 120


def test_extract_title_prefers_dish_list_over_single_food_name() -> None:
    dishes = [
        MealDishPreview(name="potatoes", logmeal_dish_id=10),
        MealDishPreview(name="fried mushrooms", logmeal_dish_id=20),
    ]
    nutrition = {"foodName": "potatoes"}

    assert _extract_title(nutrition, dishes) == "potatoes, fried mushrooms"

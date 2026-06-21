from datetime import date

from app.models.enums import Gender
from app.models.user import AthleteProfile

# Sedentary activity factor (office work, minimal movement).
SEDENTARY_ACTIVITY_FACTOR = 1.2
DEFAULT_BASELINE_ACTIVITY_MIN = 30
ESTIMATED_BMI = 22.5


def _calculate_age(birth_date: date | None, today: date) -> int:
    if birth_date is None:
        return 30
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return max(age, 14)


def _estimate_height_cm(weight_kg: float) -> float:
    height_m = (weight_kg / ESTIMATED_BMI) ** 0.5
    return height_m * 100


def calculate_bmr_kcal(
    profile: AthleteProfile,
    weight_kg: float,
    *,
    today: date | None = None,
) -> float:
    """Mifflin–St Jeor BMR; height estimated from weight (BMI ~22.5)."""
    reference_date = today or date.today()
    age = _calculate_age(profile.birth_date, reference_date)
    height_cm = _estimate_height_cm(weight_kg)

    if profile.gender == Gender.female:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5

    return round(max(bmr, 800), 1)


def calculate_daily_baseline_calories_kcal(
    profile: AthleteProfile,
    weight_kg: float,
    *,
    today: date | None = None,
) -> float:
    """Mifflin–St Jeor BMR × sedentary PAL (1.2)."""
    bmr = calculate_bmr_kcal(profile, weight_kg, today=today)
    return round(bmr * SEDENTARY_ACTIVITY_FACTOR, 1)


def calculate_target_daily_calories_kcal(
    profile: AthleteProfile,
    weight_kg: float,
    pal: float,
    *,
    today: date | None = None,
) -> float:
    """Target TDEE = BMR × activity-tier PAL."""
    bmr = calculate_bmr_kcal(profile, weight_kg, today=today)
    return round(bmr * pal, 1)

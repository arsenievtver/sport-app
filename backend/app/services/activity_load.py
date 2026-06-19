ACTIVITY_EFFORT_MIN = 1
ACTIVITY_EFFORT_MAX = 10

EFFORT_MET_MULTIPLIER_MIN = 0.65
EFFORT_MET_MULTIPLIER_MAX = 1.45


def clamp_activity_effort(value: int) -> int:
    return max(ACTIVITY_EFFORT_MIN, min(ACTIVITY_EFFORT_MAX, round(value)))


def effort_met_multiplier(effort: int) -> float:
    clamped = clamp_activity_effort(effort)
    return EFFORT_MET_MULTIPLIER_MIN + (clamped - ACTIVITY_EFFORT_MIN) * (
        EFFORT_MET_MULTIPLIER_MAX - EFFORT_MET_MULTIPLIER_MIN
    ) / (ACTIVITY_EFFORT_MAX - ACTIVITY_EFFORT_MIN)


def calculate_effective_met(base_met: float, effort: int) -> float:
    return round(base_met * effort_met_multiplier(effort), 2)


def calculate_load_met_minutes(base_met: float, duration_min: int, effort: int) -> float:
    return round(calculate_effective_met(base_met, effort) * duration_min, 1)


def calculate_workout_calories(
    effective_met: float,
    duration_min: int,
    weight_kg: float,
) -> float:
    """kcal ≈ MET × weight(kg) × hours (Compendium)."""
    return round(effective_met * weight_kg * (duration_min / 60), 1)

from dataclasses import dataclass

from app.models.enums import PlanActivityTier

# PAL — physical activity level multipliers (FAO/WHO energy requirements).
SEDENTARY_PAL = 1.2


@dataclass(frozen=True)
class ActivityTierSpec:
    pal: float
    weekly_activity_min: int
    description_ru: str


TIER_SPECS: dict[PlanActivityTier, ActivityTierSpec] = {
    PlanActivityTier.light: ActivityTierSpec(
        pal=1.375,
        weekly_activity_min=150,
        description_ru="Минимум ВОЗ: ~150 мин умеренной активности в неделю",
    ),
    PlanActivityTier.moderate: ActivityTierSpec(
        pal=1.55,
        weekly_activity_min=225,
        description_ru="Между минимумом и верхней границей рекомендаций ВОЗ",
    ),
    PlanActivityTier.active: ActivityTierSpec(
        pal=1.725,
        weekly_activity_min=300,
        description_ru="Верхняя граница ВОЗ для существенной пользы (~300 мин/нед)",
    ),
    PlanActivityTier.very_active: ActivityTierSpec(
        pal=1.9,
        weekly_activity_min=450,
        description_ru="Повышенный уровень для спортивного образа жизни",
    ),
}

DEFAULT_ACTIVITY_TIER = PlanActivityTier.moderate


def resolve_activity_tier(value: PlanActivityTier | str | None) -> PlanActivityTier:
    if value is None:
        return DEFAULT_ACTIVITY_TIER
    if isinstance(value, PlanActivityTier):
        return value
    try:
        return PlanActivityTier(value)
    except ValueError:
        return DEFAULT_ACTIVITY_TIER


def get_tier_spec(tier: PlanActivityTier | str | None) -> ActivityTierSpec:
    return TIER_SPECS[resolve_activity_tier(tier)]

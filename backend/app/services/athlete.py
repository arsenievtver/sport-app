from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AthleteProfile
from app.schemas.athlete import AthleteOnboardingRequest, AthleteProfileResponse


class AthleteService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def complete_onboarding(
        self,
        profile: AthleteProfile,
        data: AthleteOnboardingRequest,
    ) -> AthleteProfileResponse:
        profile.gender = data.gender
        profile.birth_date = data.birth_date
        profile.focus_strength = data.focus_strength
        profile.focus_flexibility = data.focus_flexibility
        profile.focus_endurance = data.focus_endurance
        profile.focus_coordination = data.focus_coordination
        profile.weight_target_min_kg = data.weight_target_min_kg
        profile.weight_target_max_kg = data.weight_target_max_kg
        profile.personal_goal_title = data.personal_goal_title
        profile.personal_goal_target = data.personal_goal_target
        profile.onboarding_completed_at = datetime.now(UTC)
        await self.db.flush()
        return AthleteProfileResponse.model_validate(profile)

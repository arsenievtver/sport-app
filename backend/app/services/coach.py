from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import AthleteProfile, CoachAthleteLink, CoachProfile
from app.schemas.coach import CoachAthleteSummary


class CoachService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_athletes(self, coach_profile: CoachProfile) -> list[CoachAthleteSummary]:
        result = await self.db.execute(
            select(CoachAthleteLink)
            .where(CoachAthleteLink.coach_id == coach_profile.id)
            .options(selectinload(CoachAthleteLink.athlete))
            .order_by(CoachAthleteLink.created_at.desc())
        )
        links = result.scalars().all()
        summaries: list[CoachAthleteSummary] = []
        for link in links:
            athlete: AthleteProfile = link.athlete
            summaries.append(
                CoachAthleteSummary(
                    athlete_id=athlete.id,
                    display_name=athlete.display_name,
                    link_status=link.status,
                    gender=athlete.gender,
                    birth_date=athlete.birth_date,
                    focus_strength=athlete.focus_strength,
                    focus_flexibility=athlete.focus_flexibility,
                    focus_endurance=athlete.focus_endurance,
                    focus_coordination=athlete.focus_coordination,
                    weight_target_min_kg=athlete.weight_target_min_kg,
                    weight_target_max_kg=athlete.weight_target_max_kg,
                    personal_goal_title=athlete.personal_goal_title,
                    personal_goal_target=athlete.personal_goal_target,
                    onboarding_completed_at=athlete.onboarding_completed_at,
                )
            )
        return summaries

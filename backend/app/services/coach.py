from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import AthleteProfile, CoachAthleteLink, CoachProfile
from app.schemas.coach import CoachAthleteSessionsResponse, CoachAthleteSummary


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
        return [self._link_to_summary(link) for link in links]

    async def add_sessions(
        self,
        coach_profile: CoachProfile,
        athlete_id: UUID,
        count: int,
    ) -> CoachAthleteSessionsResponse:
        link = await self._get_link(coach_profile, athlete_id)
        link.sessions_balance += count
        await self.db.flush()
        return self._link_to_sessions_response(link)

    async def complete_session(
        self,
        coach_profile: CoachProfile,
        athlete_id: UUID,
    ) -> CoachAthleteSessionsResponse:
        link = await self._get_link(coach_profile, athlete_id)
        link.sessions_balance -= 1
        await self.db.flush()
        return self._link_to_sessions_response(link)

    async def _get_link(self, coach_profile: CoachProfile, athlete_id: UUID) -> CoachAthleteLink:
        result = await self.db.execute(
            select(CoachAthleteLink).where(
                CoachAthleteLink.coach_id == coach_profile.id,
                CoachAthleteLink.athlete_id == athlete_id,
            )
        )
        link = result.scalar_one_or_none()
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Атлет не найден")
        return link

    @staticmethod
    def _link_to_summary(link: CoachAthleteLink) -> CoachAthleteSummary:
        athlete: AthleteProfile = link.athlete
        return CoachAthleteSummary(
            athlete_id=athlete.id,
            link_id=link.id,
            display_name=athlete.display_name,
            avatar_url=athlete.avatar_url,
            link_status=link.status,
            sessions_balance=link.sessions_balance,
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

    @staticmethod
    def _link_to_sessions_response(link: CoachAthleteLink) -> CoachAthleteSessionsResponse:
        return CoachAthleteSessionsResponse(
            athlete_id=link.athlete_id,
            link_id=link.id,
            sessions_balance=link.sessions_balance,
        )

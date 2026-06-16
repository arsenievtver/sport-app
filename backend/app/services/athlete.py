from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import CoachAthleteLinkStatus
from app.models.user import AthleteProfile, CoachAthleteLink, CoachProfile
from app.schemas.athlete import (
    AthleteCoachResponse,
    AthleteOnboardingRequest,
    AthleteProfileResponse,
    AthleteProfileUpdateRequest,
    JoinCoachRequest,
)


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

    async def update_profile(
        self,
        profile: AthleteProfile,
        data: AthleteProfileUpdateRequest,
    ) -> AthleteProfileResponse:
        if data.display_name is not None:
            profile.display_name = data.display_name.strip()
        if data.gender is not None:
            profile.gender = data.gender
        if data.birth_date is not None:
            profile.birth_date = data.birth_date
        await self.db.flush()
        return AthleteProfileResponse.model_validate(profile)

    async def set_avatar_url(self, profile: AthleteProfile, avatar_url: str) -> AthleteProfileResponse:
        profile.avatar_url = avatar_url
        await self.db.flush()
        return AthleteProfileResponse.model_validate(profile)

    async def list_coaches(self, profile: AthleteProfile) -> list[AthleteCoachResponse]:
        result = await self.db.execute(
            select(CoachAthleteLink)
            .where(
                CoachAthleteLink.athlete_id == profile.id,
                CoachAthleteLink.status.in_(
                    [CoachAthleteLinkStatus.active, CoachAthleteLinkStatus.pending]
                ),
            )
            .options(selectinload(CoachAthleteLink.coach))
            .order_by(CoachAthleteLink.created_at)
        )
        links = result.scalars().all()
        return [self._coach_link_to_response(link) for link in links]

    async def join_coach(self, profile: AthleteProfile, data: JoinCoachRequest) -> AthleteCoachResponse:
        code = data.invite_code.strip().upper()
        if not code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Введите код приглашения")

        coach_result = await self.db.execute(select(CoachProfile).where(CoachProfile.invite_code == code))
        coach = coach_result.scalar_one_or_none()
        if coach is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тренер с таким кодом не найден")

        existing_result = await self.db.execute(
            select(CoachAthleteLink).where(
                CoachAthleteLink.coach_id == coach.id,
                CoachAthleteLink.athlete_id == profile.id,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            if existing.status in (CoachAthleteLinkStatus.active, CoachAthleteLinkStatus.pending):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Этот тренер уже добавлен")
            existing.status = CoachAthleteLinkStatus.active
            existing.started_at = datetime.now(UTC)
            existing.ended_at = None
            await self.db.flush()
            await self.db.refresh(existing, attribute_names=["coach"])
            return self._coach_link_to_response(existing)

        link = CoachAthleteLink(
            coach_id=coach.id,
            athlete_id=profile.id,
            status=CoachAthleteLinkStatus.active,
            started_at=datetime.now(UTC),
        )
        self.db.add(link)
        await self.db.flush()
        await self.db.refresh(link, attribute_names=["coach"])
        return self._coach_link_to_response(link)

    async def remove_coach(self, profile: AthleteProfile, link_id: UUID) -> None:
        result = await self.db.execute(
            select(CoachAthleteLink).where(
                CoachAthleteLink.id == link_id,
                CoachAthleteLink.athlete_id == profile.id,
            )
        )
        link = result.scalar_one_or_none()
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Связь с тренером не найдена")
        await self.db.delete(link)
        await self.db.flush()

    @staticmethod
    def _coach_link_to_response(link: CoachAthleteLink) -> AthleteCoachResponse:
        return AthleteCoachResponse(
            link_id=link.id,
            coach_id=link.coach_id,
            display_name=link.coach.display_name,
            avatar_url=link.coach.avatar_url,
            link_status=link.status,
            sessions_balance=link.sessions_balance,
        )

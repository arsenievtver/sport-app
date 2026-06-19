from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import CoachAthleteLinkStatus, CoachAthleteSessionEntryKind
from app.models.activity_type import ActivityType
from app.models.session_ledger import CoachAthleteSessionEntry
from app.models.user import AthleteProfile, CoachAthleteLink, CoachProfile
from app.services.athlete_preferences import remember_recent_activity_type
from app.services.activity_load import (
    calculate_effective_met,
    calculate_load_met_minutes,
    calculate_workout_calories,
    clamp_activity_effort,
)
from app.services.athlete_weight import AthleteWeightService
from app.schemas.athlete import (
    AthleteCoachResponse,
    AthleteCompleteSessionRequest,
    AthleteCompleteSessionResponse,
    AthleteLastSessionResponse,
    AthleteOnboardingRequest,
    AthleteProfileResponse,
    AthleteProfileUpdateRequest,
    AthleteSessionsStatsResponse,
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
            .options(
                selectinload(CoachAthleteLink.coach),
                selectinload(CoachAthleteLink.session_entries),
            )
            .order_by(CoachAthleteLink.created_at)
        )
        links = result.scalars().all()
        return [self._coach_link_to_response(link) for link in links]

    async def get_sessions_stats(self, profile: AthleteProfile) -> AthleteSessionsStatsResponse:
        completed = await self._count_completed_sessions(profile.id)
        return AthleteSessionsStatsResponse(sessions_completed=completed)

    async def get_last_completed_session(
        self,
        profile: AthleteProfile,
    ) -> AthleteLastSessionResponse | None:
        result = await self.db.execute(
            select(CoachAthleteSessionEntry)
            .join(CoachAthleteLink, CoachAthleteSessionEntry.link_id == CoachAthleteLink.id)
            .where(
                CoachAthleteLink.athlete_id == profile.id,
                CoachAthleteSessionEntry.kind == CoachAthleteSessionEntryKind.debit,
            )
            .options(
                selectinload(CoachAthleteSessionEntry.activity_type),
                selectinload(CoachAthleteSessionEntry.link).selectinload(CoachAthleteLink.coach),
            )
            .order_by(
                CoachAthleteSessionEntry.entry_date.desc(),
                CoachAthleteSessionEntry.created_at.desc(),
            )
            .limit(1)
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            return None

        activity_name = entry.activity_type.name_ru if entry.activity_type is not None else None
        return AthleteLastSessionResponse(
            entry_date=entry.entry_date,
            activity_name=activity_name,
            duration_min=entry.duration_min,
            effort=entry.effort,
            effective_met=entry.effective_met,
            load_met_minutes=entry.load_met_minutes,
            weight_kg_used=entry.weight_kg_used,
            calories_kcal=entry.calories_kcal,
            coach_display_name=entry.link.coach.display_name,
        )

    async def complete_session(
        self,
        profile: AthleteProfile,
        data: AthleteCompleteSessionRequest,
    ) -> AthleteCompleteSessionResponse:
        links = await self._get_active_links(profile.id)
        if not links:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нет подключённого тренера",
            )

        link_id = data.link_id
        if link_id is not None:
            link = next((item for item in links if item.id == link_id), None)
            if link is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Связь с тренером не найдена",
                )
        elif len(links) == 1:
            link = links[0]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Укажите тренера — у вас несколько активных связей",
            )

        activity_type = await self._get_activity_type(data.activity_type_id)
        effort = clamp_activity_effort(data.effort)
        effective_met = calculate_effective_met(activity_type.met_value, effort)
        load_met_minutes = calculate_load_met_minutes(
            activity_type.met_value,
            data.duration_min,
            effort,
        )
        weight_kg = await AthleteWeightService(self.db).get_current_weight_kg(profile)
        calories_kcal = (
            calculate_workout_calories(effective_met, data.duration_min, weight_kg)
            if weight_kg is not None
            else None
        )

        link.sessions_balance -= 1
        entry = await self._record_session_entry(
            link,
            CoachAthleteSessionEntryKind.debit,
            1,
            activity_type_id=activity_type.id,
            duration_min=data.duration_min,
            effort=effort,
            effective_met=effective_met,
            load_met_minutes=load_met_minutes,
            weight_kg_used=weight_kg,
            calories_kcal=calories_kcal,
        )
        profile.recent_activity_type_ids = remember_recent_activity_type(
            profile.recent_activity_type_ids,
            activity_type.id,
        )
        await self.db.flush()

        return AthleteCompleteSessionResponse(
            link_id=link.id,
            sessions_balance=link.sessions_balance,
            sessions_completed=await self._count_completed_sessions(profile.id),
            activity_name=activity_type.name_ru,
            duration_min=entry.duration_min,
            effort=entry.effort,
            effective_met=entry.effective_met,
            load_met_minutes=entry.load_met_minutes,
            weight_kg_used=entry.weight_kg_used,
            calories_kcal=entry.calories_kcal,
        )

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
            await self.db.refresh(existing, attribute_names=["coach", "session_entries"])
            return self._coach_link_to_response(existing)

        link = CoachAthleteLink(
            coach_id=coach.id,
            athlete_id=profile.id,
            status=CoachAthleteLinkStatus.active,
            started_at=datetime.now(UTC),
        )
        self.db.add(link)
        await self.db.flush()
        await self.db.refresh(link, attribute_names=["coach", "session_entries"])
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

    async def _get_active_links(self, athlete_id: UUID) -> list[CoachAthleteLink]:
        result = await self.db.execute(
            select(CoachAthleteLink).where(
                CoachAthleteLink.athlete_id == athlete_id,
                CoachAthleteLink.status == CoachAthleteLinkStatus.active,
            )
        )
        return list(result.scalars().all())

    async def _count_completed_sessions(self, athlete_id: UUID) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.sum(CoachAthleteSessionEntry.sessions_count), 0))
            .select_from(CoachAthleteSessionEntry)
            .join(CoachAthleteLink, CoachAthleteSessionEntry.link_id == CoachAthleteLink.id)
            .where(
                CoachAthleteLink.athlete_id == athlete_id,
                CoachAthleteSessionEntry.kind == CoachAthleteSessionEntryKind.debit,
            )
        )
        return int(result.scalar_one())

    async def _get_activity_type(self, activity_type_id: UUID) -> ActivityType:
        result = await self.db.execute(
            select(ActivityType).where(
                ActivityType.id == activity_type_id,
                ActivityType.is_active.is_(True),
            )
        )
        activity_type = result.scalar_one_or_none()
        if activity_type is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Вид тренировки не найден",
            )
        return activity_type

    async def _record_session_entry(
        self,
        link: CoachAthleteLink,
        kind: CoachAthleteSessionEntryKind,
        sessions_count: int,
        *,
        activity_type_id: UUID | None = None,
        duration_min: int | None = None,
        effort: int | None = None,
        effective_met: float | None = None,
        load_met_minutes: float | None = None,
        weight_kg_used: float | None = None,
        calories_kcal: float | None = None,
    ) -> CoachAthleteSessionEntry:
        entry = CoachAthleteSessionEntry(
            link_id=link.id,
            kind=kind,
            sessions_count=sessions_count,
            entry_date=datetime.now(UTC).date(),
            activity_type_id=activity_type_id,
            duration_min=duration_min,
            effort=effort,
            effective_met=effective_met,
            load_met_minutes=load_met_minutes,
            weight_kg_used=weight_kg_used,
            calories_kcal=calories_kcal,
        )
        self.db.add(entry)
        return entry

    @staticmethod
    def _sessions_completed_from_link(link: CoachAthleteLink) -> int:
        return sum(
            entry.sessions_count
            for entry in link.session_entries
            if entry.kind == CoachAthleteSessionEntryKind.debit
        )

    @staticmethod
    def _coach_link_to_response(link: CoachAthleteLink) -> AthleteCoachResponse:
        return AthleteCoachResponse(
            link_id=link.id,
            coach_id=link.coach_id,
            display_name=link.coach.display_name,
            avatar_url=link.coach.avatar_url,
            link_status=link.status,
            sessions_balance=link.sessions_balance,
            sessions_completed=AthleteService._sessions_completed_from_link(link),
        )

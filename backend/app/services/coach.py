from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import CoachAthleteLinkStatus, CoachAthleteSessionEntryKind
from app.models.session_ledger import CoachAthleteSessionEntry
from app.models.user import AthleteProfile, CoachAthleteLink, CoachProfile
from app.schemas.auth import CoachProfileResponse
from app.schemas.coach import (
    CoachAthleteSessionHistoryEntry,
    CoachAthleteSessionsResponse,
    CoachAthleteSummary,
    CreateManagedAthleteRequest,
)


class CoachService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def set_avatar_url(self, profile: CoachProfile, avatar_url: str) -> CoachProfileResponse:
        profile.avatar_url = avatar_url
        await self.db.flush()
        return CoachProfileResponse.model_validate(profile)

    async def list_athletes(self, coach_profile: CoachProfile) -> list[CoachAthleteSummary]:
        result = await self.db.execute(
            select(CoachAthleteLink)
            .where(CoachAthleteLink.coach_id == coach_profile.id)
            .options(
                selectinload(CoachAthleteLink.athlete),
                selectinload(CoachAthleteLink.session_entries),
            )
            .order_by(CoachAthleteLink.created_at.desc())
        )
        links = result.scalars().all()
        return [self._link_to_summary(link) for link in links]

    async def create_managed_athlete(
        self,
        coach_profile: CoachProfile,
        data: CreateManagedAthleteRequest,
    ) -> CoachAthleteSummary:
        athlete = AthleteProfile(
            user_id=None,
            managed_by_coach_id=coach_profile.id,
            display_name=data.display_name,
        )
        self.db.add(athlete)
        await self.db.flush()

        link = CoachAthleteLink(
            coach_id=coach_profile.id,
            athlete_id=athlete.id,
            status=CoachAthleteLinkStatus.active,
            started_at=datetime.now(UTC),
        )
        self.db.add(link)
        await self.db.flush()
        await self.db.refresh(link, attribute_names=["athlete", "session_entries"])
        return self._link_to_summary(link)

    async def add_sessions(
        self,
        coach_profile: CoachProfile,
        athlete_id: UUID,
        count: int,
    ) -> CoachAthleteSessionsResponse:
        link = await self._get_link(coach_profile, athlete_id)
        link.sessions_balance += count
        await self._record_session_entry(link, CoachAthleteSessionEntryKind.credit, count)
        await self.db.flush()
        return await self._link_to_sessions_response(link)

    async def complete_session(
        self,
        coach_profile: CoachProfile,
        athlete_id: UUID,
    ) -> CoachAthleteSessionsResponse:
        link = await self._get_link(coach_profile, athlete_id)
        link.sessions_balance -= 1
        await self._record_session_entry(link, CoachAthleteSessionEntryKind.debit, 1)
        await self.db.flush()
        return await self._link_to_sessions_response(link)

    async def list_session_history(
        self,
        coach_profile: CoachProfile,
        athlete_id: UUID,
    ) -> list[CoachAthleteSessionHistoryEntry]:
        link = await self._get_link(coach_profile, athlete_id)
        result = await self.db.execute(
            select(CoachAthleteSessionEntry)
            .where(CoachAthleteSessionEntry.link_id == link.id)
            .order_by(
                CoachAthleteSessionEntry.entry_date.desc(),
                CoachAthleteSessionEntry.created_at.desc(),
            )
        )
        entries = result.scalars().all()
        return [CoachAthleteSessionHistoryEntry.model_validate(entry) for entry in entries]

    async def _count_completed_sessions(self, link_id: UUID) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.sum(CoachAthleteSessionEntry.sessions_count), 0)).where(
                CoachAthleteSessionEntry.link_id == link_id,
                CoachAthleteSessionEntry.kind == CoachAthleteSessionEntryKind.debit,
            )
        )
        return int(result.scalar_one())

    async def _record_session_entry(
        self,
        link: CoachAthleteLink,
        kind: CoachAthleteSessionEntryKind,
        sessions_count: int,
    ) -> None:
        self.db.add(
            CoachAthleteSessionEntry(
                link_id=link.id,
                kind=kind,
                sessions_count=sessions_count,
                entry_date=datetime.now(UTC).date(),
            )
        )

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
            has_app=athlete.user_id is not None,
            avatar_url=athlete.avatar_url,
            link_status=link.status,
            sessions_balance=link.sessions_balance,
            sessions_completed=CoachService._sessions_completed_from_link(link),
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
    def _sessions_completed_from_link(link: CoachAthleteLink) -> int:
        return sum(
            entry.sessions_count
            for entry in link.session_entries
            if entry.kind == CoachAthleteSessionEntryKind.debit
        )

    async def _link_to_sessions_response(self, link: CoachAthleteLink) -> CoachAthleteSessionsResponse:
        return CoachAthleteSessionsResponse(
            athlete_id=link.athlete_id,
            link_id=link.id,
            sessions_balance=link.sessions_balance,
            sessions_completed=await self._count_completed_sessions(link.id),
        )

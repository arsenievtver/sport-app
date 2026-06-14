from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_pin
from app.models.enums import CoachAthleteLinkStatus, UserRole
from app.models.user import AthleteProfile, CoachAthleteLink, CoachProfile, User
from app.schemas.admin import (
    AdminAthleteCreate,
    AdminAthleteResponse,
    AdminAthleteUpdate,
    AdminCoachCreate,
    AdminCoachResponse,
    AdminCoachUpdate,
    CoachAthleteLinkCreate,
    CoachAthleteLinkResponse,
    LinkedAthleteSummary,
    LinkedCoachSummary,
)
from app.services.auth import AuthService


class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.auth = AuthService(db)

    async def list_coaches(self) -> list[AdminCoachResponse]:
        result = await self.db.execute(
            select(CoachProfile)
            .options(
                selectinload(CoachProfile.user),
                selectinload(CoachProfile.athlete_links).selectinload(CoachAthleteLink.athlete),
            )
            .order_by(CoachProfile.display_name)
        )
        return [self._coach_to_response(profile) for profile in result.scalars().all()]

    async def list_athletes(self) -> list[AdminAthleteResponse]:
        result = await self.db.execute(
            select(AthleteProfile)
            .options(
                selectinload(AthleteProfile.user),
                selectinload(AthleteProfile.coach_links).selectinload(CoachAthleteLink.coach),
            )
            .order_by(AthleteProfile.display_name)
        )
        return [self._athlete_to_response(profile) for profile in result.scalars().all()]

    async def create_coach(self, data: AdminCoachCreate) -> AdminCoachResponse:
        existing = await self.db.execute(
            select(User)
            .where(User.phone == data.phone)
            .options(selectinload(User.coach_profile))
        )
        user = existing.scalar_one_or_none()
        if user and user.coach_profile:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Coach with this phone already exists",
            )

        user, _ = await self.auth.grant_roles(
            phone=data.phone,
            roles=[UserRole.coach],
            display_name=data.display_name,
            pin=data.pin,
        )
        profile = user.coach_profile
        if profile is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Coach profile missing")

        profile.bio = data.bio
        profile.is_verified = data.is_verified
        await self._sync_coach_athletes(profile.id, data.athlete_ids)
        await self.db.flush()
        return await self._get_coach(profile.id)

    async def update_coach(self, coach_id: UUID, data: AdminCoachUpdate) -> AdminCoachResponse:
        profile = await self._get_coach_profile(coach_id)
        if data.display_name is not None:
            profile.display_name = data.display_name
        if data.bio is not None:
            profile.bio = data.bio
        if data.is_verified is not None:
            profile.is_verified = data.is_verified
        if data.is_active is not None:
            profile.user.is_active = data.is_active
        if data.pin is not None:
            profile.user.password_hash = hash_pin(data.pin)
        if data.athlete_ids is not None:
            await self._sync_coach_athletes(coach_id, data.athlete_ids)
        await self.db.flush()
        return await self._get_coach(coach_id)

    async def delete_coach(self, coach_id: UUID) -> None:
        profile = await self._get_coach_profile(coach_id)
        user = profile.user
        await self.db.delete(profile)
        user.roles = [role for role in user.roles if role != UserRole.coach]
        if not user.roles:
            user.is_active = False
        await self.db.flush()

    async def create_athlete(self, data: AdminAthleteCreate) -> AdminAthleteResponse:
        existing = await self.db.execute(
            select(User)
            .where(User.phone == data.phone)
            .options(selectinload(User.athlete_profile))
        )
        user = existing.scalar_one_or_none()
        if user and user.athlete_profile:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Athlete with this phone already exists",
            )

        user, _ = await self.auth.grant_roles(
            phone=data.phone,
            roles=[UserRole.athlete],
            display_name=data.display_name,
            pin=data.pin,
        )
        profile = user.athlete_profile
        if profile is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Athlete profile missing")

        profile.birth_date = data.birth_date
        profile.timezone = data.timezone
        await self._sync_athlete_coaches(profile.id, data.coach_ids)
        await self.db.flush()
        return await self._get_athlete(profile.id)

    async def update_athlete(self, athlete_id: UUID, data: AdminAthleteUpdate) -> AdminAthleteResponse:
        profile = await self._get_athlete_profile(athlete_id)
        if data.display_name is not None:
            profile.display_name = data.display_name
        if data.birth_date is not None:
            profile.birth_date = data.birth_date
        if data.timezone is not None:
            profile.timezone = data.timezone
        if data.is_active is not None:
            profile.user.is_active = data.is_active
        if data.pin is not None:
            profile.user.password_hash = hash_pin(data.pin)
        if data.coach_ids is not None:
            await self._sync_athlete_coaches(athlete_id, data.coach_ids)
        await self.db.flush()
        return await self._get_athlete(athlete_id)

    async def delete_athlete(self, athlete_id: UUID) -> None:
        profile = await self._get_athlete_profile(athlete_id)
        user = profile.user
        await self.db.delete(profile)
        user.roles = [role for role in user.roles if role != UserRole.athlete]
        if not user.roles:
            user.is_active = False
        await self.db.flush()

    async def create_link(self, data: CoachAthleteLinkCreate) -> CoachAthleteLinkResponse:
        await self._get_coach_profile(data.coach_id)
        await self._get_athlete_profile(data.athlete_id)
        existing = await self.db.execute(
            select(CoachAthleteLink).where(
                CoachAthleteLink.coach_id == data.coach_id,
                CoachAthleteLink.athlete_id == data.athlete_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Link already exists")

        link = CoachAthleteLink(
            coach_id=data.coach_id,
            athlete_id=data.athlete_id,
            status=data.status,
            started_at=datetime.now(UTC) if data.status == CoachAthleteLinkStatus.active else None,
        )
        self.db.add(link)
        await self.db.flush()
        await self.db.refresh(link)
        return CoachAthleteLinkResponse(
            id=link.id,
            coach_id=link.coach_id,
            athlete_id=link.athlete_id,
            status=link.status,
            created_at=link.created_at,
        )

    async def delete_link(self, link_id: UUID) -> None:
        result = await self.db.execute(select(CoachAthleteLink).where(CoachAthleteLink.id == link_id))
        link = result.scalar_one_or_none()
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
        await self.db.delete(link)
        await self.db.flush()

    async def _get_coach(self, coach_id: UUID) -> AdminCoachResponse:
        profile = await self._get_coach_profile(coach_id)
        return self._coach_to_response(profile)

    async def _get_athlete(self, athlete_id: UUID) -> AdminAthleteResponse:
        profile = await self._get_athlete_profile(athlete_id)
        return self._athlete_to_response(profile)

    async def _get_coach_profile(self, coach_id: UUID) -> CoachProfile:
        result = await self.db.execute(
            select(CoachProfile)
            .where(CoachProfile.id == coach_id)
            .options(
                selectinload(CoachProfile.user),
                selectinload(CoachProfile.athlete_links).selectinload(CoachAthleteLink.athlete),
            )
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")
        return profile

    async def _get_athlete_profile(self, athlete_id: UUID) -> AthleteProfile:
        result = await self.db.execute(
            select(AthleteProfile)
            .where(AthleteProfile.id == athlete_id)
            .options(
                selectinload(AthleteProfile.user),
                selectinload(AthleteProfile.coach_links).selectinload(CoachAthleteLink.coach),
            )
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Athlete not found")
        return profile

    async def _sync_coach_athletes(self, coach_id: UUID, athlete_ids: list[UUID]) -> None:
        await self._get_coach_profile(coach_id)
        for athlete_id in athlete_ids:
            athlete_result = await self.db.execute(
                select(AthleteProfile.id).where(AthleteProfile.id == athlete_id)
            )
            if athlete_result.scalar_one_or_none() is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Athlete {athlete_id} not found")

        result = await self.db.execute(
            select(CoachAthleteLink).where(CoachAthleteLink.coach_id == coach_id)
        )
        existing_links = {link.athlete_id: link for link in result.scalars().all()}
        desired = set(athlete_ids)

        for athlete_id, link in existing_links.items():
            if athlete_id not in desired:
                await self.db.delete(link)

        for athlete_id in desired:
            if athlete_id not in existing_links:
                self.db.add(
                    CoachAthleteLink(
                        coach_id=coach_id,
                        athlete_id=athlete_id,
                        status=CoachAthleteLinkStatus.active,
                        started_at=datetime.now(UTC),
                    )
                )

    async def _sync_athlete_coaches(self, athlete_id: UUID, coach_ids: list[UUID]) -> None:
        await self._get_athlete_profile(athlete_id)
        for coach_id in coach_ids:
            coach_result = await self.db.execute(select(CoachProfile.id).where(CoachProfile.id == coach_id))
            if coach_result.scalar_one_or_none() is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Coach {coach_id} not found")

        result = await self.db.execute(
            select(CoachAthleteLink).where(CoachAthleteLink.athlete_id == athlete_id)
        )
        existing_links = {link.coach_id: link for link in result.scalars().all()}
        desired = set(coach_ids)

        for coach_id, link in existing_links.items():
            if coach_id not in desired:
                await self.db.delete(link)

        for coach_id in desired:
            if coach_id not in existing_links:
                self.db.add(
                    CoachAthleteLink(
                        coach_id=coach_id,
                        athlete_id=athlete_id,
                        status=CoachAthleteLinkStatus.active,
                        started_at=datetime.now(UTC),
                    )
                )

    @staticmethod
    def _coach_to_response(profile: CoachProfile) -> AdminCoachResponse:
        athletes = [
            LinkedAthleteSummary(
                link_id=link.id,
                athlete_id=link.athlete_id,
                display_name=link.athlete.display_name,
                status=link.status,
            )
            for link in profile.athlete_links
        ]
        return AdminCoachResponse(
            id=profile.id,
            user_id=profile.user_id,
            phone=profile.user.phone,
            display_name=profile.display_name,
            bio=profile.bio,
            invite_code=profile.invite_code,
            is_verified=profile.is_verified,
            is_active=profile.user.is_active,
            athletes=athletes,
            created_at=profile.created_at,
        )

    @staticmethod
    def _athlete_to_response(profile: AthleteProfile) -> AdminAthleteResponse:
        coaches = [
            LinkedCoachSummary(
                link_id=link.id,
                coach_id=link.coach_id,
                display_name=link.coach.display_name,
                status=link.status,
            )
            for link in profile.coach_links
        ]
        return AdminAthleteResponse(
            id=profile.id,
            user_id=profile.user_id,
            phone=profile.user.phone,
            display_name=profile.display_name,
            birth_date=profile.birth_date,
            timezone=profile.timezone,
            is_active=profile.user.is_active,
            coaches=coaches,
            created_at=profile.created_at,
        )

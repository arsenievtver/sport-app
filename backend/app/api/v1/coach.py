from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CoachUser
from app.models.user import CoachProfile
from app.schemas.auth import UserResponse
from app.schemas.coach import (
    AddSessionsRequest,
    CoachAthleteSessionHistoryEntry,
    CoachAthleteSessionsResponse,
    CoachAthleteSummary,
    CreateManagedAthleteRequest,
)
from app.services.auth import user_to_response
from app.services.coach import CoachService
from app.services.media import save_avatar

router = APIRouter(prefix="/coach")


async def get_current_coach_profile(user: CoachUser) -> CoachProfile:
    if user.coach_profile is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуется профиль тренера",
        )
    return user.coach_profile


@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    user: CoachUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File()],
) -> UserResponse:
    if user.coach_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль тренера")

    avatar_url = await save_avatar(user.coach_profile.id, file)
    service = CoachService(db)
    await service.set_avatar_url(user.coach_profile, avatar_url)
    await db.refresh(user.coach_profile)
    return user_to_response(user)


@router.get("/athletes", response_model=list[CoachAthleteSummary])
async def list_athletes(
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CoachAthleteSummary]:
    return await CoachService(db).list_athletes(coach_profile)


@router.post("/athletes", response_model=CoachAthleteSummary, status_code=status.HTTP_201_CREATED)
async def create_managed_athlete(
    data: CreateManagedAthleteRequest,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachAthleteSummary:
    return await CoachService(db).create_managed_athlete(coach_profile, data)


@router.get(
    "/athletes/{athlete_id}/sessions/history",
    response_model=list[CoachAthleteSessionHistoryEntry],
)
async def list_athlete_session_history(
    athlete_id: UUID,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CoachAthleteSessionHistoryEntry]:
    return await CoachService(db).list_session_history(coach_profile, athlete_id)


@router.post(
    "/athletes/{athlete_id}/sessions/add",
    response_model=CoachAthleteSessionsResponse,
)
async def add_athlete_sessions(
    athlete_id: UUID,
    data: AddSessionsRequest,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachAthleteSessionsResponse:
    return await CoachService(db).add_sessions(coach_profile, athlete_id, data.count)


@router.post(
    "/athletes/{athlete_id}/sessions/complete",
    response_model=CoachAthleteSessionsResponse,
)
async def complete_athlete_session(
    athlete_id: UUID,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachAthleteSessionsResponse:
    return await CoachService(db).complete_session(coach_profile, athlete_id)

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import AthleteUser
from app.schemas.athlete import (
    AthleteCoachResponse,
    AthleteOnboardingRequest,
    AthleteProfileResponse,
    AthleteProfileUpdateRequest,
    JoinCoachRequest,
)
from app.schemas.auth import UserResponse
from app.schemas.schedule import AthleteUpcomingSessionResponse
from app.services.athlete import AthleteService
from app.services.auth import user_to_response
from app.services.media import save_avatar
from app.services.schedule import ScheduleService

router = APIRouter(prefix="/athlete")


@router.post("/onboarding", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def complete_onboarding(
    data: AthleteOnboardingRequest,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    service = AthleteService(db)
    await service.complete_onboarding(user.athlete_profile, data)
    await db.refresh(user.athlete_profile)
    return user_to_response(user)


@router.get("/profile", response_model=AthleteProfileResponse)
async def get_profile(user: AthleteUser) -> AthleteProfileResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return AthleteProfileResponse.model_validate(user.athlete_profile)


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    data: AthleteProfileUpdateRequest,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    service = AthleteService(db)
    await service.update_profile(user.athlete_profile, data)
    await db.refresh(user.athlete_profile)
    return user_to_response(user)


@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File()],
) -> UserResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    avatar_url = await save_avatar(user.athlete_profile.id, file)
    service = AthleteService(db)
    await service.set_avatar_url(user.athlete_profile, avatar_url)
    await db.refresh(user.athlete_profile)
    return user_to_response(user)


@router.get("/coaches", response_model=list[AthleteCoachResponse])
async def list_coaches(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AthleteCoachResponse]:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    service = AthleteService(db)
    return await service.list_coaches(user.athlete_profile)


@router.post("/coaches/join", response_model=AthleteCoachResponse, status_code=status.HTTP_201_CREATED)
async def join_coach(
    data: JoinCoachRequest,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteCoachResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    service = AthleteService(db)
    return await service.join_coach(user.athlete_profile, data)


@router.delete("/coaches/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_coach(
    link_id: UUID,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    service = AthleteService(db)
    await service.remove_coach(user.athlete_profile, link_id)


@router.get("/schedule/upcoming", response_model=list[AthleteUpcomingSessionResponse])
async def list_upcoming_sessions(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=8)] = 4,
) -> list[AthleteUpcomingSessionResponse]:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await ScheduleService(db).list_upcoming_for_athlete(user.athlete_profile, limit=limit)

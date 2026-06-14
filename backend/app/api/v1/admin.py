from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import AdminUser
from app.schemas.admin import (
    AdminAthleteCreate,
    AdminAthleteResponse,
    AdminAthleteUpdate,
    AdminCoachCreate,
    AdminCoachResponse,
    AdminCoachUpdate,
    CoachAthleteLinkCreate,
    CoachAthleteLinkResponse,
)
from app.services.admin import AdminService

router = APIRouter(prefix="/admin")


@router.get("/coaches", response_model=list[AdminCoachResponse])
async def list_coaches(_admin: AdminUser, db: Annotated[AsyncSession, Depends(get_db)]) -> list[AdminCoachResponse]:
    return await AdminService(db).list_coaches()


@router.post("/coaches", response_model=AdminCoachResponse, status_code=status.HTTP_201_CREATED)
async def create_coach(
    data: AdminCoachCreate,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminCoachResponse:
    return await AdminService(db).create_coach(data)


@router.patch("/coaches/{coach_id}", response_model=AdminCoachResponse)
async def update_coach(
    coach_id: UUID,
    data: AdminCoachUpdate,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminCoachResponse:
    return await AdminService(db).update_coach(coach_id, data)


@router.delete("/coaches/{coach_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_coach(
    coach_id: UUID,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await AdminService(db).delete_coach(coach_id)


@router.get("/athletes", response_model=list[AdminAthleteResponse])
async def list_athletes(_admin: AdminUser, db: Annotated[AsyncSession, Depends(get_db)]) -> list[AdminAthleteResponse]:
    return await AdminService(db).list_athletes()


@router.post("/athletes", response_model=AdminAthleteResponse, status_code=status.HTTP_201_CREATED)
async def create_athlete(
    data: AdminAthleteCreate,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminAthleteResponse:
    return await AdminService(db).create_athlete(data)


@router.patch("/athletes/{athlete_id}", response_model=AdminAthleteResponse)
async def update_athlete(
    athlete_id: UUID,
    data: AdminAthleteUpdate,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminAthleteResponse:
    return await AdminService(db).update_athlete(athlete_id, data)


@router.delete("/athletes/{athlete_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_athlete(
    athlete_id: UUID,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await AdminService(db).delete_athlete(athlete_id)


@router.post("/links", response_model=CoachAthleteLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_link(
    data: CoachAthleteLinkCreate,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachAthleteLinkResponse:
    return await AdminService(db).create_link(data)


@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_link(
    link_id: UUID,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await AdminService(db).delete_link(link_id)

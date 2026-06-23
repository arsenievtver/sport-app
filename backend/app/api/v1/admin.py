from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
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
from app.schemas.meal_catalog import (
    AdminMealCatalogDish,
    AdminMealCatalogDishListResponse,
    AdminMealCatalogDishUpdate,
    AdminMealCatalogStatusResponse,
)
from app.services.admin import AdminService
from app.services.logmeal_catalog import LogMealCatalogService
from app.services.logmeal_catalog_job import CatalogJobAlreadyRunningError, catalog_job_runner

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


@router.get("/meal-catalog/status", response_model=AdminMealCatalogStatusResponse)
async def get_meal_catalog_status(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminMealCatalogStatusResponse:
    stats = await LogMealCatalogService(db).get_stats()
    return AdminMealCatalogStatusResponse(job=catalog_job_runner.snapshot(), **stats.model_dump())


@router.get("/meal-catalog/dishes", response_model=AdminMealCatalogDishListResponse)
async def list_meal_catalog_dishes(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    page_size: int = 100,
    q: str | None = None,
) -> AdminMealCatalogDishListResponse:
    rows, total = await LogMealCatalogService(db).list_dishes_admin(page=page, page_size=page_size, query=q)
    return AdminMealCatalogDishListResponse(
        items=[AdminMealCatalogDish.model_validate(row) for row in rows],
        total=total,
        page=max(1, page),
        page_size=min(100, max(1, page_size)),
    )


@router.patch("/meal-catalog/dishes/{logmeal_id}", response_model=AdminMealCatalogDish)
async def update_meal_catalog_dish(
    logmeal_id: int,
    data: AdminMealCatalogDishUpdate,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminMealCatalogDish:
    if not data.model_dump(exclude_unset=True):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет полей для обновления")
    row = await LogMealCatalogService(db).update_dish_admin(logmeal_id, data)
    return AdminMealCatalogDish.model_validate(row)


@router.delete("/meal-catalog/dishes/{logmeal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal_catalog_dish(
    logmeal_id: int,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await LogMealCatalogService(db).delete_dish_admin(logmeal_id)


async def _start_catalog_job(job_type: str) -> None:
    try:
        await catalog_job_runner.start(job_type)  # type: ignore[arg-type]
    except CatalogJobAlreadyRunningError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Задача уже выполняется") from exc


@router.post("/meal-catalog/sync", status_code=status.HTTP_202_ACCEPTED)
async def start_meal_catalog_sync(_admin: AdminUser) -> dict[str, str]:
    await _start_catalog_job("sync")
    return {"status": "accepted"}


@router.post("/meal-catalog/translate", status_code=status.HTTP_202_ACCEPTED)
async def start_meal_catalog_translate(_admin: AdminUser) -> dict[str, str]:
    await _start_catalog_job("translate")
    return {"status": "accepted"}


@router.post("/meal-catalog/refresh", status_code=status.HTTP_202_ACCEPTED)
async def start_meal_catalog_refresh(_admin: AdminUser) -> dict[str, str]:
    await _start_catalog_job("full")
    return {"status": "accepted"}

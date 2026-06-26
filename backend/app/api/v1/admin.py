from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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
from app.schemas.activity_compendium import (
    AdminActivityCompendiumItem,
    AdminActivityCompendiumItemUpdate,
    AdminActivityCompendiumListResponse,
    AdminActivityCompendiumStatusResponse,
)
from app.schemas.meal_catalog import (
    AdminMealCatalogDish,
    AdminMealCatalogDishListResponse,
    AdminMealCatalogDishUpdate,
    AdminMealCatalogStatusResponse,
)
from app.services.activity_compendium import ActivityCompendiumService
from app.services.activity_compendium_job import (
    ActivityCompendiumJobAlreadyRunningError,
    activity_compendium_job_runner,
)
from app.services.compendium_parser import parse_compendium_pdf_bytes
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


@router.get("/activity-compendium/status", response_model=AdminActivityCompendiumStatusResponse)
async def get_activity_compendium_status(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminActivityCompendiumStatusResponse:
    stats = await ActivityCompendiumService(db).get_stats()
    return AdminActivityCompendiumStatusResponse(job=activity_compendium_job_runner.snapshot(), **stats.model_dump())


@router.get("/activity-compendium/activities", response_model=AdminActivityCompendiumListResponse)
async def list_activity_compendium(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    page_size: int = 100,
    q: str | None = None,
    major_heading: str | None = None,
    is_active: bool | None = None,
    sort_by: str | None = None,
    sort_dir: str | None = None,
) -> AdminActivityCompendiumListResponse:
    rows, total = await ActivityCompendiumService(db).list_admin(
        page=page,
        page_size=page_size,
        query=q,
        major_heading=major_heading,
        is_active=is_active,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return AdminActivityCompendiumListResponse(
        items=[AdminActivityCompendiumItem.model_validate(row) for row in rows],
        total=total,
        page=max(1, page),
        page_size=min(100, max(1, page_size)),
    )


@router.patch("/activity-compendium/activities/{activity_id}", response_model=AdminActivityCompendiumItem)
async def update_activity_compendium_item(
    activity_id: UUID,
    data: AdminActivityCompendiumItemUpdate,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminActivityCompendiumItem:
    payload = data.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет полей для обновления")
    try:
        row = await ActivityCompendiumService(db).update_admin(
            activity_id,
            name_ru=data.name_ru,
            is_active=data.is_active,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Активность не найдена") from exc
    await db.commit()
    return AdminActivityCompendiumItem.model_validate(row)


@router.delete("/activity-compendium/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity_compendium_item(
    activity_id: UUID,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    try:
        await ActivityCompendiumService(db).delete_admin(activity_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Активность не найдена") from exc
    await db.commit()


@router.post("/activity-compendium/import", status_code=status.HTTP_202_ACCEPTED)
async def import_activity_compendium_pdf(
    _admin: AdminUser,
    file: Annotated[UploadFile, File(description="2024 Adult Compendium PDF")],
) -> dict[str, str | int]:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нужен PDF-файл справочника")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл пуст")

    try:
        rows = parse_compendium_pdf_bytes(raw)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось разобрать PDF. Проверьте, что это 2024 Adult Compendium.",
        ) from exc

    try:
        await activity_compendium_job_runner.start_import(rows, job_type="full")
    except ActivityCompendiumJobAlreadyRunningError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Задача уже выполняется") from exc

    return {"status": "accepted", "activity_count": len(rows)}


@router.post("/activity-compendium/translate", status_code=status.HTTP_202_ACCEPTED)
async def translate_activity_compendium(_admin: AdminUser) -> dict[str, str]:
    try:
        await activity_compendium_job_runner.start_translate()
    except ActivityCompendiumJobAlreadyRunningError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Задача уже выполняется") from exc
    return {"status": "accepted"}

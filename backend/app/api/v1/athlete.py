from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import AthleteUser
from app.schemas.activity_type import ActivityTypesListResponse
from app.schemas.athlete import (
    AthleteCoachResponse,
    AthleteCompleteSessionRequest,
    AthleteCompleteSessionResponse,
    AthleteLastSessionResponse,
    AthleteOnboardingRequest,
    AthleteProfileResponse,
    AthleteProfileUpdateRequest,
    AthleteSessionHistoryItemResponse,
    AthleteSessionsStatsResponse,
    JoinCoachRequest,
)
from app.schemas.athlete_weight import (
    AthleteWeightDynamicsResponse,
    AthleteWeightMeasurementRequest,
)
from app.schemas.athlete_meals import (
    AthleteMealCreateRequest,
    AthleteMealEntryResponse,
    AthleteMealListResponse,
    MealAnalysisResponse,
)
from app.schemas.athlete_plan import (
    AthletePlanResponse,
    AthletePlanUpdateRequest,
    AthleteWeekProgressResponse,
)
from app.schemas.auth import UserResponse
from app.schemas.schedule import AthleteUpcomingSessionResponse
from app.services.activity_type import ActivityTypeService
from app.services.athlete import AthleteService
from app.services.athlete_weight import AthleteWeightService
from app.services.athlete_meals import AthleteMealsService
from app.services.athlete_plan import AthletePlanService
from app.services.auth import user_to_response
from app.services.media import prepare_meal_photo, save_avatar
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


@router.get("/sessions/stats", response_model=AthleteSessionsStatsResponse)
async def get_sessions_stats(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteSessionsStatsResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    service = AthleteService(db)
    return await service.get_sessions_stats(user.athlete_profile)


@router.get("/sessions/last", response_model=AthleteLastSessionResponse | None)
async def get_last_completed_session(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteLastSessionResponse | None:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    service = AthleteService(db)
    return await service.get_last_completed_session(user.athlete_profile)


@router.get("/sessions/history", response_model=list[AthleteSessionHistoryItemResponse])
async def list_session_history(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    days: Annotated[int, Query(ge=1, le=90)] = 30,
) -> list[AthleteSessionHistoryItemResponse]:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    service = AthleteService(db)
    return await service.list_session_history(user.athlete_profile, days=days, limit=limit)


@router.get("/activity-types", response_model=ActivityTypesListResponse)
async def list_activity_types(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ActivityTypesListResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await ActivityTypeService(db).list_for_athlete(user.athlete_profile)


@router.post("/sessions/complete", response_model=AthleteCompleteSessionResponse)
async def complete_session(
    data: AthleteCompleteSessionRequest,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteCompleteSessionResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    service = AthleteService(db)
    return await service.complete_session(user.athlete_profile, data)


@router.get("/weight/dynamics", response_model=AthleteWeightDynamicsResponse)
async def get_weight_dynamics(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteWeightDynamicsResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await AthleteWeightService(db).get_dynamics(user.athlete_profile)


@router.post("/weight/measurements", response_model=AthleteWeightDynamicsResponse)
async def add_weight_measurement(
    data: AthleteWeightMeasurementRequest,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteWeightDynamicsResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await AthleteWeightService(db).add_measurement(user.athlete_profile, data)


@router.get("/meals", response_model=AthleteMealListResponse)
async def list_meals(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
) -> AthleteMealListResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await AthleteMealsService(db).list_entries(user.athlete_profile, limit=limit)


@router.post("/meals/analyze", response_model=MealAnalysisResponse)
async def analyze_meal_photo(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File()],
) -> MealAnalysisResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    image_bytes = await prepare_meal_photo(file)
    return await AthleteMealsService(db).analyze_photo(user.athlete_profile, image_bytes)


@router.get("/meals/debug/last")
async def get_last_meal_analyze_debug(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    payload = AthleteMealsService(db).get_last_analyze_debug(user.athlete_profile)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Нет сохранённого ответа LogMeal — сначала распознайте фото через ИИ",
        )
    return payload


@router.post("/meals", response_model=AthleteMealEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_meal_entry(
    data: AthleteMealCreateRequest,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteMealEntryResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await AthleteMealsService(db).create_entry(user.athlete_profile, data)


@router.get("/schedule/upcoming", response_model=list[AthleteUpcomingSessionResponse])
async def list_upcoming_sessions(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=8)] = 4,
) -> list[AthleteUpcomingSessionResponse]:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await ScheduleService(db).list_upcoming_for_athlete(user.athlete_profile, limit=limit)


@router.get("/plan", response_model=AthletePlanResponse)
async def get_plan(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthletePlanResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await AthletePlanService(db).get_plan(user.athlete_profile)


@router.patch("/plan", response_model=AthletePlanResponse)
async def update_plan(
    data: AthletePlanUpdateRequest,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthletePlanResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await AthletePlanService(db).update_plan(user.athlete_profile, data)


@router.get("/plan/week-progress", response_model=AthleteWeekProgressResponse)
async def get_week_progress(
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteWeekProgressResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуется профиль атлета")

    return await AthletePlanService(db).get_week_progress(user.athlete_profile)

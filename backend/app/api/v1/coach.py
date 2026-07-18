from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CoachUser
from app.models.user import CoachProfile
from app.schemas.activity_type import ActivityTypesListResponse
from app.schemas.auth import UserResponse
from app.schemas.athlete_weight import AthleteWeightDynamicsResponse, AthleteWeightMeasurementRequest
from app.schemas.coach import (
    AddSessionsRequest,
    CoachAthleteActiveCreditBatch,
    CoachAthleteSessionHistoryEntry,
    CoachAthleteSessionsResponse,
    CoachAthleteSummary,
    CoachAthleteWeightMeasurementResponse,
    CreateManagedAthleteRequest,
)
from app.schemas.schedule import (
    CoachScheduleSettingsResponse,
    CompleteScheduleSlotRequest,
    CompleteScheduleSlotResponse,
    MoveScheduleSlotRequest,
    ScheduleGridResponse,
    ScheduleSlotCompletionResponse,
    SetScheduleSlotRequest,
    UpdateCoachScheduleSettingsRequest,
)
from app.services.activity_type import ActivityTypeService
from app.services.auth import user_to_response
from app.services.coach import CoachService
from app.services.coach_custom_workout import CoachCustomWorkoutService
from app.services.media import save_avatar
from app.services.schedule import ScheduleService
from app.schemas.custom_workout import (
    CustomWorkoutCreateRequest,
    CustomWorkoutResponse,
    CustomWorkoutUpdateRequest,
)

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
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> list[CoachAthleteSessionHistoryEntry]:
    today = date.today()
    resolved_year = year if year is not None else today.year
    resolved_month = month if month is not None else today.month
    try:
        return await CoachService(db).list_session_history(
            coach_profile,
            athlete_id,
            year=resolved_year,
            month=resolved_month,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/athletes/{athlete_id}/sessions/active-batches",
    response_model=list[CoachAthleteActiveCreditBatch],
)
async def list_athlete_active_credit_batches(
    athlete_id: UUID,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CoachAthleteActiveCreditBatch]:
    return await CoachService(db).list_active_credit_batches(coach_profile, athlete_id)


@router.delete(
    "/athletes/{athlete_id}/sessions/entries/{entry_id}",
    response_model=CoachAthleteSessionsResponse,
)
async def delete_athlete_session_entry(
    athlete_id: UUID,
    entry_id: UUID,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachAthleteSessionsResponse:
    return await CoachService(db).delete_session_entry(coach_profile, athlete_id, entry_id)


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


@router.post(
    "/athletes/{athlete_id}/weight/measurements",
    response_model=CoachAthleteWeightMeasurementResponse,
)
async def add_athlete_weight_measurement(
    athlete_id: UUID,
    data: AthleteWeightMeasurementRequest,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachAthleteWeightMeasurementResponse:
    return await CoachService(db).add_athlete_weight_measurement(coach_profile, athlete_id, data)


@router.get(
    "/athletes/{athlete_id}/weight/dynamics",
    response_model=AthleteWeightDynamicsResponse,
)
async def get_athlete_weight_dynamics(
    athlete_id: UUID,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AthleteWeightDynamicsResponse:
    return await CoachService(db).get_athlete_weight_dynamics(coach_profile, athlete_id)


@router.get("/schedule/settings", response_model=CoachScheduleSettingsResponse)
async def get_schedule_settings(
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachScheduleSettingsResponse:
    return await ScheduleService(db).get_settings(coach_profile)


@router.put("/schedule/settings", response_model=CoachScheduleSettingsResponse)
async def update_schedule_settings(
    data: UpdateCoachScheduleSettingsRequest,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachScheduleSettingsResponse:
    return await ScheduleService(db).update_settings(coach_profile, data)


@router.get("/schedule/template", response_model=ScheduleGridResponse)
async def get_schedule_template(
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ScheduleGridResponse:
    return await ScheduleService(db).get_template_grid(coach_profile)


@router.get("/schedule/week", response_model=ScheduleGridResponse)
async def get_schedule_week(
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
    week_date: Annotated[date | None, Query(alias="date")] = None,
) -> ScheduleGridResponse:
    target = week_date or date.today()
    return await ScheduleService(db).get_week_grid(coach_profile, target)


@router.get("/schedule/day-completions", response_model=list[ScheduleSlotCompletionResponse])
async def list_schedule_day_completions(
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
    day_date: Annotated[date, Query(alias="date")],
) -> list[ScheduleSlotCompletionResponse]:
    return await ScheduleService(db).list_day_completions(coach_profile, day_date)


@router.post("/schedule/complete-slot", response_model=CompleteScheduleSlotResponse)
async def complete_schedule_slot(
    data: CompleteScheduleSlotRequest,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CompleteScheduleSlotResponse:
    return await ScheduleService(db).complete_schedule_slot(coach_profile, data)


@router.put("/schedule/slot", response_model=ScheduleGridResponse)
async def set_schedule_slot(
    data: SetScheduleSlotRequest,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ScheduleGridResponse:
    return await ScheduleService(db).set_slot(coach_profile, data)


@router.delete("/schedule/week/slot", response_model=ScheduleGridResponse)
async def clear_schedule_week_slot(
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
    occurrence_date: Annotated[date, Query(alias="date")],
    start_time: Annotated[str, Query()],
) -> ScheduleGridResponse:
    return await ScheduleService(db).clear_week_slot(coach_profile, occurrence_date, start_time)


@router.post("/schedule/week/move", response_model=ScheduleGridResponse)
async def move_schedule_week_slot(
    data: MoveScheduleSlotRequest,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ScheduleGridResponse:
    return await ScheduleService(db).move_week_slot(coach_profile, data)


@router.get("/activity-types", response_model=ActivityTypesListResponse)
async def list_activity_types(
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ActivityTypesListResponse:
    return await ActivityTypeService(db).list_for_coach(coach_profile)


@router.get("/custom-workouts", response_model=list[CustomWorkoutResponse])
async def list_custom_workouts(
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CustomWorkoutResponse]:
    return await CoachCustomWorkoutService(db).list_for_coach(coach_profile)


@router.post(
    "/custom-workouts",
    response_model=CustomWorkoutResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_custom_workout(
    data: CustomWorkoutCreateRequest,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CustomWorkoutResponse:
    return await CoachCustomWorkoutService(db).create(coach_profile, data)


@router.put("/custom-workouts/{workout_id}", response_model=CustomWorkoutResponse)
async def update_custom_workout(
    workout_id: UUID,
    data: CustomWorkoutUpdateRequest,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CustomWorkoutResponse:
    return await CoachCustomWorkoutService(db).update(coach_profile, workout_id, data)


@router.delete("/custom-workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_workout(
    workout_id: UUID,
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await CoachCustomWorkoutService(db).delete(coach_profile, workout_id)

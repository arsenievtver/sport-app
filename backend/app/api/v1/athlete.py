from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import AthleteUser
from app.schemas.athlete import AthleteOnboardingRequest, AthleteProfileResponse
from app.schemas.auth import UserResponse
from app.services.athlete import AthleteService
from app.services.auth import user_to_response

router = APIRouter(prefix="/athlete")


@router.post("/onboarding", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def complete_onboarding(
    data: AthleteOnboardingRequest,
    user: AthleteUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Athlete profile required")

    service = AthleteService(db)
    await service.complete_onboarding(user.athlete_profile, data)
    await db.refresh(user.athlete_profile)
    return user_to_response(user)


@router.get("/profile", response_model=AthleteProfileResponse)
async def get_profile(user: AthleteUser) -> AthleteProfileResponse:
    if user.athlete_profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Athlete profile required")

    return AthleteProfileResponse.model_validate(user.athlete_profile)

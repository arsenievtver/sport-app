from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CoachUser
from app.models.user import CoachProfile
from app.schemas.coach import CoachAthleteSummary
from app.services.coach import CoachService

router = APIRouter(prefix="/coach")


async def get_current_coach_profile(user: CoachUser) -> CoachProfile:
    if user.coach_profile is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Coach profile required",
        )
    return user.coach_profile


@router.get("/athletes", response_model=list[CoachAthleteSummary])
async def list_athletes(
    coach_profile: Annotated[CoachProfile, Depends(get_current_coach_profile)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CoachAthleteSummary]:
    return await CoachService(db).list_athletes(coach_profile)

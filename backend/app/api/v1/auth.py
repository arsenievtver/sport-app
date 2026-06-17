from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.schemas.auth import (
    InvitePreviewResponse,
    PhonePinLogin,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth import AuthService, user_to_response

router = APIRouter(prefix="/auth")


@router.get("/invite-preview", response_model=InvitePreviewResponse)
async def invite_preview(
    code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    claim: UUID | None = None,
) -> InvitePreviewResponse:
    return await AuthService(db).invite_preview(code, claim)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]) -> TokenResponse:
    service = AuthService(db)
    user = await service.register(data)
    return service.issue_tokens(user.id)


@router.post("/login", response_model=TokenResponse)
async def login(data: PhonePinLogin, db: Annotated[AsyncSession, Depends(get_db)]) -> TokenResponse:
    service = AuthService(db)
    user = await service.login(data.phone, data.pin)
    return service.issue_tokens(user.id)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]) -> TokenResponse:
    service = AuthService(db)
    return await service.refresh(data.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser) -> UserResponse:
    return user_to_response(current_user)

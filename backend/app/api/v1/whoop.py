from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentAthleteProfile
from app.schemas.whoop import WhoopConnectResponse, WhoopStatusResponse, WhoopSyncResponse
from app.services.whoop import WHOOP_PROVIDER, WhoopService

router = APIRouter(prefix="/integrations/whoop")


def _athlete_app_redirect(params: dict[str, str]) -> RedirectResponse:
    base = settings.athlete_app_url.rstrip("/")
    return RedirectResponse(f"{base}?{urlencode(params)}", status_code=302)


@router.get("/connect", response_model=WhoopConnectResponse)
async def whoop_connect(
    athlete: CurrentAthleteProfile,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WhoopConnectResponse:
    service = WhoopService(db)
    return WhoopConnectResponse(authorization_url=service.build_authorization_url(athlete.id))


@router.get("/callback")
async def whoop_callback(
    db: Annotated[AsyncSession, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    if error:
        return _athlete_app_redirect({"whoop": "error", "reason": error})
    if not code or not state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не переданы code или state")

    service = WhoopService(db)
    athlete_id = service.parse_oauth_state(state)
    try:
        await service.complete_oauth(code, athlete_id)
    except HTTPException as exc:
        reason = exc.detail if isinstance(exc.detail, str) else "oauth_failed"
        return _athlete_app_redirect({"whoop": "error", "reason": reason})

    return _athlete_app_redirect({"whoop": "connected"})


@router.get("/status", response_model=WhoopStatusResponse)
async def whoop_status(
    athlete: CurrentAthleteProfile,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WhoopStatusResponse:
    service = WhoopService(db)
    connection = await service.get_connection(athlete.id)
    if connection is None:
        return WhoopStatusResponse(connected=False, provider=WHOOP_PROVIDER)
    return WhoopStatusResponse(
        connected=True,
        provider=WHOOP_PROVIDER,
        external_user_id=connection.external_user_id,
        connected_at=connection.created_at,
        last_sync_at=connection.last_sync_at,
        last_sync_error=connection.last_sync_error,
        has_refresh_token=bool(connection.refresh_token_encrypted),
        last_sync=connection.last_sync_payload,
    )


@router.post("/sync", response_model=WhoopSyncResponse)
async def whoop_sync(
    athlete: CurrentAthleteProfile,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WhoopSyncResponse:
    service = WhoopService(db)
    payload = await service.sync(athlete.id)
    return WhoopSyncResponse(**payload)


@router.delete("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def whoop_disconnect(
    athlete: CurrentAthleteProfile,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    service = WhoopService(db)
    await service.disconnect(athlete.id)

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TOKEN_TYPE_WHOOP_STATE, create_whoop_oauth_state, decode_token
from app.core.token_crypto import decrypt_secret, encrypt_secret
from app.models.health import HealthConnection

WHOOP_PROVIDER = "whoop"
WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2"
WHOOP_SCOPES = (
    "offline read:profile read:recovery read:cycles read:workout read:sleep read:body_measurement"
)


def _expires_at_from_payload(token_payload: dict[str, Any]) -> datetime | None:
    expires_in = token_payload.get("expires_in")
    if isinstance(expires_in, str) and expires_in.isdigit():
        expires_in = int(expires_in)
    if isinstance(expires_in, int):
        return datetime.now(UTC) + timedelta(seconds=expires_in)
    return None


def _apply_token_payload(connection: HealthConnection, token_payload: dict[str, Any]) -> None:
    connection.access_token_encrypted = encrypt_secret(token_payload["access_token"])
    refresh_token = token_payload.get("refresh_token")
    if refresh_token:
        connection.refresh_token_encrypted = encrypt_secret(refresh_token)
    expires_at = _expires_at_from_payload(token_payload)
    if expires_at is not None:
        connection.token_expires_at = expires_at
    scope = token_payload.get("scope")
    if scope:
        connection.scopes = scope


class WhoopService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _require_config(self) -> tuple[str, str, str]:
        if not settings.whoop_client_id or not settings.whoop_client_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Интеграция WHOOP не настроена",
            )
        return settings.whoop_client_id, settings.whoop_client_secret, settings.whoop_redirect_uri

    def build_authorization_url(self, athlete_id: UUID) -> str:
        client_id, _, redirect_uri = self._require_config()
        state = create_whoop_oauth_state(athlete_id)
        query = urlencode(
            {
                "response_type": "code",
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "scope": WHOOP_SCOPES,
                "state": state,
            }
        )
        return f"{WHOOP_AUTH_URL}?{query}"

    def parse_oauth_state(self, state: str) -> UUID:
        try:
            payload = decode_token(state)
            if payload.get("type") != TOKEN_TYPE_WHOOP_STATE:
                raise ValueError("invalid state type")
            return UUID(payload["sub"])
        except (JWTError, KeyError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недействительный или просроченный OAuth state",
            ) from exc

    async def get_connection(self, athlete_id: UUID) -> HealthConnection | None:
        result = await self.db.execute(
            select(HealthConnection).where(
                HealthConnection.athlete_id == athlete_id,
                HealthConnection.provider == WHOOP_PROVIDER,
            )
        )
        return result.scalar_one_or_none()

    async def complete_oauth(self, code: str, athlete_id: UUID) -> HealthConnection:
        client_id, client_secret, redirect_uri = self._require_config()
        token_payload = await self._exchange_code(code, client_id, client_secret, redirect_uri)
        if not token_payload.get("refresh_token"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="WHOOP не вернул refresh-токен; проверьте, что включён offline scope",
            )

        profile = await self._api_get(token_payload["access_token"], "/user/profile/basic")
        external_user_id = str(profile.get("user_id", ""))

        connection = await self.get_connection(athlete_id)
        if connection is None:
            connection = HealthConnection(
                athlete_id=athlete_id,
                provider=WHOOP_PROVIDER,
            )
            self.db.add(connection)

        connection.external_user_id = external_user_id or None
        _apply_token_payload(connection, token_payload)
        connection.last_sync_error = None
        await self.db.commit()
        await self.db.refresh(connection)

        try:
            await self.sync(athlete_id)
        except HTTPException:
            pass

        await self.db.refresh(connection)
        return connection

    async def disconnect(self, athlete_id: UUID) -> None:
        connection = await self.get_connection(athlete_id)
        if connection is None:
            return

        access_token = decrypt_secret(connection.access_token_encrypted)
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                await client.delete(
                    f"{WHOOP_API_BASE}/user/access",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
        except httpx.HTTPError:
            pass

        await self.db.delete(connection)
        await self.db.commit()

    async def sync(self, athlete_id: UUID) -> dict[str, Any]:
        connection = await self.get_connection(athlete_id)
        if connection is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="WHOOP не подключён",
            )

        async def fetch(path: str, params: dict[str, Any] | None = None, *, optional: bool = False) -> dict[str, Any]:
            return await self._api_get_for_connection(connection, path, params, optional=optional)

        payload = {
            "profile": await fetch("/user/profile/basic"),
            "body_measurement": await fetch("/user/measurement/body", optional=True),
            "recovery": await fetch("/recovery", {"limit": 7}),
            "sleep": await fetch("/activity/sleep", {"limit": 7}),
            "workouts": await fetch("/activity/workout", {"limit": 10}),
            "cycles": await fetch("/cycle", {"limit": 7}),
            "synced_at": datetime.now(UTC).isoformat(),
        }

        connection.last_sync_at = datetime.now(UTC)
        connection.last_sync_error = None
        connection.last_sync_payload = payload
        await self.db.commit()
        await self.db.refresh(connection)
        return payload

    async def _get_valid_access_token(self, connection: HealthConnection) -> str:
        expires_at = connection.token_expires_at
        if expires_at is None or expires_at > datetime.now(UTC) + timedelta(seconds=60):
            return decrypt_secret(connection.access_token_encrypted)
        return await self._refresh_access_token(connection)

    async def _refresh_access_token(self, connection: HealthConnection) -> str:
        if not connection.refresh_token_encrypted:
            connection.last_sync_error = "Токен WHOOP истёк"
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Токен WHOOP истёк; требуется переподключение",
            )

        client_id, client_secret, _ = self._require_config()
        refresh_token = decrypt_secret(connection.refresh_token_encrypted)
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                WHOOP_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "scope": "offline",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if response.status_code >= 400:
            connection.last_sync_error = "Не удалось обновить токен WHOOP"
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось обновить токен WHOOP; требуется переподключение",
            )

        token_payload = response.json()
        _apply_token_payload(connection, token_payload)
        await self.db.commit()
        return decrypt_secret(connection.access_token_encrypted)

    async def _api_get_for_connection(
        self,
        connection: HealthConnection,
        path: str,
        params: dict[str, Any] | None = None,
        *,
        optional: bool = False,
    ) -> dict[str, Any]:
        access_token = await self._get_valid_access_token(connection)
        status_code, payload = await self._api_get_raw(access_token, path, params)
        if status_code == 401:
            access_token = await self._refresh_access_token(connection)
            status_code, payload = await self._api_get_raw(access_token, path, params)
        if status_code == 404 and optional:
            return {}
        if status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Ошибка API WHOOP ({status_code}): {payload}",
            )
        return payload

    async def _exchange_code(
        self,
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                WHOOP_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if response.status_code >= 400:
            detail = response.text
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Не удалось обменять токен WHOOP: {detail}",
            )
        return response.json()

    async def _api_get(
        self,
        access_token: str,
        path: str,
        params: dict[str, Any] | None = None,
        *,
        optional: bool = False,
    ) -> dict[str, Any]:
        status_code, payload = await self._api_get_raw(access_token, path, params)
        if status_code == 404 and optional:
            return {}
        if status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Ошибка API WHOOP ({status_code}): {payload}",
            )
        return payload

    async def _api_get_raw(
        self,
        access_token: str,
        path: str,
        params: dict[str, Any] | None = None,
    ) -> tuple[int, Any]:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"{WHOOP_API_BASE}{path}",
                params=params,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        try:
            body = response.json()
        except ValueError:
            body = response.text
        return response.status_code, body

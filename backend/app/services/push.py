from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from urllib.parse import urlparse

from py_vapid import Vapid
from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import NotificationChannel
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription
from app.schemas.push import PushSubscriptionCreateRequest

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_vapid() -> Vapid:
    """Load VAPID private key from settings (PEM or raw urlsafe base64)."""
    raw = settings.vapid_private_key
    if not raw:
        raise RuntimeError("VAPID_PRIVATE_KEY is not set")

    key = raw.strip()
    if key.startswith("-----BEGIN"):
        return Vapid.from_pem(key.encode("ascii"))
    return Vapid.from_string(key)


def _push_audience(endpoint: str) -> str:
    parsed = urlparse(endpoint)
    if not parsed.scheme or not parsed.netloc:
        return endpoint
    return f"{parsed.scheme}://{parsed.netloc}"


class PushService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def vapid_configured(self) -> bool:
        return bool(settings.vapid_public_key and settings.vapid_private_key)

    async def upsert_subscription(
        self,
        user_id: uuid.UUID,
        data: PushSubscriptionCreateRequest,
    ) -> PushSubscription:
        result = await self.db.execute(
            select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.user_id = user_id
            existing.p256dh = data.keys.p256dh
            existing.auth = data.keys.auth
            if data.user_agent is not None:
                existing.user_agent = data.user_agent
            await self.db.flush()
            return existing

        row = PushSubscription(
            user_id=user_id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
            user_agent=data.user_agent,
        )
        self.db.add(row)
        await self.db.flush()
        return row

    async def delete_subscription(self, user_id: uuid.UUID, endpoint: str) -> bool:
        result = await self.db.execute(
            delete(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == endpoint,
            )
        )
        return bool(result.rowcount)

    async def has_subscriptions(self, user_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(PushSubscription.id).where(PushSubscription.user_id == user_id).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def list_user_ids_with_subscriptions(self) -> list[uuid.UUID]:
        result = await self.db.execute(select(PushSubscription.user_id).distinct())
        return list(result.scalars().all())

    async def list_subscriptions_for_user(self, user_id: uuid.UUID) -> list[PushSubscription]:
        result = await self.db.execute(
            select(PushSubscription).where(PushSubscription.user_id == user_id)
        )
        return list(result.scalars().all())

    async def send_to_user(
        self,
        user_id: uuid.UUID,
        *,
        title: str,
        body: str,
        payload: dict | None = None,
    ) -> tuple[int, list[str]]:
        """Returns (devices_sent, error_messages)."""
        if not self.vapid_configured():
            return 0, ["VAPID keys are not configured"]

        try:
            _load_vapid()
        except Exception as exc:
            logger.exception("Failed to load VAPID private key")
            return 0, [
                "Не удалось прочитать VAPID_PRIVATE_KEY. "
                "Нужен PEM (-----BEGIN…) или raw urlsafe-base64. "
                f"Детали: {exc}"
            ]

        subscriptions = await self.list_subscriptions_for_user(user_id)
        if not subscriptions:
            return 0, [f"No subscriptions for user {user_id}"]

        data = {"title": title, "body": body, **(payload or {})}
        sent = 0
        errors: list[str] = []
        for sub in subscriptions:
            ok, err = await self._send_one(sub, data)
            if ok:
                sent += 1
            elif err:
                errors.append(err)

        if sent > 0:
            self.db.add(
                Notification(
                    user_id=user_id,
                    channel=NotificationChannel.push,
                    title=title[:200],
                    body=body,
                    payload=payload or {},
                    is_read=False,
                    sent_at=datetime.now(timezone.utc),
                )
            )
            await self.db.flush()

        return sent, errors

    async def _send_one(self, sub: PushSubscription, data: dict) -> tuple[bool, str | None]:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        endpoint_label = sub.endpoint[:64]
        claims = {
            "sub": settings.vapid_subject,
            "aud": _push_audience(sub.endpoint),
        }
        try:
            vapid = _load_vapid()
            await asyncio.to_thread(
                webpush,
                subscription_info=subscription_info,
                data=json.dumps(data, ensure_ascii=False),
                vapid_private_key=vapid,
                vapid_claims=claims,
                ttl=86400,
            )
            return True, None
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            response_text = ""
            response = getattr(exc, "response", None)
            if response is not None:
                try:
                    response_text = (response.text or "")[:300]
                except Exception:
                    response_text = ""
            message = f"HTTP {status_code}: {exc}"
            if response_text:
                message = f"{message} | {response_text}"
            logger.warning("Web push failed for %s: %s", endpoint_label, message)
            if status_code in {404, 410}:
                await self.db.execute(
                    delete(PushSubscription).where(PushSubscription.id == sub.id)
                )
                await self.db.flush()
                return False, (
                    f"Подписка устарела ({status_code}) и удалена. "
                    "Включите уведомления в PWA заново."
                )
            if status_code in {401, 403}:
                return (
                    False,
                    "Ошибка VAPID (401/403) для Apple/FCM. Проверьте VAPID_SUBJECT "
                    "(mailto:…), пару ключей и заново включите уведомления в PWA.",
                )
            return False, message
        except Exception as exc:
            logger.exception("Unexpected web push error for %s", endpoint_label)
            return False, f"Ошибка отправки: {type(exc).__name__}: {exc}"

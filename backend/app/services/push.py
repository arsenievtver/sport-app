from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import NotificationChannel
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription
from app.schemas.push import PushSubscriptionCreateRequest

logger = logging.getLogger(__name__)


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
    ) -> int:
        if not self.vapid_configured():
            logger.warning("VAPID keys are not configured; skip push send")
            return 0

        subscriptions = await self.list_subscriptions_for_user(user_id)
        if not subscriptions:
            return 0

        data = {"title": title, "body": body, **(payload or {})}
        sent = 0
        for sub in subscriptions:
            ok = await self._send_one(sub, data)
            if ok:
                sent += 1

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

        return sent

    async def _send_one(self, sub: PushSubscription, data: dict) -> bool:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        try:
            await asyncio.to_thread(
                webpush,
                subscription_info=subscription_info,
                data=json.dumps(data, ensure_ascii=False),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
            )
            return True
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            logger.warning("Web push failed for %s: %s", sub.endpoint[:48], exc)
            if status_code in {404, 410}:
                await self.db.execute(
                    delete(PushSubscription).where(PushSubscription.id == sub.id)
                )
                await self.db.flush()
            return False
        except Exception:
            logger.exception("Unexpected web push error for %s", sub.endpoint[:48])
            return False

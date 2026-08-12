from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ScheduledPushStatus
from app.models.push_subscription import PushSubscription
from app.models.scheduled_push import ScheduledPush
from app.schemas.admin_push import (
    AdminPushDayStat,
    AdminPushSendRequest,
    AdminPushSendResponse,
    AdminPushStatsResponse,
    AdminScheduledPushCreate,
    AdminScheduledPushResponse,
)
from app.services.push import PushService

logger = logging.getLogger(__name__)


class AdminPushService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.push = PushService(db)

    async def get_stats(self, days: int = 14) -> AdminPushStatsResponse:
        subscription_count = await self.db.scalar(select(func.count()).select_from(PushSubscription))
        user_count = await self.db.scalar(select(func.count(func.distinct(PushSubscription.user_id))))
        pending_scheduled_count = await self.db.scalar(
            select(func.count()).select_from(ScheduledPush).where(
                ScheduledPush.status == ScheduledPushStatus.pending
            )
        )

        since = datetime.now(timezone.utc) - timedelta(days=max(days, 1) - 1)
        since = since.replace(hour=0, minute=0, second=0, microsecond=0)
        rows = await self.db.execute(
            select(
                func.date(PushSubscription.created_at).label("day"),
                func.count().label("cnt"),
            )
            .where(PushSubscription.created_at >= since)
            .group_by(func.date(PushSubscription.created_at))
            .order_by(func.date(PushSubscription.created_at))
        )
        by_day_map = {str(day): int(cnt) for day, cnt in rows.all()}
        by_day: list[AdminPushDayStat] = []
        cursor = since.date()
        today = datetime.now(timezone.utc).date()
        while cursor <= today:
            key = cursor.isoformat()
            by_day.append(AdminPushDayStat(date=key, subscription_count=by_day_map.get(key, 0)))
            cursor += timedelta(days=1)

        return AdminPushStatsResponse(
            vapid_configured=self.push.vapid_configured(),
            subscription_count=int(subscription_count or 0),
            user_count=int(user_count or 0),
            pending_scheduled_count=int(pending_scheduled_count or 0),
            by_day=by_day,
        )

    async def send_now(self, data: AdminPushSendRequest) -> AdminPushSendResponse:
        if not self.push.vapid_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Web Push не настроен (VAPID_* в .env)",
            )

        user_ids = await self.push.list_user_ids_with_subscriptions()
        payload = {"type": "admin_broadcast", "url": data.url or "/"}
        users_sent = 0
        devices_sent = 0
        errors: list[str] = []
        for user_id in user_ids:
            sent, send_errors = await self.push.send_to_user(
                user_id,
                title=data.title,
                body=data.body,
                payload=payload,
            )
            if sent > 0:
                users_sent += 1
                devices_sent += sent
            errors.extend(send_errors)

        # Keep unique messages, preserve order
        unique_errors: list[str] = []
        for item in errors:
            if item not in unique_errors:
                unique_errors.append(item)

        return AdminPushSendResponse(
            users_targeted=len(user_ids),
            users_sent=users_sent,
            devices_sent=devices_sent,
            errors=unique_errors[:5],
        )

    def _to_response(self, row: ScheduledPush) -> AdminScheduledPushResponse:
        url = None
        if isinstance(row.payload, dict):
            raw_url = row.payload.get("url")
            url = raw_url if isinstance(raw_url, str) else None
        return AdminScheduledPushResponse(
            id=row.id,
            title=row.title,
            body=row.body,
            url=url,
            send_at=row.send_at,
            status=row.status.value if isinstance(row.status, ScheduledPushStatus) else str(row.status),
            created_at=row.created_at,
            sent_at=row.sent_at,
            error=row.error,
            users_sent=row.users_sent,
            devices_sent=row.devices_sent,
        )

    async def list_scheduled(self, limit: int = 50) -> list[AdminScheduledPushResponse]:
        result = await self.db.execute(
            select(ScheduledPush).order_by(ScheduledPush.send_at.desc()).limit(limit)
        )
        return [self._to_response(row) for row in result.scalars().all()]

    async def create_scheduled(
        self,
        data: AdminScheduledPushCreate,
        *,
        created_by_user_id: uuid.UUID | None,
    ) -> AdminScheduledPushResponse:
        send_at = data.send_at
        if send_at.tzinfo is None:
            send_at = send_at.replace(tzinfo=timezone.utc)
        if send_at <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Время отправки должно быть в будущем",
            )

        row = ScheduledPush(
            title=data.title,
            body=data.body,
            payload={"type": "admin_broadcast", "url": data.url or "/"},
            send_at=send_at,
            status=ScheduledPushStatus.pending,
            created_by_user_id=created_by_user_id,
        )
        self.db.add(row)
        await self.db.flush()
        return self._to_response(row)

    async def cancel_scheduled(self, push_id: uuid.UUID) -> None:
        result = await self.db.execute(select(ScheduledPush).where(ScheduledPush.id == push_id))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Оповещение не найдено")
        if row.status != ScheduledPushStatus.pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Можно отменить только ожидающие отправки",
            )
        row.status = ScheduledPushStatus.cancelled
        await self.db.flush()

    async def process_due_scheduled(self) -> int:
        """Send all pending scheduled pushes whose send_at has passed."""
        if not self.push.vapid_configured():
            return 0

        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(ScheduledPush)
            .where(
                ScheduledPush.status == ScheduledPushStatus.pending,
                ScheduledPush.send_at <= now,
            )
            .order_by(ScheduledPush.send_at.asc())
            .limit(20)
        )
        rows = list(result.scalars().all())
        processed = 0

        for row in rows:
            try:
                user_ids = await self.push.list_user_ids_with_subscriptions()
                users_sent = 0
                devices_sent = 0
                payload = row.payload if isinstance(row.payload, dict) else {"type": "admin_broadcast", "url": "/"}
                for user_id in user_ids:
                    sent, _errors = await self.push.send_to_user(
                        user_id,
                        title=row.title,
                        body=row.body,
                        payload=payload,
                    )
                    if sent > 0:
                        users_sent += 1
                        devices_sent += sent
                row.status = ScheduledPushStatus.sent
                row.sent_at = datetime.now(timezone.utc)
                row.users_sent = users_sent
                row.devices_sent = devices_sent
                row.error = None
                processed += 1
            except Exception as exc:
                logger.exception("Failed scheduled push %s", row.id)
                row.status = ScheduledPushStatus.failed
                row.error = str(exc)[:1000]
                processed += 1

        await self.db.flush()
        return processed

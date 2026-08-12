from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session_factory
from app.models.user import AthleteProfile
from app.services.push import PushService
from app.services.schedule import ScheduleService

logger = logging.getLogger(__name__)


async def send_session_reminders(ctx: dict) -> int:
    """Cron: remind athletes ~N minutes before an upcoming session."""
    redis = ctx.get("redis")
    minutes_before = settings.push_reminder_minutes_before
    sent_total = 0

    async with async_session_factory() as db:
        try:
            push = PushService(db)
            if not push.vapid_configured():
                return 0

            user_ids = await push.list_user_ids_with_subscriptions()
            if not user_ids:
                return 0

            for user_id in user_ids:
                sent_total += await _process_user(
                    db,
                    redis,
                    user_id=user_id,
                    minutes_before=minutes_before,
                )

            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("session reminder job failed")
            raise

    return sent_total


async def _process_user(
    db,
    redis,
    *,
    user_id: UUID,
    minutes_before: int,
) -> int:
    result = await db.execute(select(AthleteProfile).where(AthleteProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        return 0

    slots = await ScheduleService(db).list_upcoming_slots_with_dt(profile, horizon_days=2)
    if not slots:
        return 0

    now_utc = datetime.now(timezone.utc)
    day_key = now_utc.astimezone().date().isoformat()
    daily_key = f"push:daily:{user_id}:{day_key}"

    if redis is not None and await redis.exists(daily_key):
        return 0

    for slot_dt, session in slots:
        minutes_until = (slot_dt.astimezone(timezone.utc) - now_utc).total_seconds() / 60
        if not (minutes_before - 0.5 < minutes_until <= minutes_before + 0.5):
            continue

        slot_key = (
            f"push:session:{user_id}:{session.occurrence_date.isoformat()}:{session.start_time}"
        )
        if redis is not None and await redis.exists(slot_key):
            continue

        activity = session.activity_name or "тренировка"
        title = "Скоро тренировка"
        body = f"Через {minutes_before} мин · {session.start_time} · {activity}"
        payload = {
            "type": "session_reminder",
            "occurrence_date": session.occurrence_date.isoformat(),
            "start_time": session.start_time,
            "coach_id": str(session.coach_id),
            "activity_name": session.activity_name,
            "url": "/",
        }

        sent = await PushService(db).send_to_user(
            user_id,
            title=title,
            body=body,
            payload=payload,
        )
        devices_sent, errors = sent
        if devices_sent <= 0:
            if errors:
                logger.warning("Session reminder not delivered: %s", "; ".join(errors[:3]))
            return 0

        if redis is not None:
            await redis.set(slot_key, "1", ex=36 * 3600)
            await redis.set(daily_key, "1", ex=36 * 3600)

        logger.info(
            "Sent session reminder to user=%s slot=%s %s",
            user_id,
            session.occurrence_date,
            session.start_time,
        )
        return devices_sent

    return 0

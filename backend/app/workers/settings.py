from __future__ import annotations

from arq import cron
from arq.connections import RedisSettings

from app.core.config import settings
from app.workers.jobs.session_reminders import send_session_reminders
from app.workers.jobs.scheduled_pushes import process_scheduled_pushes


def _redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.redis_url)


async def startup(ctx: dict) -> None:
    ctx["redis_settings"] = _redis_settings()


class WorkerSettings:
    functions = [send_session_reminders, process_scheduled_pushes]
    cron_jobs = [
        cron(send_session_reminders, minute=set(range(60)), second={0}, run_at_startup=False),
        cron(process_scheduled_pushes, minute=set(range(60)), second={15}, run_at_startup=False),
    ]
    on_startup = startup
    redis_settings = _redis_settings()
    max_jobs = 4

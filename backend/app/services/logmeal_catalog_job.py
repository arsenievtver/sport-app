from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

from app.core.database import async_session_factory
from app.schemas.meal_catalog import CatalogJobStatus, CatalogJobType, MealCatalogJobState
from app.services.logmeal_catalog import LogMealCatalogService

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, int, int, str], Awaitable[None] | None]


@dataclass
class _CatalogJobRuntime:
    status: CatalogJobStatus = "idle"
    job_type: CatalogJobType = "none"
    phase: str = ""
    current: int = 0
    total: int = 0
    message: str = ""
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    task: asyncio.Task[None] | None = field(default=None, repr=False)


class LogMealCatalogJobRunner:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._state = _CatalogJobRuntime()

    def snapshot(self) -> MealCatalogJobState:
        return MealCatalogJobState(
            status=self._state.status,
            job_type=self._state.job_type,
            phase=self._state.phase,
            current=self._state.current,
            total=self._state.total,
            message=self._state.message,
            error=self._state.error,
            started_at=self._state.started_at,
            finished_at=self._state.finished_at,
        )

    def is_running(self) -> bool:
        return self._state.status == "running"

    async def start(self, job_type: Literal["sync", "translate", "full"]) -> None:
        async with self._lock:
            if self._state.status == "running":
                raise CatalogJobAlreadyRunningError()

            self._state = _CatalogJobRuntime(
                status="running",
                job_type=job_type,
                phase="starting",
                message="Запускаем задачу…",
                started_at=datetime.now(UTC),
            )
            self._state.task = asyncio.create_task(self._run(job_type))

    async def _run(self, job_type: Literal["sync", "translate", "full"]) -> None:
        try:
            async with async_session_factory() as db:
                service = LogMealCatalogService(db)

                if job_type in ("sync", "full"):
                    await service.sync_catalog(progress=self._progress_callback)
                    await db.commit()

                if job_type in ("translate", "full"):
                    async with async_session_factory() as db2:
                        service2 = LogMealCatalogService(db2)
                        await service2.translate_all_missing(progress=self._progress_callback)
                        await db2.commit()

            self._state.status = "completed"
            self._state.phase = "done"
            self._state.message = "Готово"
            self._state.finished_at = datetime.now(UTC)
        except Exception as exc:
            logger.exception("Meal catalog job failed")
            self._state.status = "failed"
            self._state.error = str(exc)
            self._state.message = "Ошибка выполнения"
            self._state.finished_at = datetime.now(UTC)
        finally:
            self._state.task = None

    async def _progress_callback(self, phase: str, current: int, total: int, message: str) -> None:
        self._state.phase = phase
        self._state.current = current
        self._state.total = total
        self._state.message = message


class CatalogJobAlreadyRunningError(RuntimeError):
    pass


catalog_job_runner = LogMealCatalogJobRunner()

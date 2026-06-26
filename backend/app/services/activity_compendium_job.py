from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

from app.core.database import async_session_factory
from app.schemas.activity_compendium import ActivityCompendiumJobState
from app.services.activity_compendium import ActivityCompendiumService
from app.services.compendium_parser import CompendiumActivityRow

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, int, int, str], Awaitable[None] | None]
JobType = Literal["import", "translate", "full"]


@dataclass
class _ActivityCompendiumJobRuntime:
    status: str = "idle"
    job_type: str = "none"
    phase: str = ""
    current: int = 0
    total: int = 0
    message: str = ""
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    task: asyncio.Task[None] | None = field(default=None, repr=False)


class ActivityCompendiumJobRunner:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._state = _ActivityCompendiumJobRuntime()
        self._pending_rows: list[CompendiumActivityRow] | None = None

    def snapshot(self) -> ActivityCompendiumJobState:
        return ActivityCompendiumJobState(
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

    async def start_import(
        self,
        rows: list[CompendiumActivityRow],
        *,
        job_type: JobType = "full",
    ) -> None:
        async with self._lock:
            if self._state.status == "running":
                raise ActivityCompendiumJobAlreadyRunningError()
            self._pending_rows = rows
            self._state = _ActivityCompendiumJobRuntime(
                status="running",
                job_type=job_type,
                phase="starting",
                message="Запускаем задачу…",
                started_at=datetime.now(UTC),
            )
            self._state.task = asyncio.create_task(self._run(job_type))

    async def start_translate(self) -> None:
        await self.start_import([], job_type="translate")

    async def _run(self, job_type: JobType) -> None:
        rows = self._pending_rows or []
        try:
            if job_type in ("import", "full") and rows:
                async with async_session_factory() as db:
                    service = ActivityCompendiumService(db)
                    await service.import_rows(rows, progress=self._progress_callback)
                    await db.commit()

            if job_type in ("translate", "full"):
                async with async_session_factory() as db:
                    service = ActivityCompendiumService(db)
                    await service.translate_all_missing(progress=self._progress_callback)
                    await db.commit()

            self._state.status = "completed"
            self._state.phase = "done"
            self._state.message = "Готово"
            self._state.finished_at = datetime.now(UTC)
        except Exception as exc:
            logger.exception("Activity compendium job failed")
            self._state.status = "failed"
            self._state.error = str(exc)
            self._state.message = "Ошибка выполнения"
            self._state.finished_at = datetime.now(UTC)
        finally:
            self._pending_rows = None
            self._state.task = None

    async def _progress_callback(self, phase: str, current: int, total: int, message: str) -> None:
        self._state.phase = phase
        self._state.current = current
        self._state.total = total
        self._state.message = message


class ActivityCompendiumJobAlreadyRunningError(RuntimeError):
    pass


activity_compendium_job_runner = ActivityCompendiumJobRunner()

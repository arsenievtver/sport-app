from __future__ import annotations

import logging

from app.core.database import async_session_factory
from app.services.admin_push import AdminPushService

logger = logging.getLogger(__name__)


async def process_scheduled_pushes(ctx: dict) -> int:
    async with async_session_factory() as db:
        try:
            processed = await AdminPushService(db).process_due_scheduled()
            await db.commit()
            if processed:
                logger.info("Processed %s scheduled push(es)", processed)
            return processed
        except Exception:
            await db.rollback()
            logger.exception("scheduled push job failed")
            raise

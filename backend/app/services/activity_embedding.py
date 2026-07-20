"""Backfill and search activity_types.embedding via Yandex embeddings + pgvector."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.activity_picker import PICKER_ALLOWED_MAJOR_HEADINGS
from app.models.activity_type import ActivityType
from app.services.yandex_foundation import YandexFoundationClient, YandexFoundationError

logger = logging.getLogger(__name__)

DEFAULT_TOP_K = 8


def activity_embedding_text(activity: ActivityType) -> str:
    """Document text stored as vector — RU + EN name helps cross-language matching."""
    parts = [activity.name_ru.strip(), activity.name_en.strip()]
    if activity.major_heading:
        parts.append(activity.major_heading)
    return " / ".join(p for p in parts if p)


class ActivityEmbeddingService:
    def __init__(self, db: AsyncSession, client: YandexFoundationClient | None = None):
        self.db = db
        self.client = client or YandexFoundationClient()

    async def backfill_picker_activities(
        self,
        *,
        force: bool = False,
        sleep_s: float = 0.05,
    ) -> int:
        """Embed allowlisted Compendium activities. Returns number of rows updated."""
        if not self.client.is_configured():
            raise YandexFoundationError("Yandex AI не настроен для embeddings")

        stmt = select(ActivityType).where(
            ActivityType.is_active.is_(True),
            ActivityType.owner_coach_id.is_(None),
            ActivityType.major_heading.in_(PICKER_ALLOWED_MAJOR_HEADINGS),
        )
        if not force:
            stmt = stmt.where(ActivityType.embedding.is_(None))
        stmt = stmt.order_by(ActivityType.compendium_code.asc())

        result = await self.db.execute(stmt)
        rows = list(result.scalars().all())
        updated = 0
        for index, activity in enumerate(rows):
            text = activity_embedding_text(activity)
            try:
                vector = await self.client.embed_text(text, for_document=True)
            except YandexFoundationError:
                logger.exception("Failed to embed activity %s", activity.compendium_code)
                raise
            activity.embedding = vector
            updated += 1
            if sleep_s > 0 and index + 1 < len(rows):
                await asyncio.sleep(sleep_s)
            if updated % 25 == 0:
                await self.db.flush()
                logger.info("Embedded %s / %s activities", updated, len(rows))
        await self.db.flush()
        return updated

    async def ensure_picker_embeddings(self) -> int:
        """Fill missing embeddings before search. No-op if already complete."""
        return await self.backfill_picker_activities(force=False)

    async def search_similar(
        self,
        query_text: str,
        *,
        limit: int = DEFAULT_TOP_K,
    ) -> list[ActivityType]:
        query_vec = await self.client.embed_text(query_text, for_document=False)
        distance = ActivityType.embedding.cosine_distance(query_vec)
        result = await self.db.execute(
            select(ActivityType)
            .where(
                ActivityType.is_active.is_(True),
                ActivityType.owner_coach_id.is_(None),
                ActivityType.major_heading.in_(PICKER_ALLOWED_MAJOR_HEADINGS),
                ActivityType.embedding.is_not(None),
            )
            .order_by(distance)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_ids(self, ids: set[UUID]) -> dict[UUID, ActivityType]:
        if not ids:
            return {}
        result = await self.db.execute(
            select(ActivityType).where(
                ActivityType.id.in_(ids),
                ActivityType.is_active.is_(True),
                ActivityType.owner_coach_id.is_(None),
            )
        )
        return {row.id: row for row in result.scalars().all()}

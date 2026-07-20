#!/usr/bin/env python3
"""Backfill activity_types.embedding via Yandex Foundation Models.

Run against the DB you care about (local or prod) — vectors live in Postgres,
not in git. Same script + same API key works for both environments.

Usage:
  cd backend && python scripts/backfill_activity_embeddings.py
  cd backend && python scripts/backfill_activity_embeddings.py --force
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import async_session_factory  # noqa: E402
from app.services.activity_embedding import ActivityEmbeddingService  # noqa: E402
from app.services.yandex_foundation import YandexFoundationError  # noqa: E402


async def run(*, force: bool) -> None:
    async with async_session_factory() as db:
        service = ActivityEmbeddingService(db)
        if not service.client.is_configured():
            raise SystemExit(
                "Set YANDEX_AI_API_KEY + YANDEX_AI_FOLDER_ID "
                "(or YANDEX_TRANSLATE_API_KEY + YANDEX_TRANSLATE_FOLDER_ID)"
            )
        try:
            updated = await service.backfill_picker_activities(force=force)
        except YandexFoundationError as exc:
            raise SystemExit(str(exc)) from exc
        await db.commit()
    print(f"Updated embeddings for {updated} activities.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill activity embeddings (Yandex)")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-embed rows that already have a vector",
    )
    args = parser.parse_args()
    asyncio.run(run(force=args.force))


if __name__ == "__main__":
    main()

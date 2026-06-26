#!/usr/bin/env python3
"""Import the 2024 Adult Compendium PDF into activity_types (CLI helper).

Usage:
  cd backend && python scripts/import_compendium.py /path/to/compendium.pdf
  cd backend && python scripts/import_compendium.py /path/to/compendium.pdf --translate
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
from app.services.activity_compendium import ActivityCompendiumService  # noqa: E402
from app.services.compendium_parser import parse_compendium_pdf  # noqa: E402


async def run(pdf_path: Path, *, translate: bool) -> None:
    rows = parse_compendium_pdf(pdf_path)
    print(f"Parsed {len(rows)} activities from {pdf_path.name}")

    async with async_session_factory() as db:
        service = ActivityCompendiumService(db)
        await service.import_rows(rows)
        if translate:
            translated = await service.translate_all_missing()
            print(f"Translated {translated} new names")
        await db.commit()

    print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import 2024 Adult Compendium PDF")
    parser.add_argument("pdf", type=Path, help="Path to compendium PDF")
    parser.add_argument(
        "--translate",
        action="store_true",
        help="Translate missing Russian names via Yandex Translate",
    )
    args = parser.parse_args()

    if not args.pdf.is_file():
        raise SystemExit(f"File not found: {args.pdf}")

    asyncio.run(run(args.pdf, translate=args.translate))


if __name__ == "__main__":
    main()

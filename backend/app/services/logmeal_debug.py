from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from app.core.config import settings

DEBUG_DIR_NAME = "logmeal-debug"


def logmeal_debug_dir() -> Path:
    path = Path(settings.media_root) / DEBUG_DIR_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def athlete_debug_path(athlete_id: UUID) -> Path:
    return logmeal_debug_dir() / f"{athlete_id}.json"


def latest_debug_path() -> Path:
    return logmeal_debug_dir() / "latest.json"


def save_logmeal_debug_snapshot(athlete_id: UUID, raw: dict[str, Any]) -> Path:
    payload = {
        "saved_at": datetime.now(UTC).isoformat(),
        "athlete_id": str(athlete_id),
        "raw": raw,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2, default=str)

    athlete_path = athlete_debug_path(athlete_id)
    athlete_path.write_text(text, encoding="utf-8")
    latest_debug_path().write_text(text, encoding="utf-8")
    return athlete_path


def load_logmeal_debug_snapshot(athlete_id: UUID) -> dict[str, Any] | None:
    path = athlete_debug_path(athlete_id)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    if data.get("athlete_id") != str(athlete_id):
        return None
    return data

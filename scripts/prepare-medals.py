#!/usr/bin/env python3
"""Собрать медали зала славы: PNG с прозрачностью → один холст → WebP.

Кладёшь PNG в apps/athlete/medals-src/:
  streak-1m.png  streak-3m.png  streak-6m.png  streak-12m.png

Дальше:
  python3 scripts/prepare-medals.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "apps" / "athlete" / "medals-src"
DST_DIR = ROOT / "apps" / "athlete" / "public" / "medals"

# Один размер для сетки: медаль по центру, запас по краям под крылья и свечение.
CANVAS = (800, 1000)
NAMES = ("streak-1m", "streak-3m", "streak-6m", "streak-12m")
# Медаль занимает ~86% холста, остальное — прозрачные поля.
FIT_RATIO = 0.86


def load_png(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bbox = image.getbbox()
    if bbox is None:
        raise SystemExit(f"{path.name}: пустое изображение")
    return image.crop(bbox)


def fit_on_canvas(medal: Image.Image) -> Image.Image:
    max_w = int(CANVAS[0] * FIT_RATIO)
    max_h = int(CANVAS[1] * FIT_RATIO)
    scale = min(max_w / medal.width, max_h / medal.height)
    size = (max(1, round(medal.width * scale)), max(1, round(medal.height * scale)))
    fitted = medal.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.paste(
        fitted,
        ((CANVAS[0] - fitted.width) // 2, (CANVAS[1] - fitted.height) // 2),
        fitted,
    )
    return canvas


def main() -> None:
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    DST_DIR.mkdir(parents=True, exist_ok=True)

    missing = [name for name in NAMES if not (SRC_DIR / f"{name}.png").exists()]
    if missing:
        names = ", ".join(f"{name}.png" for name in missing)
        raise SystemExit(f"Нет файлов в {SRC_DIR}: {names}")

    for name in NAMES:
        src = SRC_DIR / f"{name}.png"
        dst = DST_DIR / f"{name}.webp"
        canvas = fit_on_canvas(load_png(src))
        canvas.save(dst, format="WEBP", quality=92, method=6)
        print(f"{src.name} → {dst.relative_to(ROOT)} {canvas.size} {dst.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()

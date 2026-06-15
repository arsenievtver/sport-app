import io
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024


def _require_pillow():
    try:
        from PIL import Image, UnidentifiedImageError

        return Image, UnidentifiedImageError
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Обработка фото недоступна: перезапустите API через ./scripts/start.sh",
        ) from exc


def avatars_dir() -> Path:
    path = Path(settings.media_root) / "avatars"
    path.mkdir(parents=True, exist_ok=True)
    return path


def avatar_filename(profile_id: UUID) -> str:
    return f"{profile_id}.jpg"


def avatar_relative_url(profile_id: UUID, *, version: int | None = None) -> str:
    suffix = f"?v={version}" if version is not None else ""
    return f"/media/avatars/{avatar_filename(profile_id)}{suffix}"


async def save_avatar(profile_id: UUID, upload: UploadFile) -> str:
    Image, UnidentifiedImageError = _require_pillow()
    if upload.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Поддерживаются только JPEG, PNG и WebP",
        )

    raw = await upload.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пустой файл")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Файл слишком большой")

    try:
        image = Image.open(io.BytesIO(raw))
        image = image.convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось прочитать изображение") from exc

    side = min(image.width, image.height)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    image = image.resize((settings.avatar_size_px, settings.avatar_size_px), Image.Resampling.LANCZOS)

    out_path = avatars_dir() / avatar_filename(profile_id)
    image.save(out_path, format="JPEG", quality=settings.avatar_jpeg_quality, optimize=True)

    return avatar_relative_url(profile_id, version=int(out_path.stat().st_mtime))

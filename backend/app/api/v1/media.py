from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.services.media import avatar_filename, avatars_dir

router = APIRouter(prefix="/media")


@router.get("/avatars/{profile_id}.jpg")
async def get_avatar(profile_id: UUID) -> FileResponse:
    path = avatars_dir() / avatar_filename(profile_id)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аватар не найден")
    return FileResponse(path, media_type="image/jpeg")

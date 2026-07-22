from fastapi import APIRouter

from app.api.v1 import admin, auth, athlete, athlete_chat, coach, health, media, whoop

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(athlete.router, tags=["athlete"])
api_router.include_router(athlete_chat.router)
api_router.include_router(coach.router, tags=["coach"])
api_router.include_router(media.router, tags=["media"])
api_router.include_router(whoop.router, tags=["integrations"])

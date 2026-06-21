from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

cors_kwargs: dict = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.cors_allow_origin_regex:
    cors_kwargs["allow_origin_regex"] = settings.cors_allow_origin_regex
else:
    cors_kwargs["allow_origins"] = settings.cors_origins

app.add_middleware(CORSMiddleware, **cors_kwargs)

app.include_router(api_router, prefix=settings.api_v1_prefix)

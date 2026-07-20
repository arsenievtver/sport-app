from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "sport-app API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://sport:sport@localhost:5433/sport_app"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
    ]
    cors_allow_origin_regex: str | None = None

    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minio"
    s3_secret_key: str = "miniosecret"
    s3_bucket: str = "sport-app"

    media_root: str = "uploads"
    avatar_size_px: int = 512
    avatar_jpeg_quality: int = 85

    whoop_client_id: str | None = None
    whoop_client_secret: str | None = None
    whoop_redirect_uri: str = "http://localhost:8000/api/v1/integrations/whoop/callback"
    athlete_app_url: str = "http://localhost:5173"

    # LogMeal: APICompanyToken — signup / управление пользователями (⚫ admin).
    logmeal_api_company_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("LOGMEAL_API_COMPANY_TOKEN", "LOGMEAL_API_KEY"),
    )
    # LogMeal: APIUserToken — распознавание фото и калории (🔴 APIUser, напр. APIUser_Alex_19).
    logmeal_api_user_token: str | None = None
    logmeal_language: str = "eng"

    # Yandex Cloud Translate — кэш русских названий блюд LogMeal (EN → RU)
    yandex_translate_api_key: str | None = None
    yandex_translate_folder_id: str | None = None
    food_translation_source_lang: str = "en"
    food_translation_target_lang: str = "ru"
    logmeal_catalog_sync_max_age_days: int = 7

    # Yandex Foundation Models (embeddings + YandexGPT). Falls back to Translate key/folder.
    # API key needs scope yc.ai.foundationModels.execute.
    yandex_ai_api_key: str | None = None
    yandex_ai_folder_id: str | None = None
    yandex_gpt_model: str = "yandexgpt-lite/latest"
    # emb://… model suffixes (256-dim)
    yandex_embedding_doc_model: str = "text-search-doc/latest"
    yandex_embedding_query_model: str = "text-search-query/latest"


settings = Settings()

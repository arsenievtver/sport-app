import re
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
import bcrypt

from app.core.config import settings

PHONE_PATTERN = re.compile(r"^7\d{10}$")
PIN_PATTERN = re.compile(r"^\d{6}$")

ALGORITHM = "HS256"
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw.strip())
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    if digits.startswith("7") and len(digits) == 11:
        return digits
    raise ValueError("phone must be 11 digits starting with 7, e.g. 79106492742")


def validate_phone(phone: str) -> str:
    normalized = normalize_phone(phone)
    if not PHONE_PATTERN.match(normalized):
        raise ValueError("phone must be 11 digits starting with 7, e.g. 79106492742")
    return normalized


def validate_pin(pin: str) -> str:
    if not PIN_PATTERN.match(pin):
        raise ValueError("pin must be exactly 6 digits")
    return pin


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(validate_pin(pin).encode(), bcrypt.gensalt()).decode()


def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    try:
        return bcrypt.checkpw(validate_pin(plain_pin).encode(), hashed_pin.encode())
    except ValueError:
        return False


def _create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_access_token(user_id: UUID) -> str:
    return _create_token(
        str(user_id),
        TOKEN_TYPE_ACCESS,
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: UUID) -> str:
    return _create_token(
        str(user_id),
        TOKEN_TYPE_REFRESH,
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])


def generate_invite_code() -> str:
    return secrets.token_hex(4).upper()

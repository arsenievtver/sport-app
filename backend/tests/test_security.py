import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_pin,
    normalize_phone,
    validate_phone,
    validate_pin,
    verify_pin,
)
from uuid import uuid4


class TestPhone:
    def test_normalize_from_8_prefix(self):
        assert normalize_phone("89106492742") == "79106492742"

    def test_normalize_strips_formatting(self):
        assert normalize_phone("+7 (910) 649-27-42") == "79106492742"

    def test_validate_phone(self):
        assert validate_phone("79106492742") == "79106492742"

    def test_invalid_phone(self):
        with pytest.raises(ValueError):
            validate_phone("69106492742")


class TestPin:
    def test_validate_pin(self):
        assert validate_pin("123456") == "123456"

    def test_invalid_pin_length(self):
        with pytest.raises(ValueError):
            validate_pin("12345")

    def test_invalid_pin_letters(self):
        with pytest.raises(ValueError):
            validate_pin("12ab56")

    def test_hash_and_verify(self):
        hashed = hash_pin("654321")
        assert verify_pin("654321", hashed)
        assert not verify_pin("111111", hashed)


class TestJwt:
    def test_access_and_refresh_tokens(self):
        user_id = uuid4()
        access = create_access_token(user_id)
        refresh = create_refresh_token(user_id)

        access_payload = decode_token(access)
        refresh_payload = decode_token(refresh)

        assert access_payload["sub"] == str(user_id)
        assert access_payload["type"] == "access"
        assert refresh_payload["type"] == "refresh"

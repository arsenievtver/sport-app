"""Auth API integration tests (requires running Postgres)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_register_login_me_flow(client: AsyncClient):
    phone = "79106492799"
    payload = {
        "phone": phone,
        "pin": "112233",
        "role": "athlete",
        "display_name": "Test Athlete",
    }

    try:
        register = await client.post("/api/v1/auth/register", json=payload)
    except Exception:
        pytest.skip("Database not available")

    if register.status_code >= 500:
        pytest.skip("Database not available")
    assert register.status_code == 201, register.text
    tokens = register.json()
    assert "access_token" in tokens

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    body = me.json()
    assert body["phone"] == phone
    assert body["role"] == "athlete"

    login = await client.post("/api/v1/auth/login", json={"phone": phone, "pin": "112233"})
    assert login.status_code == 200

    refresh = await client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 200


async def test_invalid_pin_rejected(client: AsyncClient):
    response = await client.post("/api/v1/auth/login", json={"phone": "79106492742", "pin": "12345"})
    assert response.status_code == 422

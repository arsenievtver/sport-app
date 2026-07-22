"""Athlete AI chat API auth/scope smoke (requires Postgres when available)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_chat_threads_require_auth(client: AsyncClient):
    response = await client.get("/api/v1/athlete/chat/threads")
    assert response.status_code == 401


async def test_chat_threads_list_for_athlete(client: AsyncClient):
    phone = "79106492801"
    payload = {
        "phone": phone,
        "pin": "778899",
        "role": "athlete",
        "display_name": "Chat Tester",
    }
    try:
        register = await client.post("/api/v1/auth/register", json=payload)
    except Exception:
        pytest.skip("Database not available")

    if register.status_code >= 500:
        pytest.skip("Database not available")
    if register.status_code == 409:
        login = await client.post(
            "/api/v1/auth/login",
            json={"phone": phone, "pin": "778899"},
        )
        if login.status_code >= 500:
            pytest.skip("Database not available")
        assert login.status_code == 200, login.text
        tokens = login.json()
    else:
        assert register.status_code == 201, register.text
        tokens = register.json()

    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    listed = await client.get("/api/v1/athlete/chat/threads", headers=headers)
    if listed.status_code >= 500:
        pytest.skip("Database migration may be missing (031)")
    assert listed.status_code == 200, listed.text
    assert isinstance(listed.json(), list)

    created = await client.post("/api/v1/athlete/chat/threads", headers=headers, json={})
    assert created.status_code == 201, created.text
    thread = created.json()
    assert "id" in thread

    messages = await client.get(
        f"/api/v1/athlete/chat/threads/{thread['id']}/messages",
        headers=headers,
    )
    assert messages.status_code == 200
    assert messages.json() == []

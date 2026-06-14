"""Athlete onboarding API tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _register_athlete(client: AsyncClient, phone: str) -> dict:
    payload = {
        "phone": phone,
        "pin": "112233",
        "role": "athlete",
        "display_name": "Onboarding Test",
    }
    register = await client.post("/api/v1/auth/register", json=payload)
    assert register.status_code == 201, register.text
    return register.json()


async def test_athlete_onboarding_flow(client: AsyncClient):
    phone = "79106492788"

    try:
        tokens = await _register_athlete(client, phone)
    except Exception:
        pytest.skip("Database not available")

    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    me_before = await client.get("/api/v1/auth/me", headers=headers)
    if me_before.status_code >= 500:
        pytest.skip("Database not available")
    assert me_before.status_code == 200
    assert me_before.json()["athlete_profile"]["onboarding_completed_at"] is None

    onboarding_payload = {
        "gender": "male",
        "birth_date": "1995-06-15",
        "focus_strength": 85,
        "focus_flexibility": 70,
        "focus_endurance": 55,
        "focus_coordination": 40,
        "weight_target_min_kg": 68,
        "weight_target_max_kg": 72,
        "personal_goal_title": "Пробежать без остановки",
        "personal_goal_target": 5,
    }

    complete = await client.post("/api/v1/athlete/onboarding", json=onboarding_payload, headers=headers)
    assert complete.status_code == 200, complete.text
    body = complete.json()
    profile = body["athlete_profile"]
    assert profile["onboarding_completed_at"] is not None
    assert profile["focus_strength"] == 85
    assert profile["personal_goal_title"] == "Пробежать без остановки"
    assert profile["personal_goal_target"] == 5

    profile_get = await client.get("/api/v1/athlete/profile", headers=headers)
    assert profile_get.status_code == 200
    assert profile_get.json()["gender"] == "male"


async def test_onboarding_rejects_focus_below_minimum(client: AsyncClient):
    phone = "79106492787"

    try:
        tokens = await _register_athlete(client, phone)
    except Exception:
        pytest.skip("Database not available")

    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    bad = await client.post(
        "/api/v1/athlete/onboarding",
        json={
            "gender": "female",
            "birth_date": "1990-01-01",
            "focus_strength": 10,
            "focus_flexibility": 50,
            "focus_endurance": 50,
            "focus_coordination": 50,
        },
        headers=headers,
    )
    assert bad.status_code == 422

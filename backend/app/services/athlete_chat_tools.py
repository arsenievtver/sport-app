"""Athlete AI tool registry: schemas + handlers scoped to one athlete."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AthleteProfile
from app.services.llm_chat import LlmToolSpec

ToolHandler = Callable[[AthleteProfile, dict[str, Any]], Awaitable[Any]]


@dataclass(frozen=True)
class AthleteTool:
    spec: LlmToolSpec
    handler: ToolHandler


class AthleteToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, AthleteTool] = {}

    def register(self, tool: AthleteTool) -> None:
        self._tools[tool.spec.name] = tool

    def specs(self) -> list[LlmToolSpec]:
        return [t.spec for t in self._tools.values()]

    def get(self, name: str) -> AthleteTool | None:
        return self._tools.get(name)

    async def call(self, name: str, profile: AthleteProfile, arguments: dict[str, Any]) -> str:
        tool = self._tools.get(name)
        if tool is None:
            return json.dumps({"error": f"Unknown tool: {name}"}, ensure_ascii=False)
        try:
            result = await tool.handler(profile, arguments or {})
            return _compact_json(result)
        except Exception as exc:  # noqa: BLE001 — surface to LLM as tool error
            return json.dumps({"error": str(exc)}, ensure_ascii=False)


def _compact_json(value: Any) -> str:
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json")
    elif isinstance(value, list) and value and hasattr(value[0], "model_dump"):
        value = [item.model_dump(mode="json") for item in value]
    return json.dumps(value, ensure_ascii=False, default=str)


def build_stub_registry() -> AthleteToolRegistry:
    """Minimal registry for agent unit tests without DB services."""

    async def ping(_profile: AthleteProfile, args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True, "echo": args.get("message", "")}

    async def get_profile_stub(profile: AthleteProfile, _args: dict[str, Any]) -> dict[str, Any]:
        return {
            "display_name": profile.display_name,
            "id": str(profile.id) if getattr(profile, "id", None) else None,
        }

    registry = AthleteToolRegistry()
    registry.register(
        AthleteTool(
            spec=LlmToolSpec(
                name="ping",
                description="Echo a test message.",
                parameters={
                    "type": "object",
                    "properties": {"message": {"type": "string"}},
                    "additionalProperties": False,
                },
            ),
            handler=ping,
        )
    )
    registry.register(
        AthleteTool(
            spec=LlmToolSpec(
                name="get_profile",
                description="Get athlete profile basics.",
                parameters={
                    "type": "object",
                    "properties": {"_unused": {"type": "string"}},
                    "additionalProperties": False,
                },
            ),
            handler=get_profile_stub,
        )
    )
    return registry


def build_athlete_tool_registry(db: AsyncSession) -> AthleteToolRegistry:
    """Live read-only tools over existing athlete services."""
    from app.services.athlete import AthleteService, SESSION_HISTORY_DAYS
    from app.services.athlete_meals import AthleteMealsService
    from app.services.athlete_plan import AthletePlanService
    from app.services.athlete_weight import AthleteWeightService
    from app.services.schedule import ScheduleService
    from app.services.whoop import WhoopService

    athlete_svc = AthleteService(db)
    plan_svc = AthletePlanService(db)
    weight_svc = AthleteWeightService(db)
    meals_svc = AthleteMealsService(db)
    schedule_svc = ScheduleService(db)
    whoop_svc = WhoopService(db)

    registry = AthleteToolRegistry()

    async def get_profile(profile: AthleteProfile, _args: dict[str, Any]) -> dict[str, Any]:
        return {
            "display_name": profile.display_name,
            "gender": getattr(profile.gender, "value", profile.gender),
            "birth_date": profile.birth_date.isoformat() if profile.birth_date else None,
            "timezone": profile.timezone,
            "focus": {
                "strength": profile.focus_strength,
                "flexibility": profile.focus_flexibility,
                "endurance": profile.focus_endurance,
                "coordination": profile.focus_coordination,
            },
            "weight_target_min_kg": profile.weight_target_min_kg,
            "weight_target_max_kg": profile.weight_target_max_kg,
            "personal_goal_title": profile.personal_goal_title,
            "personal_goal_target": profile.personal_goal_target,
        }

    async def get_plan(profile: AthleteProfile, _args: dict[str, Any]) -> Any:
        return await plan_svc.get_plan(profile)

    async def get_week_progress(profile: AthleteProfile, _args: dict[str, Any]) -> Any:
        return await plan_svc.get_week_progress(profile)

    async def get_sessions_stats(profile: AthleteProfile, _args: dict[str, Any]) -> Any:
        return await athlete_svc.get_sessions_stats(profile)

    async def get_session_history(profile: AthleteProfile, args: dict[str, Any]) -> Any:
        days = int(args.get("days") or SESSION_HISTORY_DAYS)
        days = max(1, min(days, 90))
        items = await athlete_svc.list_session_history(profile, days=days)
        return [
            {
                "date": i.entry_date.isoformat(),
                "activity": i.activity_name,
                "duration_min": i.duration_min,
                "effort": i.effort,
                "calories_kcal": i.calories_kcal,
                "coach": i.coach_display_name,
            }
            for i in items
        ]

    async def get_upcoming_schedule(profile: AthleteProfile, args: dict[str, Any]) -> Any:
        days = int(args.get("days") or 7)
        days = max(1, min(days, 56))
        items = await schedule_svc.list_upcoming_for_athlete(profile, days=days)
        return [
            {
                "date": i.occurrence_date.isoformat(),
                "time": i.start_time,
                "duration_min": i.duration_min,
                "activity": i.activity_name,
                "coach": i.coach_display_name,
            }
            for i in items
        ]

    async def get_weight_dynamics(profile: AthleteProfile, _args: dict[str, Any]) -> Any:
        return await weight_svc.get_dynamics(profile)

    async def get_meals(profile: AthleteProfile, args: dict[str, Any]) -> Any:
        days = int(args.get("days") or 7)
        days = max(1, min(days, 30))
        limit = int(args.get("limit") or 50)
        limit = max(1, min(limit, 100))
        data = await meals_svc.list_entries(profile, limit=limit, days=days)
        return {
            "days": days,
            "meals": [
                {
                    "at": e.entry_at.isoformat() if e.entry_at else None,
                    "title": e.title,
                    "calories_kcal": e.calories_kcal,
                    "protein_g": e.protein_g,
                    "carbs_g": e.carbs_g,
                    "fat_g": e.fat_g,
                    "weight_g": e.weight_g,
                }
                for e in data.entries
            ],
        }

    async def get_whoop_summary(profile: AthleteProfile, _args: dict[str, Any]) -> dict[str, Any]:
        connection = await whoop_svc.get_connection(profile.id)
        if connection is None:
            return {"connected": False}
        payload = connection.last_sync_payload or {}
        recovery = payload.get("recovery") if isinstance(payload, dict) else None
        sleep = payload.get("sleep") if isinstance(payload, dict) else None
        return {
            "connected": True,
            "last_sync_at": connection.last_sync_at.isoformat() if connection.last_sync_at else None,
            "last_sync_error": connection.last_sync_error,
            "recovery": _whoop_slice(recovery),
            "sleep": _whoop_slice(sleep),
            "body_measurement": payload.get("body_measurement") if isinstance(payload, dict) else None,
        }

    empty_props = {
        "type": "object",
        "properties": {"_unused": {"type": "string"}},
        "additionalProperties": False,
    }

    for name, desc, handler, params in (
        ("get_profile", "Get athlete profile and goals.", get_profile, empty_props),
        ("get_plan", "Get training plan and calorie targets.", get_plan, empty_props),
        (
            "get_week_progress",
            "Get this week plan progress.",
            get_week_progress,
            empty_props,
        ),
        ("get_sessions_stats", "Get total completed sessions.", get_sessions_stats, empty_props),
        (
            "get_session_history",
            "List recent workout sessions.",
            get_session_history,
            {
                "type": "object",
                "properties": {"days": {"type": "integer", "minimum": 1, "maximum": 90}},
                "additionalProperties": False,
            },
        ),
        (
            "get_upcoming_schedule",
            "List upcoming scheduled sessions.",
            get_upcoming_schedule,
            {
                "type": "object",
                "properties": {"days": {"type": "integer", "minimum": 1, "maximum": 56}},
                "additionalProperties": False,
            },
        ),
        ("get_weight_dynamics", "Get recent weight measurements.", get_weight_dynamics, empty_props),
        (
            "get_meals",
            "List recent meal entries.",
            get_meals,
            {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "minimum": 1, "maximum": 30},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 100},
                },
                "additionalProperties": False,
            },
        ),
        ("get_whoop_summary", "Get WHOOP recovery/sleep summary.", get_whoop_summary, empty_props),
    ):
        registry.register(
            AthleteTool(
                spec=LlmToolSpec(name=name, description=desc, parameters=params),
                handler=handler,
            )
        )

    return registry


def _whoop_slice(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, list):
        return value[:3]
    if isinstance(value, dict):
        # Prefer latest records if nested lists
        out: dict[str, Any] = {}
        for key, item in list(value.items())[:12]:
            if isinstance(item, list):
                out[key] = item[:2]
            else:
                out[key] = item
        return out
    return value

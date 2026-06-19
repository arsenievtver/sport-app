from uuid import UUID

RECENT_ACTIVITY_TYPES_MAX = 6


def remember_recent_activity_type(
    current: list | None,
    activity_type_id: UUID,
    *,
    limit: int = RECENT_ACTIVITY_TYPES_MAX,
) -> list[str]:
    id_str = str(activity_type_id)
    previous = [str(item) for item in (current or []) if str(item) != id_str]
    return [id_str, *previous][:limit]

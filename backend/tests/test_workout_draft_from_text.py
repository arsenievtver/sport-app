from app.services.workout_draft_from_text import (
    _extract_json,
    expand_query_for_embedding,
    split_coach_text,
)


def test_split_coach_text_by_potom_and_durations() -> None:
    segments = split_coach_text("суставная разминка 10 мин, потом лёгкий бег 20, затем растяжка 10")
    assert len(segments) == 3
    assert segments[0].phrase.lower().startswith("суставная")
    assert segments[0].duration_min == 10
    assert "бег" in segments[1].phrase.lower()
    assert segments[1].duration_min == 20
    assert segments[2].duration_min == 10


def test_split_coach_text_newlines() -> None:
    segments = split_coach_text("разминка 10\nбег 20\nзаминка 5")
    assert [s.duration_min for s in segments] == [10, 20, 5]


def test_split_coach_text_multiline_minutes() -> None:
    text = (
        "Суставная разминка 10 минут\n"
        "Гребля на тренажере 10 минут\n"
        "Работа на тренажерах 30 минут\n"
        "Заминка и растяжка 10 минут"
    )
    segments = split_coach_text(text)
    assert len(segments) == 4
    assert [s.duration_min for s in segments] == [10, 10, 30, 10]
    assert "Гребля" in segments[1].phrase


def test_expand_query_adds_hints_for_warmup() -> None:
    expanded = expand_query_for_embedding("Суставная разминка")
    assert "Суставная разминка" in expanded
    assert "mobility" in expanded
    assert "stretching" in expanded


def test_extract_json_ignores_trailing_text() -> None:
    raw = """{
  "name": "Силовая",
  "intervals": [
    {"source_activity_type_id": "11111111-1111-1111-1111-111111111111", "duration_min": 10, "label": "разминка"}
  ]
}
Пояснение: выбрал лёгкую гимнастику.
"""
    data = _extract_json(raw)
    assert data["name"] == "Силовая"
    assert len(data["intervals"]) == 1


def test_extract_json_strips_markdown_fence() -> None:
    raw = """```json
{"name": "Бег", "intervals": []}
```
готово"""
    data = _extract_json(raw)
    assert data["name"] == "Бег"

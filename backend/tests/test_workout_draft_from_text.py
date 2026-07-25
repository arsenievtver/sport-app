from app.services.workout_draft_from_text import (
    BARE_DURATION_UNITS_HINT,
    _extract_json,
    ensure_coach_text_splittable,
    expand_query_for_embedding,
    has_ambiguous_bare_durations,
    split_coach_text,
)
from fastapi import HTTPException
import pytest


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


def test_split_coach_text_dictation_activity_then_duration() -> None:
    text = (
        "Беговая дорожка 5 минут суставная разминка 3 минуты скакалка 2 минуты "
        "силовые тренажеры 40 минут растяжка 10 минут"
    )
    segments = split_coach_text(text)
    assert len(segments) == 5
    # Durations below 5 are clamped to 5 by _parse_segment.
    assert [s.duration_min for s in segments] == [5, 5, 5, 40, 10]
    assert "беговая" in segments[0].phrase.lower()
    assert "суставная" in segments[1].phrase.lower()
    assert "скакалка" in segments[2].phrase.lower()
    assert "тренажер" in segments[3].phrase.lower()
    assert "растяжка" in segments[4].phrase.lower()


def test_split_coach_text_dictation_duration_then_activity() -> None:
    text = (
        "5 минут беговая дорожка 3 минуты суставная разминка "
        "2 минуты скакалка 40 минут силовые тренажеры 10 минут растяжка"
    )
    segments = split_coach_text(text)
    assert len(segments) == 5
    assert [s.duration_min for s in segments] == [5, 5, 5, 40, 10]
    assert "беговая" in segments[0].phrase.lower()
    assert "суставная" in segments[1].phrase.lower()
    assert "скакалка" in segments[2].phrase.lower()
    assert "тренажер" in segments[3].phrase.lower()
    assert "растяжка" in segments[4].phrase.lower()


def test_has_ambiguous_bare_durations_continuous() -> None:
    assert has_ambiguous_bare_durations("бег 20 разминка 10")
    assert not has_ambiguous_bare_durations("лёгкий бег 20 мин")
    assert not has_ambiguous_bare_durations("бег 20 мин разминка 10 мин")


def test_ensure_coach_text_splittable_rejects_bare_numbers() -> None:
    with pytest.raises(HTTPException) as exc_info:
        ensure_coach_text_splittable("бег 20 разминка 10 силовая 40")
    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == BARE_DURATION_UNITS_HINT


def test_ensure_coach_text_splittable_allows_newlines_with_bare_numbers() -> None:
    segments = ensure_coach_text_splittable("бег 20\nразминка 10\nсиловая 40")
    assert len(segments) == 3


def test_ensure_coach_text_splittable_allows_units_in_one_line() -> None:
    segments = ensure_coach_text_splittable("бег 20 мин разминка 10 мин силовая 40 мин")
    assert len(segments) == 3


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

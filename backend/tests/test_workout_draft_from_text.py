from app.services.workout_draft_from_text import split_coach_text


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

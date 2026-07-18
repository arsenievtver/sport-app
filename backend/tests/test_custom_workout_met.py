from app.services.coach_custom_workout import calculate_weighted_average_met


def test_weighted_average_met_basic():
    average, duration, load = calculate_weighted_average_met([(8.0, 30), (3.5, 30)])
    assert duration == 60
    assert load == 345.0
    assert average == 5.75


def test_weighted_average_met_single():
    average, duration, load = calculate_weighted_average_met([(6.0, 45)])
    assert duration == 45
    assert load == 270.0
    assert average == 6.0

from datetime import date

from services.bill_schedule import (
    compute_bill_occurrences,
    compute_recurring_expense_occurrences,
)


# ===================== compute_bill_occurrences =====================


def test_monthly_bill_single_occurrence_in_window():
    occurrences = compute_bill_occurrences(
        due_day=15, frequency="monthly", start=date(2026, 1, 1), end=date(2026, 1, 31)
    )
    assert occurrences == [date(2026, 1, 15)]


def test_monthly_bill_clamps_to_days_in_month():
    # due_day=31 in February clamps to Feb 28/29
    occurrences = compute_bill_occurrences(
        due_day=31, frequency="monthly", start=date(2026, 2, 1), end=date(2026, 2, 28)
    )
    assert occurrences == [date(2026, 2, 28)]


def test_monthly_bill_spans_multiple_months():
    occurrences = compute_bill_occurrences(
        due_day=1, frequency="monthly", start=date(2026, 1, 15), end=date(2026, 3, 15)
    )
    assert occurrences == [date(2026, 2, 1), date(2026, 3, 1)]


def test_weekly_bill_occurrences():
    # due_day=1 (Monday), window covers 2 Mondays
    occurrences = compute_bill_occurrences(
        due_day=1, frequency="weekly", start=date(2026, 1, 1), end=date(2026, 1, 14)
    )
    assert occurrences == [date(2026, 1, 5), date(2026, 1, 12)]


def test_annual_bill_occurrence():
    occurrences = compute_bill_occurrences(
        due_day=32, frequency="annual", start=date(2026, 1, 1), end=date(2026, 12, 31)
    )
    assert occurrences == [date(2026, 2, 1)]


def test_unknown_frequency_returns_empty():
    assert compute_bill_occurrences(1, "biweekly", date(2026, 1, 1), date(2026, 1, 31)) == []


# ===================== compute_recurring_expense_occurrences =====================


def test_daily_recurring_within_window():
    occurrences = compute_recurring_expense_occurrences(
        recurring_start_date=date(2026, 1, 1),
        frequency="daily",
        recurring_end_date=None,
        window_start=date(2026, 1, 10),
        window_end=date(2026, 1, 12),
    )
    assert occurrences == [date(2026, 1, 10), date(2026, 1, 11), date(2026, 1, 12)]


def test_daily_recurring_started_years_ago_stays_bounded():
    # Regression guard: an old daily recurrence must not iterate over years
    # of history — it should jump straight to the window.
    occurrences = compute_recurring_expense_occurrences(
        recurring_start_date=date(2020, 1, 1),
        frequency="daily",
        recurring_end_date=None,
        window_start=date(2026, 1, 1),
        window_end=date(2026, 1, 3),
    )
    assert occurrences == [date(2026, 1, 1), date(2026, 1, 2), date(2026, 1, 3)]


def test_weekly_recurring_respects_phase():
    occurrences = compute_recurring_expense_occurrences(
        recurring_start_date=date(2026, 1, 1),  # Thursday
        frequency="weekly",
        recurring_end_date=None,
        window_start=date(2026, 1, 10),
        window_end=date(2026, 1, 20),
    )
    assert occurrences == [date(2026, 1, 15)]


def test_monthly_recurring_preserves_day_of_month():
    occurrences = compute_recurring_expense_occurrences(
        recurring_start_date=date(2025, 1, 31),
        frequency="monthly",
        recurring_end_date=None,
        window_start=date(2026, 1, 1),
        window_end=date(2026, 3, 31),
    )
    # Jan 31 -> Feb clamps to 28 -> Mar back to 31
    assert occurrences == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31)]


def test_recurring_end_date_cuts_off_occurrences():
    occurrences = compute_recurring_expense_occurrences(
        recurring_start_date=date(2026, 1, 1),
        frequency="daily",
        recurring_end_date=date(2026, 1, 2),
        window_start=date(2026, 1, 1),
        window_end=date(2026, 1, 10),
    )
    assert occurrences == [date(2026, 1, 1), date(2026, 1, 2)]


def test_yearly_recurring_across_years():
    occurrences = compute_recurring_expense_occurrences(
        recurring_start_date=date(2024, 6, 15),
        frequency="yearly",
        recurring_end_date=None,
        window_start=date(2026, 1, 1),
        window_end=date(2027, 12, 31),
    )
    assert occurrences == [date(2026, 6, 15), date(2027, 6, 15)]


def test_start_date_after_window_returns_empty():
    occurrences = compute_recurring_expense_occurrences(
        recurring_start_date=date(2027, 1, 1),
        frequency="daily",
        recurring_end_date=None,
        window_start=date(2026, 1, 1),
        window_end=date(2026, 1, 31),
    )
    assert occurrences == []

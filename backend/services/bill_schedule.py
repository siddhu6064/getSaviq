"""
Pure date-occurrence math for the cash-flow forecast. Kept separate from any
DB access so it's trivially unit-testable. All functions are bounded by the
requested window, not by how far in the past a recurrence started — a
recurring item that began years ago must not make these loop over years of
history.
"""
import calendar
from datetime import date, timedelta
from typing import List, Optional


def compute_bill_occurrences(
    due_day: int, frequency: str, start: date, end: date
) -> List[date]:
    """
    All due dates for a recurring Bill (due_day/frequency model, as used by
    routers/bills.py) that fall within [start, end] inclusive.
    """
    occurrences: List[date] = []

    if frequency == "monthly":
        cursor = date(start.year, start.month, 1)
        while cursor <= end:
            days_in_month = calendar.monthrange(cursor.year, cursor.month)[1]
            occurrence = cursor.replace(day=min(due_day, days_in_month))
            if start <= occurrence <= end:
                occurrences.append(occurrence)
            cursor = (
                date(cursor.year + 1, 1, 1)
                if cursor.month == 12
                else date(cursor.year, cursor.month + 1, 1)
            )

    elif frequency == "weekly":
        target_weekday = (due_day - 1) % 7  # due_day: 1=Mon..7=Sun -> 0=Mon..6=Sun
        cursor = start
        while cursor <= end:
            if cursor.weekday() == target_weekday:
                occurrences.append(cursor)
            cursor += timedelta(days=1)

    elif frequency == "annual":
        for year in range(start.year, end.year + 1):
            occurrence = date(year, 1, 1) + timedelta(days=due_day - 1)
            if start <= occurrence <= end:
                occurrences.append(occurrence)

    return occurrences


def _add_years(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        # Feb 29 on a non-leap target year
        return d.replace(year=d.year + years, day=28)


def _add_months(d: date, day_of_month: int, months: int) -> date:
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    days_in_month = calendar.monthrange(year, month)[1]
    return date(year, month, min(day_of_month, days_in_month))


def compute_recurring_expense_occurrences(
    recurring_start_date: date,
    frequency: str,
    recurring_end_date: Optional[date],
    window_start: date,
    window_end: date,
    max_occurrences: int = 200,
) -> List[date]:
    """
    All due dates for a recurring Expense (recurring_start_date/frequency/
    recurring_end_date model, as used by routers/expenses.py) that fall
    within [window_start, window_end] inclusive. Jumps directly near
    window_start rather than stepping one period at a time from
    recurring_start_date, so an old recurrence doesn't cost O(history).
    """
    if frequency not in ("daily", "weekly", "monthly", "yearly"):
        return []

    effective_end = min(window_end, recurring_end_date) if recurring_end_date else window_end
    if effective_end < window_start or effective_end < recurring_start_date:
        return []
    effective_start = max(window_start, recurring_start_date)

    occurrences: List[date] = []

    if frequency == "daily":
        cursor = effective_start
        while cursor <= effective_end:
            occurrences.append(cursor)
            cursor += timedelta(days=1)

    elif frequency == "weekly":
        days_since_start = (effective_start - recurring_start_date).days
        weeks_elapsed = max(0, -(-days_since_start // 7))  # ceil division
        cursor = recurring_start_date + timedelta(days=7 * weeks_elapsed)
        while cursor <= effective_end:
            if cursor >= effective_start:
                occurrences.append(cursor)
            cursor += timedelta(days=7)

    elif frequency == "monthly":
        months_since_start = (
            (effective_start.year - recurring_start_date.year) * 12
            + (effective_start.month - recurring_start_date.month)
        )
        cursor = _add_months(recurring_start_date, recurring_start_date.day, max(0, months_since_start))
        while cursor < effective_start:
            cursor = _add_months(cursor, recurring_start_date.day, 1)
        while cursor <= effective_end:
            occurrences.append(cursor)
            cursor = _add_months(cursor, recurring_start_date.day, 1)

    elif frequency == "yearly":
        years_since_start = effective_start.year - recurring_start_date.year
        cursor = _add_years(recurring_start_date, max(0, years_since_start))
        while cursor < effective_start:
            cursor = _add_years(cursor, 1)
        while cursor <= effective_end:
            occurrences.append(cursor)
            cursor = _add_years(cursor, 1)

    return occurrences[:max_occurrences]

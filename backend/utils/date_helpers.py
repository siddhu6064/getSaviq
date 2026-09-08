from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException


def month_start(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def add_months(month_dt: datetime, delta: int) -> datetime:
    year = month_dt.year + (month_dt.month - 1 + delta) // 12
    month = (month_dt.month - 1 + delta) % 12 + 1
    return month_dt.replace(year=year, month=month, day=1)


def days_in_month(now: datetime) -> int:
    start = month_start(now)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return (next_month.date() - start.date()).days


def parse_date_range(
    start_date: Optional[str], end_date: Optional[str]
) -> tuple[Optional[datetime], Optional[datetime]]:
    parsed_start = None
    parsed_end = None

    if start_date:
        try:
            parsed_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")

    if end_date:
        try:
            parsed_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    if parsed_start and parsed_end and parsed_end < parsed_start:
        raise HTTPException(status_code=400, detail="end_date cannot be earlier than start_date")

    return parsed_start, parsed_end

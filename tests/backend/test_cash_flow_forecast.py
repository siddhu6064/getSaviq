from datetime import datetime, timedelta, timezone

from services.forecast_service import generate_cash_flow_forecast


class _FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    async def to_list(self, _length):
        return list(self._docs)


class _FakeCollection:
    def __init__(self, docs):
        self.docs = docs

    def find(self, query, projection=None):
        matches = []
        for doc in self.docs:
            if doc.get("user_id") != query.get("user_id"):
                continue
            if doc.get("profile_id") != query.get("profile_id"):
                continue
            ok = True
            for key, expected in query.items():
                if key in ("user_id", "profile_id"):
                    continue
                if isinstance(expected, dict) and "$ne" in expected:
                    if doc.get(key) == expected["$ne"]:
                        ok = False
                        break
                elif doc.get(key) != expected:
                    ok = False
                    break
            if ok:
                matches.append(doc)
        return _FakeCursor(matches)


NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _run(expenses_docs, bills_docs, days=30, now=NOW):
    import asyncio

    return asyncio.run(
        generate_cash_flow_forecast(
            user_id="u1",
            profile_id="p1",
            expenses_collection=_FakeCollection(expenses_docs),
            bills_collection=_FakeCollection(bills_docs),
            now=now,
            days=days,
        )
    )


def test_starting_balance_from_all_time_income_minus_expense():
    docs = [
        {"user_id": "u1", "profile_id": "p1", "type": "income", "amount": 1000},
        {"user_id": "u1", "profile_id": "p1", "type": "expense", "amount": 400},
    ]
    result = _run(docs, [])
    assert result["starting_balance"] == 600
    assert result["days"][0]["projected_balance"] == 600
    assert len(result["days"]) == 30


def test_bill_due_date_creates_a_negative_event():
    bills = [
        {
            "user_id": "u1",
            "profile_id": "p1",
            "status": "active",
            "name": "Rent",
            "expected_amount": 1500,
            "due_day": 5,
            "frequency": "monthly",
        }
    ]
    result = _run([], bills)
    day5 = result["days"][4]
    assert day5["date"] == "2026-01-05"
    assert day5["events"] == [{"label": "Rent", "amount": -1500.0}]
    assert day5["projected_balance"] == -1500.0


def test_recurring_income_and_recurring_expense_both_apply():
    docs = [
        {
            "user_id": "u1",
            "profile_id": "p1",
            "type": "income",
            "amount": 2000,
            "description": "Paycheck",
            "is_recurring": True,
            "recurring_frequency": "monthly",
            "recurring_start_date": datetime(2025, 12, 1, tzinfo=timezone.utc),
            "recurring_end_date": None,
        },
        {
            "user_id": "u1",
            "profile_id": "p1",
            "type": "expense",
            "amount": 50,
            "description": "Streaming",
            "is_recurring": True,
            "recurring_frequency": "monthly",
            "recurring_start_date": datetime(2025, 12, 10, tzinfo=timezone.utc),
            "recurring_end_date": None,
        },
    ]
    result = _run(docs, [])
    day1 = result["days"][0]
    day10 = result["days"][9]
    # starting_balance already includes both docs as historical actuals
    # (2000 - 50 = 1950); the forecast then additionally projects each as a
    # *future* recurring occurrence on top of that.
    assert result["starting_balance"] == 1950.0
    assert day1["events"] == [{"label": "Paycheck", "amount": 2000.0}]
    assert day1["projected_balance"] == 3950.0
    assert day10["events"] == [{"label": "Streaming", "amount": -50.0}]
    assert day10["projected_balance"] == 3900.0


def test_will_go_negative_flag_set_when_balance_dips_below_zero():
    bills = [
        {
            "user_id": "u1",
            "profile_id": "p1",
            "status": "active",
            "name": "Rent",
            "expected_amount": 1500,
            "due_day": 2,
            "frequency": "monthly",
        }
    ]
    result = _run([], bills)
    assert result["will_go_negative"] is True
    assert result["first_negative_date"] == "2026-01-02"


def test_no_events_stays_flat_at_starting_balance():
    docs = [{"user_id": "u1", "profile_id": "p1", "type": "income", "amount": 500}]
    result = _run(docs, [])
    assert result["will_go_negative"] is False
    assert result["first_negative_date"] is None
    assert all(d["projected_balance"] == 500 for d in result["days"])

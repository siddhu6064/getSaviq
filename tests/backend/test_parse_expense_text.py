import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest

from services import openai_client


def _register(client, email=None, password="secret123", name="Tester"):
    if email is None:
        email = f"parse_text_tester_{uuid4().hex[:10]}@example.com"
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": name},
    )
    assert response.status_code == 200
    data = response.json()
    data["session_token"] = response.cookies.get("session_token")
    return data


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


class _FakeResponses:
    def __init__(self, output_text=None, error=None):
        self._output_text = output_text
        self._error = error

    async def create(self, **_kwargs):
        if self._error:
            raise self._error
        return SimpleNamespace(output_text=self._output_text)


class _FakeAsyncOpenAI:
    def __init__(self, output_text=None, error=None):
        self.responses = _FakeResponses(output_text=output_text, error=error)


def test_parse_expense_text_parses_json_output(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    fake_payload = (
        '{"type": "expense", "amount": 45, "merchant": "Chipotle", '
        '"description": "Lunch", "date": "2026-09-08", '
        '"category_suggestion": "Food & Dining", "confidence": 0.9}'
    )
    monkeypatch.setattr(
        openai_client,
        "_get_async_openai_cls",
        lambda: (lambda api_key: _FakeAsyncOpenAI(output_text=fake_payload)),
    )

    result = asyncio.run(openai_client.parse_expense_text("spent 45 dollars on lunch at Chipotle yesterday"))
    assert result["amount"] == 45
    assert result["merchant"] == "Chipotle"
    assert result["category_suggestion"] == "Food & Dining"


def test_parse_expense_text_raises_on_malformed_output(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(
        openai_client,
        "_get_async_openai_cls",
        lambda: (lambda api_key: _FakeAsyncOpenAI(output_text="not json")),
    )

    with pytest.raises(openai_client.OpenAIClientError):
        asyncio.run(openai_client.parse_expense_text("spent 10 on coffee"))


def test_parse_expense_text_rejects_blank_text(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    with pytest.raises(openai_client.OpenAIClientError):
        asyncio.run(openai_client.parse_expense_text("   "))


def test_parse_expense_text_route_returns_fallback_on_provider_failure(client, monkeypatch):
    from routers import ai

    auth = _register(client)
    headers = _auth_headers(auth["session_token"])

    async def _boom(_text):
        raise openai_client.OpenAIClientError("provider down")

    monkeypatch.setattr(ai, "parse_expense_text", _boom)

    response = client.post(
        "/api/ai/parse-expense-text",
        headers=headers,
        json={"text": "spent 20 on coffee"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "type": "expense",
        "amount": None,
        "merchant": None,
        "description": None,
        "date": None,
        "category_suggestion": "Other",
        "confidence": 0.0,
    }


def test_parse_expense_text_route_returns_parsed_fields(client, monkeypatch):
    from routers import ai

    auth = _register(client)
    headers = _auth_headers(auth["session_token"])

    async def _parsed(_text):
        return {
            "type": "expense",
            "amount": 45.0,
            "merchant": "Chipotle",
            "description": "Lunch",
            "date": "2026-09-08",
            "category_suggestion": "Food & Dining",
            "confidence": 0.9,
        }

    monkeypatch.setattr(ai, "parse_expense_text", _parsed)

    response = client.post(
        "/api/ai/parse-expense-text",
        headers=headers,
        json={"text": "spent 45 dollars on lunch at Chipotle yesterday"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["amount"] == 45.0
    assert body["merchant"] == "Chipotle"
    assert body["category_suggestion"] == "Food & Dining"


def test_parse_expense_text_rejects_empty_body(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])

    response = client.post("/api/ai/parse-expense-text", headers=headers, json={"text": ""})
    assert response.status_code == 422

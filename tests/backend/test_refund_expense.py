from uuid import uuid4


def _register(client, email=None, password="secret123", name="Tester"):
    if email is None:
        email = f"refund_tester_{uuid4().hex[:10]}@example.com"
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


def _default_profile_id(client, headers):
    response = client.get("/api/profiles", headers=headers)
    assert response.status_code == 200
    return response.json()[0]["profile_id"]


def _create_expense(client, headers, *, profile_id, amount=50.0, description="Groceries"):
    categories = client.get("/api/categories", headers=headers)
    payment_methods = client.get("/api/payment-methods", headers=headers)
    payload = {
        "profile_id": profile_id,
        "amount": amount,
        "category_id": categories.json()[0]["category_id"],
        "payment_method_id": payment_methods.json()[0]["payment_id"],
        "description": description,
        "merchant": "Whole Foods",
        "date": "2026-09-01T00:00:00+00:00",
        "type": "expense",
    }
    response = client.post("/api/expenses", headers=headers, json=payload)
    assert response.status_code == 200
    return response.json()


def test_refund_expense_defaults_to_original_amount(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)
    expense = _create_expense(client, headers, profile_id=profile_id, amount=50.0)

    response = client.post(f"/api/expenses/{expense['expense_id']}/refund", headers=headers, json={})

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "income"
    assert body["amount"] == 50.0
    assert body["refund_for_expense_id"] == expense["expense_id"]
    assert body["description"] == "Refund: Groceries"
    assert body["category_id"] == expense["category_id"]
    assert body["payment_method_id"] == expense["payment_method_id"]


def test_refund_expense_supports_partial_amount_and_notes(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)
    expense = _create_expense(client, headers, profile_id=profile_id, amount=100.0)

    response = client.post(
        f"/api/expenses/{expense['expense_id']}/refund",
        headers=headers,
        json={"amount": 30.0, "notes": "Partial return"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["amount"] == 30.0
    assert body["notes"] == "Partial return"


def test_refund_nonexistent_expense_returns_404(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])

    response = client.post("/api/expenses/exp_doesnotexist/refund", headers=headers, json={})
    assert response.status_code == 404


def test_refund_expense_scoped_to_owner(client):
    owner = _register(client)
    owner_headers = _auth_headers(owner["session_token"])
    profile_id = _default_profile_id(client, owner_headers)
    expense = _create_expense(client, owner_headers, profile_id=profile_id)

    other = _register(client)
    other_headers = _auth_headers(other["session_token"])

    response = client.post(f"/api/expenses/{expense['expense_id']}/refund", headers=other_headers, json={})
    assert response.status_code == 404


def test_get_expense_refunds_lists_linked_refunds_only(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)
    expense = _create_expense(client, headers, profile_id=profile_id, amount=80.0)
    other_expense = _create_expense(client, headers, profile_id=profile_id, amount=20.0, description="Gas")

    client.post(f"/api/expenses/{expense['expense_id']}/refund", headers=headers, json={"amount": 20.0})
    client.post(f"/api/expenses/{expense['expense_id']}/refund", headers=headers, json={"amount": 10.0})
    client.post(f"/api/expenses/{other_expense['expense_id']}/refund", headers=headers, json={})

    response = client.get(f"/api/expenses/{expense['expense_id']}/refunds", headers=headers)

    assert response.status_code == 200
    refunds = response.json()
    assert len(refunds) == 2
    assert {r["amount"] for r in refunds} == {20.0, 10.0}
    assert all(r["refund_for_expense_id"] == expense["expense_id"] for r in refunds)


def test_get_expense_refunds_404_for_unknown_expense(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])

    response = client.get("/api/expenses/exp_doesnotexist/refunds", headers=headers)
    assert response.status_code == 404

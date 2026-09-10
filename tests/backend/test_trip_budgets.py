from uuid import uuid4


def _register(client, email=None, password="secret123", name="Tester"):
    if email is None:
        email = f"trip_tester_{uuid4().hex[:10]}@example.com"
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


def _create_expense(client, headers, *, profile_id, amount, date, category_id=None):
    categories = client.get("/api/categories", headers=headers)
    payment_methods = client.get("/api/payment-methods", headers=headers)
    payload = {
        "profile_id": profile_id,
        "amount": amount,
        "category_id": category_id or categories.json()[0]["category_id"],
        "payment_method_id": payment_methods.json()[0]["payment_id"],
        "description": "Trip expense",
        "date": date,
        "type": "expense",
    }
    response = client.post("/api/expenses", headers=headers, json=payload)
    assert response.status_code == 200
    return response.json()


def _trip_payload(profile_id, **overrides):
    payload = {
        "profile_id": profile_id,
        "name": "Japan Trip",
        "amount": 2000.0,
        "start_date": "2026-10-01T00:00:00+00:00",
        "end_date": "2026-10-10T00:00:00+00:00",
    }
    payload.update(overrides)
    return payload


def test_create_trip_budget_success(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)

    response = client.post("/api/trip-budgets", headers=headers, json=_trip_payload(profile_id))

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Japan Trip"
    assert body["amount"] == 2000.0
    assert body["trip_id"].startswith("trip_")
    assert body["spent"] == 0.0
    assert body["remaining"] == 2000.0
    assert body["percentage"] == 0.0
    assert body["is_over_budget"] is False


def test_create_trip_budget_rejects_end_before_start(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)

    payload = _trip_payload(
        profile_id,
        start_date="2026-10-10T00:00:00+00:00",
        end_date="2026-10-01T00:00:00+00:00",
    )
    response = client.post("/api/trip-budgets", headers=headers, json=payload)
    assert response.status_code == 422


def test_trip_budget_spent_scoped_to_date_range(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)

    created = client.post("/api/trip-budgets", headers=headers, json=_trip_payload(profile_id))
    trip_id = created.json()["trip_id"]

    # Inside the trip window
    _create_expense(client, headers, profile_id=profile_id, amount=300, date="2026-10-03T00:00:00+00:00")
    _create_expense(client, headers, profile_id=profile_id, amount=250, date="2026-10-05T00:00:00+00:00")
    # Outside the trip window — must not count
    _create_expense(client, headers, profile_id=profile_id, amount=999, date="2026-09-01T00:00:00+00:00")

    response = client.get(f"/api/trip-budgets/{trip_id}", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["spent"] == 550.0
    assert body["remaining"] == 1450.0
    assert body["percentage"] == 27.5
    assert body["is_over_budget"] is False


def test_trip_budget_spent_scoped_to_category_when_set(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)
    categories = client.get("/api/categories", headers=headers).json()
    target_category = categories[0]["category_id"]
    other_category = categories[1]["category_id"]

    created = client.post(
        "/api/trip-budgets",
        headers=headers,
        json=_trip_payload(profile_id, category_id=target_category),
    )
    trip_id = created.json()["trip_id"]

    _create_expense(
        client, headers, profile_id=profile_id, amount=100,
        date="2026-10-03T00:00:00+00:00", category_id=target_category,
    )
    _create_expense(
        client, headers, profile_id=profile_id, amount=500,
        date="2026-10-04T00:00:00+00:00", category_id=other_category,
    )

    response = client.get(f"/api/trip-budgets/{trip_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["spent"] == 100.0


def test_trip_budget_over_budget_flag(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)

    created = client.post(
        "/api/trip-budgets", headers=headers, json=_trip_payload(profile_id, amount=100.0)
    )
    trip_id = created.json()["trip_id"]

    _create_expense(client, headers, profile_id=profile_id, amount=150, date="2026-10-03T00:00:00+00:00")

    response = client.get(f"/api/trip-budgets/{trip_id}", headers=headers)
    body = response.json()
    assert body["spent"] == 150.0
    assert body["remaining"] == -50.0
    assert body["is_over_budget"] is True


def test_list_trip_budgets_scoped_to_owner(client):
    owner = _register(client)
    owner_headers = _auth_headers(owner["session_token"])
    profile_id = _default_profile_id(client, owner_headers)
    client.post("/api/trip-budgets", headers=owner_headers, json=_trip_payload(profile_id))

    other = _register(client)
    other_headers = _auth_headers(other["session_token"])

    response = client.get("/api/trip-budgets", headers=other_headers)
    assert response.status_code == 200
    assert response.json() == []

    response = client.get("/api/trip-budgets", headers=owner_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_update_trip_budget_amount(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)

    created = client.post("/api/trip-budgets", headers=headers, json=_trip_payload(profile_id))
    trip_id = created.json()["trip_id"]

    response = client.put(f"/api/trip-budgets/{trip_id}", headers=headers, json={"amount": 3000.0})
    assert response.status_code == 200
    assert response.json()["amount"] == 3000.0


def test_update_trip_budget_rejects_end_before_start(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)

    created = client.post("/api/trip-budgets", headers=headers, json=_trip_payload(profile_id))
    trip_id = created.json()["trip_id"]

    response = client.put(
        f"/api/trip-budgets/{trip_id}",
        headers=headers,
        json={"end_date": "2026-09-01T00:00:00+00:00"},
    )
    assert response.status_code == 400


def test_update_nonexistent_trip_budget_404(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])

    response = client.put(
        "/api/trip-budgets/trip_doesnotexist", headers=headers, json={"amount": 100.0}
    )
    assert response.status_code == 404


def test_delete_trip_budget(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])
    profile_id = _default_profile_id(client, headers)

    created = client.post("/api/trip-budgets", headers=headers, json=_trip_payload(profile_id))
    trip_id = created.json()["trip_id"]

    response = client.delete(f"/api/trip-budgets/{trip_id}", headers=headers)
    assert response.status_code == 200

    response = client.get(f"/api/trip-budgets/{trip_id}", headers=headers)
    assert response.status_code == 404


def test_delete_nonexistent_trip_budget_404(client):
    auth = _register(client)
    headers = _auth_headers(auth["session_token"])

    response = client.delete("/api/trip-budgets/trip_doesnotexist", headers=headers)
    assert response.status_code == 404

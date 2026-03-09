from fastapi.testclient import TestClient

from app.main import create_app


def build_client(monkeypatch) -> TestClient:
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "correct horse")
    monkeypatch.setenv("ADMIN_TOKEN_SECRET", "local-admin-secret")
    return TestClient(create_app())


def test_login_returns_token_for_valid_credentials(monkeypatch) -> None:
    client = build_client(monkeypatch)

    response = client.post(
        "/admin/auth/login",
        json={"email": "admin@example.com", "password": "correct horse"},
    )

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["token"], str)
    assert body["user"] == {"userId": None, "email": "admin@example.com", "role": "admin"}


def test_login_rejects_invalid_credentials(monkeypatch) -> None:
    client = build_client(monkeypatch)

    response = client.post(
        "/admin/auth/login",
        json={"email": "admin@example.com", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid admin credentials."}


def test_me_returns_identity_for_valid_token(monkeypatch) -> None:
    client = build_client(monkeypatch)
    login = client.post(
        "/admin/auth/login",
        json={"email": "admin@example.com", "password": "correct horse"},
    )
    token = login.json()["token"]

    response = client.get("/admin/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "user": {"userId": None, "email": "admin@example.com", "role": "admin"}
    }


def test_me_rejects_missing_token(monkeypatch) -> None:
    client = build_client(monkeypatch)

    response = client.get("/admin/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing admin bearer token."}


def test_me_rejects_invalid_token(monkeypatch) -> None:
    client = build_client(monkeypatch)

    response = client.get(
        "/admin/auth/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid admin token."}

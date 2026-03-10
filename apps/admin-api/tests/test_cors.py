from fastapi.testclient import TestClient

from app.main import create_app


def test_preflight_allows_local_admin_web_origin() -> None:
    client = TestClient(create_app())

    response = client.options(
        "/admin/auth/login",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_preflight_allows_forwarded_admin_web_origin() -> None:
    client = TestClient(create_app())

    response = client.options(
        "/admin/auth/login",
        headers={
            "Origin": "https://5173-mark-t14s.preview.app.github.dev",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"]
        == "https://5173-mark-t14s.preview.app.github.dev"
    )

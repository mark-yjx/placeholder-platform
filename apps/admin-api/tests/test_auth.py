from dataclasses import dataclass, field
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.core.auth import AdminIdentity
from app.main import create_app
from app.services.admin_auth import AdminAuthSession, TotpEnrollment, TotpVerificationError


@dataclass
class FakeAuthService:
    sessions: dict[str, AdminAuthSession] = field(
        default_factory=lambda: {
            "full-token": AdminAuthSession(
                state="authenticated_admin",
                token="full-token",
                user=AdminIdentity(
                    email="admin@example.com",
                    user_id="admin-1",
                    totp_enabled=False,
                ),
            ),
            "pending-token": AdminAuthSession(
                state="pending_tfa",
                token="pending-token",
                user=AdminIdentity(
                    email="admin@example.com",
                    user_id="admin-1",
                    totp_enabled=True,
                ),
                pending_expires_at="2026-03-10T10:05:00Z",
            ),
        }
    )
    logout_calls: list[str | None] = field(default_factory=list)
    enrollment_confirmed: bool = False

    def create_oidc_flow(self) -> tuple[str, str]:
        return (
            "signed-flow-state",
            "https://login.microsoftonline.com/mock/authorize?state=signed-flow-state",
        )

    def complete_oidc_callback(self, *, provider: str, code: str, flow_token: str) -> AdminAuthSession:
        assert provider == "microsoft"
        assert flow_token == "signed-flow-state"

        if code == "admin-ok":
            return self.sessions["full-token"]
        if code == "admin-pending":
            return self.sessions["pending-token"]
        if code == "unknown":
            raise ValueError("Microsoft identity is not mapped to a local admin user.")
        if code == "disabled":
            raise ValueError("This admin account is disabled.")
        if code == "student":
            raise ValueError("Admin access is limited to local admin users.")
        raise ValueError("Microsoft callback is invalid.")

    def get_session_state(self, token: str | None) -> AdminAuthSession:
        return self.sessions.get(token or "", AdminAuthSession(state="unauthenticated", token=None, user=None))

    def require_authenticated_admin(self, token: str) -> AdminIdentity:
        session = self.sessions.get(token)
        if session is None or session.state != "authenticated_admin" or session.user is None:
            raise ValueError("Invalid admin token.")
        return session.user

    def verify_pending_totp(self, token: str, code: str) -> AdminAuthSession:
        if token != "pending-token":
            raise TotpVerificationError("Pending admin verification is missing or expired.")
        if code != "123456":
            raise TotpVerificationError("Invalid TOTP code.")
        return AdminAuthSession(
            state="authenticated_admin",
            token="full-token-totp",
            user=AdminIdentity(
                email="admin@example.com",
                user_id="admin-1",
                totp_enabled=True,
            ),
        )

    def init_totp_enrollment(self, token: str) -> TotpEnrollment:
        if token != "full-token":
            raise TotpVerificationError("Admin session is invalid.")
        return TotpEnrollment(
            secret="ABCDEF123456",
            otpauth_uri="otpauth://totp/OJ%20Admin%20Web:admin@example.com?secret=ABCDEF123456",
            issuer="OJ Admin Web",
            account_name="admin@example.com",
        )

    def confirm_totp_enrollment(self, token: str, code: str) -> None:
        if token != "full-token":
            raise TotpVerificationError("Admin session is invalid.")
        if code != "123456":
            raise TotpVerificationError("Invalid TOTP code.")
        self.enrollment_confirmed = True

    def logout(self, token: str | None) -> None:
        self.logout_calls.append(token)


def build_client(monkeypatch, auth_service: FakeAuthService | None = None) -> tuple[TestClient, FakeAuthService]:
    monkeypatch.setenv("ADMIN_SESSION_SECRET", "local-admin-session-secret")
    monkeypatch.setenv("ADMIN_WEB_BASE_URL", "http://127.0.0.1:5173")
    monkeypatch.setenv("ADMIN_MICROSOFT_CLIENT_ID", "local-microsoft-client")
    service = auth_service or FakeAuthService()
    return TestClient(create_app(auth_service=service)), service


def test_login_microsoft_redirects_to_provider(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    response = client.get("/admin/auth/login/microsoft", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"].startswith("https://login.microsoftonline.com/mock/authorize")


def test_callback_redirects_authenticated_admin_to_web(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    response = client.get(
        "/admin/auth/callback/microsoft",
        params={"code": "admin-ok", "state": "signed-flow-state"},
        follow_redirects=False,
    )

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("http://127.0.0.1:5173/auth/callback#")
    assert "state=authenticated_admin" in location
    assert "token=full-token" in location


def test_callback_redirects_pending_totp_admin_to_web(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    response = client.get(
        "/admin/auth/callback/microsoft",
        params={"code": "admin-pending", "state": "signed-flow-state"},
        follow_redirects=False,
    )

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("http://127.0.0.1:5173/auth/callback#")
    assert "state=pending_tfa" in location
    assert "token=pending-token" in location


def test_callback_rejects_unknown_local_user(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    response = client.get(
        "/admin/auth/callback/microsoft",
        params={"code": "unknown", "state": "signed-flow-state"},
        follow_redirects=False,
    )

    assert response.status_code == 302
    assert response.headers["location"] == (
        "http://127.0.0.1:5173/login?error="
        "Microsoft%20identity%20is%20not%20mapped%20to%20a%20local%20admin%20user."
    )


def test_callback_rejects_disabled_local_user(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    response = client.get(
        "/admin/auth/callback/microsoft",
        params={"code": "disabled", "state": "signed-flow-state"},
        follow_redirects=False,
    )

    assert response.status_code == 302
    assert response.headers["location"] == (
        "http://127.0.0.1:5173/login?error=This%20admin%20account%20is%20disabled."
    )


def test_callback_rejects_non_admin_local_user(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    response = client.get(
        "/admin/auth/callback/microsoft",
        params={"code": "student", "state": "signed-flow-state"},
        follow_redirects=False,
    )

    assert response.status_code == 302
    assert response.headers["location"] == (
        "http://127.0.0.1:5173/login?error=Admin%20access%20is%20limited%20to%20local%20admin%20users."
    )


def test_me_returns_unauthenticated_without_token(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    response = client.get("/admin/auth/me")

    assert response.status_code == 200
    assert response.json() == {"state": "unauthenticated", "user": None, "pendingExpiresAt": None}


def test_me_returns_pending_and_authenticated_states(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    pending = client.get("/admin/auth/me", headers={"Authorization": "Bearer pending-token"})
    authenticated = client.get("/admin/auth/me", headers={"Authorization": "Bearer full-token"})

    assert pending.status_code == 200
    assert pending.json()["state"] == "pending_tfa"
    assert pending.json()["pendingExpiresAt"] == "2026-03-10T10:05:00Z"
    assert authenticated.status_code == 200
    assert authenticated.json()["state"] == "authenticated_admin"
    assert authenticated.json()["user"]["email"] == "admin@example.com"


def test_totp_verify_upgrades_pending_session(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    response = client.post(
        "/admin/auth/totp/verify",
        headers={"Authorization": "Bearer pending-token"},
        json={"code": "123456"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "state": "authenticated_admin",
        "token": "full-token-totp",
        "user": {
            "email": "admin@example.com",
            "userId": "admin-1",
            "role": "admin",
            "totpEnabled": True,
        },
        "pendingExpiresAt": None,
    }


def test_totp_verify_rejects_invalid_code(monkeypatch) -> None:
    client, _ = build_client(monkeypatch)

    response = client.post(
        "/admin/auth/totp/verify",
        headers={"Authorization": "Bearer pending-token"},
        json={"code": "000000"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid TOTP code."}


def test_totp_enrollment_routes_work_for_authenticated_admin(monkeypatch) -> None:
    client, service = build_client(monkeypatch)

    init_response = client.post(
        "/admin/auth/totp/enroll/init",
        headers={"Authorization": "Bearer full-token"},
    )
    confirm_response = client.post(
        "/admin/auth/totp/enroll/confirm",
        headers={"Authorization": "Bearer full-token"},
        json={"code": "123456"},
    )

    assert init_response.status_code == 200
    assert init_response.json()["secret"] == "ABCDEF123456"
    assert init_response.json()["issuer"] == "OJ Admin Web"
    assert confirm_response.status_code == 204
    assert service.enrollment_confirmed is True


def test_logout_revokes_current_session(monkeypatch) -> None:
    client, service = build_client(monkeypatch)

    response = client.post(
        "/admin/auth/logout",
        headers={"Authorization": "Bearer full-token"},
    )

    assert response.status_code == 204
    assert service.logout_calls == ["full-token"]

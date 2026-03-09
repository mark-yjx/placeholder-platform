import base64
import hashlib
import hmac
import json
from dataclasses import dataclass, field

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.users import (
    AdminUserCreateRequest,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserUpdateRequest,
)
from app.services.users import (
    UserAlreadyExistsError,
    hash_password,
    verify_password,
)


@dataclass
class FakeUserService:
    users: dict[str, AdminUserDetail] = field(default_factory=dict)
    password_hashes: dict[str, str] = field(default_factory=dict)
    create_calls: list[AdminUserCreateRequest] = field(default_factory=list)
    update_calls: list[tuple[str, AdminUserUpdateRequest]] = field(default_factory=list)
    password_calls: list[tuple[str, str]] = field(default_factory=list)

    def list_users(self) -> list[AdminUserListItem]:
        return [
            AdminUserListItem(
                userId=user.userId,
                email=user.email,
                displayName=user.displayName,
                role=user.role,
                status=user.status,
                createdAt=user.createdAt,
            )
            for user in self.users.values()
        ]

    def get_user(self, user_id: str) -> AdminUserDetail | None:
        return self.users.get(user_id)

    def create_user(self, payload: AdminUserCreateRequest) -> AdminUserDetail:
        self.create_calls.append(payload)
        if any(existing.email == payload.email for existing in self.users.values()):
            raise UserAlreadyExistsError("A user with that email already exists.")

        created = AdminUserDetail(
            userId="user-created",
            email=payload.email,
            displayName=payload.displayName,
            role=payload.role,
            status=payload.status,
            createdAt="2026-03-10T09:00:00Z",
            updatedAt="2026-03-10T09:00:00Z",
            lastLoginAt=None,
        )
        self.users[created.userId] = created
        self.password_hashes[created.userId] = hash_password(payload.password, salt="user-create-salt")
        return created

    def update_user(self, user_id: str, payload: AdminUserUpdateRequest) -> AdminUserDetail | None:
        self.update_calls.append((user_id, payload))
        current = self.users.get(user_id)
        if current is None:
            return None

        updated = current.model_copy(
            update={
                "displayName": payload.displayName,
                "role": payload.role,
                "status": payload.status,
                "updatedAt": "2026-03-10T10:00:00Z",
            }
        )
        self.users[user_id] = updated
        return updated

    def set_user_status(self, user_id: str, status: str) -> AdminUserDetail | None:
        current = self.users.get(user_id)
        if current is None:
            return None

        updated = current.model_copy(
            update={
                "status": status,
                "updatedAt": "2026-03-10T10:01:00Z",
            }
        )
        self.users[user_id] = updated
        return updated

    def set_user_password(self, user_id: str, password: str) -> AdminUserDetail | None:
        current = self.users.get(user_id)
        if current is None:
            return None

        self.password_calls.append((user_id, password))
        self.password_hashes[user_id] = hash_password(password, salt="password-reset-salt")
        updated = current.model_copy(update={"updatedAt": "2026-03-10T10:02:00Z"})
        self.users[user_id] = updated
        return updated

    def authenticate_admin(self, email: str, password: str) -> AdminUserDetail | None:
        for user_id, user in self.users.items():
            if user.email != email or user.role != "admin" or user.status != "active":
                continue
            stored_hash = self.password_hashes.get(user_id)
            if stored_hash and verify_password(password, stored_hash):
                updated = user.model_copy(update={"lastLoginAt": "2026-03-10T11:00:00Z"})
                self.users[user_id] = updated
                return updated
        return None


def _encode_segment(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def build_non_admin_token(token_secret: str) -> str:
    claims = {
        "email": "student1@example.com",
        "role": "student",
        "exp": 4102444800,
    }
    payload = _encode_segment(json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = _encode_segment(
        hmac.new(token_secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest()
    )
    return f"{payload}.{signature}"


def build_client(monkeypatch, service: FakeUserService) -> TestClient:
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "correct horse")
    monkeypatch.setenv("ADMIN_TOKEN_SECRET", "local-admin-secret")
    return TestClient(create_app(user_service=service))


def issue_admin_token(client: TestClient) -> str:
    response = client.post(
        "/admin/auth/login",
        json={"email": "admin@example.com", "password": "correct horse"},
    )
    return response.json()["token"]


def build_service() -> FakeUserService:
    admin = AdminUserDetail(
        userId="admin-1",
        email="admin@example.com",
        displayName="Platform Admin",
        role="admin",
        status="active",
        createdAt="2026-03-01T09:00:00Z",
        updatedAt="2026-03-09T12:00:00Z",
        lastLoginAt="2026-03-09T12:00:00Z",
    )
    student = AdminUserDetail(
        userId="student-1",
        email="student1@example.com",
        displayName="Student One",
        role="student",
        status="active",
        createdAt="2026-03-02T09:00:00Z",
        updatedAt="2026-03-02T09:00:00Z",
        lastLoginAt=None,
    )
    return FakeUserService(
        users={"admin-1": admin, "student-1": student},
        password_hashes={
            "admin-1": hash_password("correct horse", salt="admin-login-salt"),
            "student-1": hash_password("student secret", salt="student-login-salt"),
        },
    )


def test_password_hashing_never_keeps_plaintext() -> None:
    hashed = hash_password("correct horse battery", salt="static-salt")

    assert hashed.startswith("scrypt$static-salt$")
    assert "correct horse battery" not in hashed
    assert verify_password("correct horse battery", hashed) is True
    assert verify_password("wrong horse battery", hashed) is False


def test_admin_login_accepts_active_managed_admin(monkeypatch) -> None:
    client = build_client(monkeypatch, build_service())

    response = client.post(
        "/admin/auth/login",
        json={"email": "admin@example.com", "password": "correct horse"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["userId"] == "admin-1"
    assert response.json()["user"]["role"] == "admin"


def test_admin_login_rejects_student_credentials(monkeypatch) -> None:
    client = build_client(monkeypatch, build_service())

    response = client.post(
        "/admin/auth/login",
        json={"email": "student1@example.com", "password": "student secret"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid admin credentials."}


def test_admin_users_list_requires_admin_token(monkeypatch) -> None:
    client = build_client(monkeypatch, build_service())
    token = build_non_admin_token("local-admin-secret")

    response = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid admin token."}


def test_admin_users_list_returns_users(monkeypatch) -> None:
    client = build_client(monkeypatch, build_service())
    token = issue_admin_token(client)

    response = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert len(response.json()) == 2
    assert response.json()[0]["role"] in {"admin", "student"}


def test_admin_user_detail_returns_selected_user(monkeypatch) -> None:
    client = build_client(monkeypatch, build_service())
    token = issue_admin_token(client)

    response = client.get("/admin/users/student-1", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "student1@example.com"
    assert response.json()["lastLoginAt"] is None


def test_admin_user_create_updates_enable_disable_and_password(monkeypatch) -> None:
    service = build_service()
    client = build_client(monkeypatch, service)
    token = issue_admin_token(client)

    create_response = client.post(
        "/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": "new@example.com",
            "displayName": "New User",
            "role": "student",
            "status": "active",
            "password": "correct horse battery",
        },
    )
    assert create_response.status_code == 201
    assert create_response.json()["email"] == "new@example.com"

    update_response = client.put(
        "/admin/users/student-1",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "displayName": "Student One Prime",
            "role": "admin",
            "status": "disabled",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["role"] == "admin"
    assert update_response.json()["status"] == "disabled"

    disable_response = client.post(
        "/admin/users/admin-1/disable",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert disable_response.status_code == 200
    assert disable_response.json()["status"] == "disabled"

    enable_response = client.post(
        "/admin/users/admin-1/enable",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert enable_response.status_code == 200
    assert enable_response.json()["status"] == "active"

    password_response = client.post(
        "/admin/users/student-1/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"password": "new student pass"},
    )
    assert password_response.status_code == 200
    assert service.password_calls[-1] == ("student-1", "new student pass")


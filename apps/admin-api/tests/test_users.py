from dataclasses import dataclass, field

from fastapi.testclient import TestClient

from app.main import create_app
from app.models.users import (
    AdminUserCreateRequest,
    AdminUserDetail,
    AdminUserListItem,
    AdminUserUpdateRequest,
)
from app.services.users import UserAlreadyExistsError, hash_password, verify_password
from .support import AUTHENTICATED_ADMIN_TOKEN, FakeProtectedAdminAuthService


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
        return None


def build_client(monkeypatch, service: FakeUserService) -> TestClient:
    monkeypatch.setenv("ADMIN_SESSION_SECRET", "local-admin-session-secret")
    monkeypatch.setenv("ADMIN_MICROSOFT_CLIENT_ID", "local-microsoft-client")
    return TestClient(
        create_app(
            user_service=service,
            auth_service=FakeProtectedAdminAuthService(),
        )
    )


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


def test_admin_users_list_requires_admin_token(monkeypatch) -> None:
    client = build_client(monkeypatch, build_service())

    response = client.get("/admin/users", headers={"Authorization": "Bearer invalid-token"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid admin token."}


def test_admin_users_list_returns_users(monkeypatch) -> None:
    client = build_client(monkeypatch, build_service())

    response = client.get(
        "/admin/users",
        headers={"Authorization": f"Bearer {AUTHENTICATED_ADMIN_TOKEN}"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 2
    assert response.json()[0]["role"] in {"admin", "student"}


def test_admin_user_detail_returns_selected_user(monkeypatch) -> None:
    client = build_client(monkeypatch, build_service())

    response = client.get(
        "/admin/users/student-1",
        headers={"Authorization": f"Bearer {AUTHENTICATED_ADMIN_TOKEN}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "student1@example.com"
    assert response.json()["lastLoginAt"] is None


def test_admin_user_create_updates_enable_disable_and_password(monkeypatch) -> None:
    service = build_service()
    client = build_client(monkeypatch, service)

    create_response = client.post(
        "/admin/users",
        headers={"Authorization": f"Bearer {AUTHENTICATED_ADMIN_TOKEN}"},
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
        headers={"Authorization": f"Bearer {AUTHENTICATED_ADMIN_TOKEN}"},
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
        headers={"Authorization": f"Bearer {AUTHENTICATED_ADMIN_TOKEN}"},
    )
    assert disable_response.status_code == 200
    assert disable_response.json()["status"] == "disabled"

    enable_response = client.post(
        "/admin/users/admin-1/enable",
        headers={"Authorization": f"Bearer {AUTHENTICATED_ADMIN_TOKEN}"},
    )
    assert enable_response.status_code == 200
    assert enable_response.json()["status"] == "active"

    password_response = client.post(
        "/admin/users/student-1/password",
        headers={"Authorization": f"Bearer {AUTHENTICATED_ADMIN_TOKEN}"},
        json={"password": "new student pass"},
    )
    assert password_response.status_code == 200
    assert service.password_calls[-1] == ("student-1", "new student pass")

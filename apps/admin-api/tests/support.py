from dataclasses import dataclass

from app.core.auth import AdminIdentity
from app.services.admin_auth import AdminAuthSession

AUTHENTICATED_ADMIN_TOKEN = "test-authenticated-admin-token"


@dataclass
class FakeProtectedAdminAuthService:
    email: str = "admin@example.com"
    user_id: str = "admin-1"
    totp_enabled: bool = False

    def create_oidc_flow(self) -> tuple[str, str]:
        return ("fake-flow", "http://example.com/fake-login")

    def complete_oidc_callback(self, *, provider: str, code: str, flow_token: str) -> AdminAuthSession:
        raise ValueError("OIDC callback is not implemented in this helper.")

    def get_session_state(self, token: str | None) -> AdminAuthSession:
        if token == AUTHENTICATED_ADMIN_TOKEN:
            return AdminAuthSession(
                state="authenticated_admin",
                token=AUTHENTICATED_ADMIN_TOKEN,
                user=AdminIdentity(
                    email=self.email,
                    user_id=self.user_id,
                    totp_enabled=self.totp_enabled,
                ),
            )
        return AdminAuthSession(state="unauthenticated", token=None, user=None)

    def require_authenticated_admin(self, token: str) -> AdminIdentity:
        if token != AUTHENTICATED_ADMIN_TOKEN:
            raise ValueError("Invalid admin token.")
        return AdminIdentity(
            email=self.email,
            user_id=self.user_id,
            totp_enabled=self.totp_enabled,
        )

    def verify_pending_totp(self, token: str, code: str) -> AdminAuthSession:
        raise ValueError("TOTP verification is not implemented in this helper.")

    def init_totp_enrollment(self, token: str):
        raise ValueError("TOTP enrollment is not implemented in this helper.")

    def confirm_totp_enrollment(self, token: str, code: str) -> None:
        raise ValueError("TOTP enrollment is not implemented in this helper.")

    def logout(self, token: str | None) -> None:
        return None

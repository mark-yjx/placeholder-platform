from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AdminAuthState = Literal["unauthenticated", "pending_tfa", "authenticated_admin"]


class AdminUserView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email: str
    userId: str | None = Field(default=None, validation_alias="user_id")
    role: Literal["admin"] = "admin"
    totpEnabled: bool = Field(default=False, validation_alias="totp_enabled")


class MeResponse(BaseModel):
    state: AdminAuthState
    user: AdminUserView | None = None
    pendingExpiresAt: str | None = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class TotpVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class TotpEnrollConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class TotpEnrollInitResponse(BaseModel):
    secret: str
    otpauthUri: str
    issuer: str
    accountName: str


class SessionResponse(BaseModel):
    state: Literal["pending_tfa", "authenticated_admin"]
    token: str
    user: AdminUserView
    pendingExpiresAt: str | None = None

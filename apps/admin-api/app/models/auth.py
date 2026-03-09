from typing import Literal

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class AdminUserView(BaseModel):
    email: str
    userId: str | None = None
    role: Literal["admin"] = "admin"


class LoginResponse(BaseModel):
    token: str
    user: AdminUserView


class MeResponse(BaseModel):
    user: AdminUserView

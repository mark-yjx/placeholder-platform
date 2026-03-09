from typing import Literal

from pydantic import BaseModel, Field

UserRole = Literal["student", "admin"]
UserStatus = Literal["active", "disabled"]


class AdminUserListItem(BaseModel):
    userId: str
    email: str
    displayName: str
    role: UserRole
    status: UserStatus
    createdAt: str


class AdminUserDetail(AdminUserListItem):
    updatedAt: str
    lastLoginAt: str | None = None


class AdminUserCreateRequest(BaseModel):
    email: str = Field(min_length=3)
    displayName: str = Field(min_length=1)
    role: UserRole
    status: UserStatus
    password: str = Field(min_length=8)


class AdminUserUpdateRequest(BaseModel):
    displayName: str = Field(min_length=1)
    role: UserRole
    status: UserStatus


class AdminUserPasswordRequest(BaseModel):
    password: str = Field(min_length=8)

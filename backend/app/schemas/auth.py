"""
FinWatch Zambia - Auth Schemas
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class UserCreateRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "sme_owner"

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        valid = {"sme_owner", "policy_analyst", "regulator"}
        if v not in valid:
            raise ValueError(f"role must be one of: {', '.join(sorted(valid))}")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be empty.")
        return v.strip()


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool
    is_admin: bool
    role: str
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters.")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

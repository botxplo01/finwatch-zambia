"""
FinWatch Zambia - Auth Schemas
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class UserCreateRequest(BaseModel):
    full_name: str
    title: str | None = None
    email: EmailStr
    password: str
    role: str = "sme_owner"
    invitation_code: str | None = None

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
        
        # Strict Requirement: No names can be titles
        val = v.lower()
        forbidden_titles = ["mr.", "mrs.", "ms.", "dr.", "prof.", "mister", "missus", "doctor", "professor", "miss"]
        for t in forbidden_titles:
            # Check if it starts with the title or contains it as a distinct word
            # e.g. "Dr. John" or "John Dr." or just "Dr."
            import re
            pattern = rf"\b{re.escape(t)}\b"
            if re.search(pattern, val):
                raise ValueError(f"Full name should not include professional titles like '{t}'. Please use the dedicated Title field.")
        
        return v.strip()


class UserResponse(BaseModel):
    id: int
    full_name: str
    title: str | None = None
    email: str
    is_active: bool
    is_admin: bool
    role: str
    profile_picture_url: str | None = None
    original_profile_picture_url: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    title: str | None = None
    email: EmailStr | None = None
    profile_picture_url: str | None = None
    original_profile_picture_url: str | None = None


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

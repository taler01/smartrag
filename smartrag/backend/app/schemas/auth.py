from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class RoleBase(BaseModel):
    role_code: str
    role_name: str
    description: Optional[str] = None


class RoleResponse(RoleBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str
    verification_code: str  # 验证码
    role_ids: List[int] = []  # 用户角色ID列表，默认为空


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    role_ids: List[int]  # 用户角色ID列表
    roles: Optional[List[RoleResponse]] = None  # 角色详细信息
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str


class TokenData(BaseModel):
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class SendVerificationCodeRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str
    code_type: str  # 验证码类型，如：registration, password_reset


class SendResetCodeRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str
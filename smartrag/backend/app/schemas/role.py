from pydantic import BaseModel
from typing import Optional
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


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    role_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
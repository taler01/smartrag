from enum import Enum
from typing import Dict
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class UserRole(str, Enum):
    """用户角色枚举"""
    ADMIN = "ADMIN"
    R_AND_D = "R_AND_D"  # 研发
    AFTER_SALES = "AFTER_SALES"  # 售后
    PRE_SALES = "PRE_SALES"  # 售前
    QA = "QA"  # 测试
    OPS = "OPS"  # 运维


# 角色标签映射
ROLE_LABELS: Dict[UserRole, str] = {
    UserRole.ADMIN: "系统管理员",
    UserRole.R_AND_D: "研发工程师",
    UserRole.AFTER_SALES: "售后支持",
    UserRole.PRE_SALES: "售前咨询",
    UserRole.QA: "测试工程师",
    UserRole.OPS: "运维工程师"
}


# 角色权限映射（可根据需要扩展）
ROLE_PERMISSIONS: Dict[UserRole, list] = {
    UserRole.ADMIN: ["read", "write", "delete", "manage_users", "manage_documents"],
    UserRole.R_AND_D: ["read", "write"],
    UserRole.AFTER_SALES: ["read"],
    UserRole.PRE_SALES: ["read"],
    UserRole.QA: ["read", "write"],
    UserRole.OPS: ["read", "write"]
}


def get_role_by_string(role_str: str) -> UserRole:
    """将字符串转换为UserRole枚举"""
    for role in UserRole:
        if role.value == role_str:
            return role
    # 默认返回研发角色
    return UserRole.R_AND_D


def is_valid_role(role_str: str) -> bool:
    """检查角色字符串是否有效"""
    return role_str in [role.value for role in UserRole]


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    role_code = Column(String(50), unique=True, nullable=False)
    role_name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Role(id={self.id}, role_code='{self.role_code}', role_name='{self.role_name}')>"
    
    def to_enum(self) -> UserRole:
        """将数据库角色转换为枚举"""
        return get_role_by_string(self.role_code)
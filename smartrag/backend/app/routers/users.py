from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.schemas.auth import UserResponse
from app.schemas.role import RoleResponse
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.role import Role


router = APIRouter(prefix="/api/v1/users", tags=["用户管理"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取当前用户信息"""
    # 获取用户的角色详细信息
    role_ids = current_user.get_role_ids()
    
    # 确保role_ids是有效的列表
    if not role_ids or not isinstance(role_ids, list):
        role_ids = []
    
    # 查询角色信息
    roles = db.query(Role).filter(Role.id.in_(role_ids)).all() if role_ids else []
    
    # 构建响应数据
    user_data = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "last_login": current_user.last_login,
        "role_ids": role_ids,
        "roles": [{"id": role.id, "role_code": role.role_code, "role_name": role.role_name, "description": role.description, "is_active": role.is_active, "created_at": role.created_at, "updated_at": role.updated_at} for role in roles]
    }
    
    return UserResponse.model_validate(user_data)


@router.get("/stats")
async def get_user_stats(current_user: User = Depends(get_current_user)):
    """获取用户统计信息"""
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "created_at": current_user.created_at,
        "last_login": current_user.last_login
    }


@router.get("/roles", response_model=List[RoleResponse])
async def get_available_roles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """获取所有可用角色列表"""
    # 检查当前用户是否有管理员权限
    if not current_user.has_role("admin"):  # 使用角色代码而不是数字ID
        raise HTTPException(status_code=403, detail="没有权限访问角色列表")
    
    roles = db.query(Role).filter(Role.is_active == True).all()
    return [RoleResponse.model_validate(role) for role in roles]


@router.get("/public/roles", response_model=List[RoleResponse])
async def get_public_roles(db: Session = Depends(get_db)):
    """获取公共角色列表（用于注册时选择）"""
    # 只返回非管理员角色
    roles = db.query(Role).filter(Role.is_active == True, Role.id != 1).all()
    return [RoleResponse.model_validate(role) for role in roles]
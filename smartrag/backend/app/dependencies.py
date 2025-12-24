from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.auth_service import AuthService
from typing import Dict
import threading


security = HTTPBearer()

# 全局AuthService实例缓存（按数据库会话）
_auth_service_cache: Dict[int, AuthService] = {}
_cache_lock = threading.Lock()


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """获取认证服务实例（使用缓存避免重复初始化）"""
    db_id = id(db)
    
    with _cache_lock:
        if db_id not in _auth_service_cache:
            _auth_service_cache[db_id] = AuthService(db)
        return _auth_service_cache[db_id]


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
):
    """获取当前用户依赖"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌"
        )
    
    return auth_service.get_current_user(credentials.credentials)
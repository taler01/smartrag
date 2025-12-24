from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from app.utils.logger import logger
from app.dependencies import get_db
from app.models.user import User
from app.schemas.auth import (
    UserCreate, UserResponse, LoginRequest, Token, RefreshTokenRequest,
    SendVerificationCodeRequest, VerifyCodeRequest, SendResetCodeRequest,
    ResetPasswordRequest
)
from app.services.auth_service import AuthService
from app.utils.redis_client import redis_client
from app.utils.email_service import email_service

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post("/send-verification-code", status_code=status.HTTP_200_OK)
async def send_verification_code(
    request: SendVerificationCodeRequest,
    db: Session = Depends(get_db)
):
    """发送验证码"""
    auth_service = AuthService(db)
    
    # 检查邮箱是否已被注册
    existing_user = db.query(User).filter(User.email == request.email).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )
    
    code = auth_service.send_verification_code(request.email)
    return {"success": True, "message": "验证码已发送", "email": request.email}


@router.post("/verify-code", status_code=status.HTTP_200_OK)
async def verify_code(
    request: VerifyCodeRequest,
    db: Session = Depends(get_db)
):
    """验证验证码"""
    auth_service = AuthService(db)
    
    if auth_service.verify_code(request.email, request.code, request.code_type):
        return {"message": "验证码正确", "valid": True}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期"
        )


@router.post("/verify-code-details")
async def verify_code_details(
    request: VerifyCodeRequest,
    db: Session = Depends(get_db)
):
    """验证验证码并返回详细信息"""
    auth_service = AuthService(db)
    result = auth_service.verify_code_with_details(request.email, request.code, request.code_type)
    
    if result["valid"]:
        return result
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """用户注册"""
    auth_service = AuthService(db)
    user = auth_service.register_user(user_data)
    return {
        "success": True,
        "message": "注册成功",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role_ids": user.role_ids,  # 返回角色ID列表
            "is_active": user.is_active,
            "created_at": user.created_at,
            "last_login": user.last_login
        }
    }


@router.post("/login")
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """用户登录"""
    auth_service = AuthService(db)
    return auth_service.login_user(login_data.email, login_data.password)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """刷新访问令牌"""
    auth_service = AuthService(db)
    return auth_service.refresh_token(refresh_data.refresh_token)


@router.post("/send-reset-code", status_code=status.HTTP_200_OK)
async def send_reset_code(
    request: SendResetCodeRequest,
    db: Session = Depends(get_db)
):
    """发送密码重置验证码"""
    auth_service = AuthService(db)
    
    try:
        code = auth_service.send_password_reset_code(request.email)
        # 无论邮箱是否存在都返回相同的成功响应
        return {"success": True, "message": "如果该邮箱已注册，重置验证码将发送到您的邮箱", "email": request.email}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"发送密码重置验证码失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="发送验证码失败，请稍后重试"
        )


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """重置密码"""
    auth_service = AuthService(db)
    
    try:
        success = auth_service.reset_password(request.email, request.code, request.new_password)
        if success:
            return {"success": True, "message": "密码重置成功"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码重置失败，请检查验证码或重新获取"
            )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"重置密码失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="重置密码失败，请稍后重试"
        )


@router.post("/logout")
async def logout():
    """用户登出（客户端删除令牌即可）"""
    return {"message": "登出成功"}


def cleanup_resources():
    """清理资源，防止内存泄漏"""
    logger.info("开始清理认证路由资源...")
    
    try:
        # 关闭邮件服务
        if email_service:
            email_service.shutdown()
        
        # 清理Redis连接
        if redis_client:
            redis_client.close()
        
        logger.info("认证路由资源清理完成")
    except Exception as e:
        logger.error(f"资源清理过程中出错: {e}")


# 注册清理函数，在应用关闭时调用
import atexit
atexit.register(cleanup_resources)
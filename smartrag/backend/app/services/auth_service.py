import random
import string
import threading
from typing import Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.utils.logger import logger
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse
from app.utils.security import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    create_refresh_token,
    verify_token
)
from app.utils.redis_client import redis_client
from app.utils.email_service import email_service


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        
        # 检查是否使用Redis
        self.use_redis = redis_client.redis_client is not None
        
        # 用户级别的锁，防止同一用户的并发操作
        self._locks: Dict[str, threading.Lock] = {}
        self._lock_lock = threading.Lock()
    
    def _get_user_lock(self, email: str) -> threading.Lock:
        """获取指定用户的锁"""
        with self._lock_lock:
            if email not in self._locks:
                self._locks[email] = threading.Lock()
            return self._locks[email]

    def generate_verification_code(self, length: int = 6) -> str:
        """生成随机验证码"""
        return ''.join(random.choices(string.digits, k=length))
    
    def validate_password_strength(self, password: str) -> dict:
        """验证密码强度，返回验证结果和错误信息"""
        errors = []
        
        # 检查长度
        if len(password) < 8:
            errors.append("密码长度不能少于8位")
        
        # 检查是否包含数字
        if not any(char.isdigit() for char in password):
            errors.append("密码必须包含至少1个数字")
        
        # 检查是否包含小写字母
        if not any(char.islower() for char in password):
            errors.append("密码必须包含至少1个小写字母")
        
        # 检查是否包含大写字母
        if not any(char.isupper() for char in password):
            errors.append("密码必须包含至少1个大写字母")
        
        # 检查是否包含特殊字符
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(char in special_chars for char in password):
            errors.append("密码必须包含至少1个特殊字符(!@#$%^&*()_+-=[]{}|;:,.<>?)")
        
        # 检查是否包含常见弱密码
        common_passwords = ["password", "123456", "qwerty", "abc123", "password123", "admin123"]
        if password.lower() in common_passwords:
            errors.append("密码不能是常见弱密码")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

    def send_verification_code(self, email: str) -> str:
        """发送验证码，支持多用户场景"""
        # 获取用户锁，防止同一用户的并发验证码请求
        lock = self._get_user_lock(email)
        with lock:
            code = self.generate_verification_code()
            
            # 存储验证码到Redis，标记为注册类型
            if redis_client.set_verification_code(email, code, "registration"):
                # 使用飞书邮件服务发送验证码（异步发送）
                if email_service.send_verification_code(email, code, async_send=True):
                    logger.info(f"验证码已发送: {email}")
                    return code
                else:
                    # 邮件发送失败，删除Redis中的验证码
                    redis_client.delete_verification_code(email, "registration")
                    logger.error(f"邮件发送失败: {email}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="邮件发送失败"
                    )
            else:
                logger.error(f"验证码存储失败: {email}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="验证码存储失败"
                )

    def verify_code(self, email: str, code: str, code_type: str) -> bool:
        """验证验证码"""
        return redis_client.is_verification_code_valid(email, code, code_type)
    
    def verify_code_with_details(self, email: str, code: str, code_type: str) -> dict:
        """验证验证码并返回详细信息"""
        return redis_client.verify_code_with_details(email, code, code_type)

    def register_user(self, user_data: UserCreate) -> UserResponse:
        """用户注册，支持多用户场景"""
        # 获取用户锁，防止同一用户的并发注册
        lock = self._get_user_lock(user_data.email)
        with lock:
            # 验证密码强度
            password_validation = self.validate_password_strength(user_data.password)
            if not password_validation["valid"]:
                logger.warning(f"注册密码强度不足: {user_data.email[:3]}***")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"message": "密码强度不足", "errors": password_validation["errors"]}
                )
            
            # 验证验证码
            verification_result = self.verify_code_with_details(user_data.email, user_data.verification_code, "registration")
            if not verification_result["valid"]:
                logger.warning(f"注册验证码错误: {user_data.email[:3]}***, 错误类型: {verification_result.get('error_type')}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=verification_result
                )
            
            # 检查用户名是否已存在
            existing_user = self.db.query(User).filter(User.username == user_data.username).first()
            if existing_user:
                logger.warning(f"注册用户名已存在: {user_data.username}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="用户名已存在"
                )
            
            # 检查邮箱是否已存在
            existing_email = self.db.query(User).filter(User.email == user_data.email).first()
            if existing_email:
                logger.warning(f"注册邮箱已存在: {user_data.email}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="邮箱已被注册"
                )
            
            # 创建新用户
            hashed_password = get_password_hash(user_data.password)
            db_user = User(
                username=user_data.username,
                email=user_data.email,
                hashed_password=hashed_password,
                role_ids=user_data.role_ids  # 使用传入的角色ID列表
            )
            
            try:
                self.db.add(db_user)
                self.db.commit()
                self.db.refresh(db_user)
                
                # 注册成功后删除验证码
                redis_client.delete_verification_code(user_data.email, "registration")
                
                logger.info(f"用户注册成功: {user_data.email[:3]}***")
                return UserResponse.model_validate(db_user)
            except Exception as e:
                self.db.rollback()
                logger.error(f"用户注册失败: {user_data.email}, 错误: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="注册失败，请稍后重试"
                )

    def authenticate_user(self, email: str, password: str) -> User:
        """用户认证"""
        user = self.db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="邮箱或密码错误"
            )
        
        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="邮箱或密码错误"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户已被禁用"
            )
        
        return user
    
    def send_password_reset_code(self, email: str) -> str:
        """发送密码重置验证码"""
        # 获取用户锁，防止同一用户的并发验证码请求
        lock = self._get_user_lock(email)
        with lock:
            # 检查邮箱是否存在
            user = self.db.query(User).filter(User.email == email).first()
            if not user:
                # 为了安全，无论邮箱是否存在都返回相同的响应
                # 使用随机延迟防止时序攻击
                import time
                import random
                time.sleep(random.uniform(0.5, 1.5))
                logger.info(f"密码重置请求: 邮箱不存在")
                return "dummy_code"  # 返回虚拟验证码，但不会实际发送
            
            # 检查发送次数限制
            if not self._check_password_reset_limits(email):
                logger.warning(f"密码重置请求次数超限: {email[:3]}***")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="请求次数过多，请24小时后再试或联系管理员"
                )
            
            # 生成并发送重置验证码
            code = self.generate_verification_code()
            
            # 存储验证码到Redis，标记为密码重置类型
            if redis_client.set_verification_code(email, code, "password_reset"):
                # 使用飞书邮件服务发送验证码（异步发送），传递code_type参数
                if email_service.send_verification_code(email, code, "password_reset", async_send=True):
                    logger.info(f"密码重置验证码已发送: {email[:3]}***")
                    # 记录密码重置请求（使用统一的计数器）
                    self._record_password_reset_attempt(email)
                    return code
                else:
                    # 邮件发送失败，删除Redis中的验证码
                    redis_client.delete_verification_code(email, "password_reset")
                    logger.error(f"密码重置验证码邮件发送失败: {email[:3]}***")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="邮件发送失败，请稍后重试"
                    )
            else:
                logger.error(f"密码重置验证码存储失败: {email[:3]}***")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="验证码存储失败，请稍后重试"
                )
    
    def reset_password(self, email: str, code: str, new_password: str) -> bool:
        """验证验证码并重置密码"""
        # 获取用户锁，防止同一用户的并发操作
        lock = self._get_user_lock(email)
        with lock:
            # 验证密码强度
            password_validation = self.validate_password_strength(new_password)
            if not password_validation["valid"]:
                logger.warning(f"密码重置密码强度不足: {email[:3]}***")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"message": "密码强度不足", "errors": password_validation["errors"]}
                )
            
            # 验证验证码
            verification_result = self.verify_code_with_details(email, code, "password_reset")
            if not verification_result["valid"]:
                logger.warning(f"密码重置验证码错误: {email[:3]}***, 错误类型: {verification_result.get('error_type')}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=verification_result
                )
            
            # 获取用户
            user = self.db.query(User).filter(User.email == email).first()
            if not user:
                logger.error(f"密码重置时用户不存在: {email[:3]}***")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="用户不存在"
                )
            
            # 更新密码
            user.hashed_password = get_password_hash(new_password)
            
            try:
                self.db.commit()
                self.db.refresh(user)
                
                # 删除验证码
                redis_client.delete_verification_code(email, "password_reset")
                
                # 记录密码重置成功（使用统一的计数器）
                self._record_password_reset_attempt(email)
                
                logger.info(f"密码重置成功: {email[:3]}***")
                return True
            except Exception as e:
                self.db.rollback()
                logger.error(f"密码重置失败: {email[:3]}***, 错误: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="密码重置失败，请稍后重试"
                )
    
    def _check_password_reset_limits(self, email: str) -> bool:
        """检查密码重置次数限制（统一限制：24小时内最多3次）"""
        try:
            from datetime import datetime
            today = datetime.now().strftime("%Y%m%d")
            key = f"password_reset_attempts:{email}:{today}"
            
            if self.use_redis and redis_client.redis_client:
                try:
                    data = redis_client.redis_client.hgetall(key)
                    if not data:
                        return True
                    
                    count = int(data.get("count", 0))
                    # 检查24小时内是否超过3次
                    return count < 3
                except Exception as redis_error:
                    logger.error(f"Redis检查密码重置限制失败: {redis_error}")
                    return True  # Redis失败时允许通过
            else:
                # 使用内存缓存
                if key in redis_client.memory_cache:
                    data = redis_client.memory_cache[key]
                    count = int(data.get("count", 0))
                    return count < 3
                return True
        except Exception as e:
            logger.error(f"检查密码重置限制错误: {e}")
            return True  # 出错时允许通过
    
    def _record_password_reset_attempt(self, email: str) -> bool:
        """记录密码重置尝试（统一记录请求和成功重置）"""
        try:
            from datetime import datetime, timedelta
            today = datetime.now().strftime("%Y%m%d")
            key = f"password_reset_attempts:{email}:{today}"
            
            if self.use_redis and redis_client.redis_client:
                try:
                    # 增加计数
                    redis_client.redis_client.hincrby(key, "count", 1)
                    # 设置过期时间（24小时）
                    redis_client.redis_client.expire(key, 24 * 60 * 60)
                    return True
                except Exception as redis_error:
                    logger.error(f"Redis记录密码重置尝试失败: {redis_error}")
                    # 更新内存缓存
                    if key in redis_client.memory_cache:
                        redis_client.memory_cache[key]["count"] += 1
                    else:
                        redis_client.memory_cache[key] = {"count": 1}
                    return True
            else:
                # 使用内存缓存
                if key in redis_client.memory_cache:
                    redis_client.memory_cache[key]["count"] += 1
                else:
                    redis_client.memory_cache[key] = {"count": 1}
                return True
        except Exception as e:
            logger.error(f"记录密码重置尝试错误: {e}")
            return False

    def login_user(self, email: str, password: str) -> dict:
        """用户登录，支持多用户场景"""
        # 获取用户锁，防止同一用户的并发登录
        lock = self._get_user_lock(email)
        with lock:
            user = self.authenticate_user(email, password)
            
            try:
                # 更新最后登录时间
                from datetime import datetime, timedelta
                user.last_login = datetime.utcnow() + timedelta(hours=8)
                self.db.commit()
                
                # 创建令牌
                token_data = {"sub": user.email}
                access_token = create_access_token(token_data)
                refresh_token = create_refresh_token(token_data)
                
                logger.info(f"用户登录成功: {email}")
                return {
                    "success": True,
                    "access_token": access_token,
                    "token_type": "bearer",
                    "refresh_token": refresh_token,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "role_ids": user.role_ids  # 返回角色ID列表
                    }
                }
            except Exception as e:
                self.db.rollback()
                logger.error(f"用户登录失败: {email}, 错误: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="登录失败，请稍后重试"
                )

    def refresh_token(self, refresh_token: str) -> dict:
        """刷新访问令牌"""
        payload = verify_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的刷新令牌"
            )
        
        email = payload.get("sub")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的令牌数据"
            )
        
        # 验证用户是否存在且活跃
        user = self.db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在或已被禁用"
            )
        
        # 创建新的访问令牌
        token_data = {"sub": user.email}
        new_access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data)
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "refresh_token": new_refresh_token
        }

    def get_current_user(self, token: str) -> User:
        """获取当前用户"""
        payload = verify_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的令牌"
            )
        
        email = payload.get("sub")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的令牌数据"
            )
        
        user = self.db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户已被禁用"
            )
        
        return user
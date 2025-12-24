from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import hashlib
import secrets
import base64
from app.config import settings


def generate_salt() -> str:
    """生成随机盐值"""
    return base64.b64encode(secrets.token_bytes(16)).decode('utf-8')


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """使用SHA-256和盐值哈希密码"""
    if salt is None:
        salt = generate_salt()
    
    # 使用PBKDF2进行密码哈希，增加安全性
    salted_password = (password + salt).encode('utf-8')
    hash_obj = hashlib.pbkdf2_hmac('sha256', salted_password, salt.encode('utf-8'), 100000)
    # 将bytes转换为hex字符串
    hash_hex = hash_obj.hex()
    
    # 返回盐值和哈希的组合
    return f"{salt}:{hash_hex}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    try:
        # 从存储的哈希中提取盐值和哈希
        salt, stored_hash = hashed_password.split(':')
        # 使用相同的盐值计算输入密码的哈希
        computed_hash = hash_password(plain_password, salt).split(':')[1]
        # 比较哈希值
        return secrets.compare_digest(computed_hash, stored_hash)
    except Exception:
        # 如果格式不正确或其他错误，返回False
        return False


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    return hash_password(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """创建刷新令牌"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """验证令牌"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        return None
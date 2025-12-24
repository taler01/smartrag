"""
Redis客户端，支持连接池和多用户场景
如果没有Redis服务，则使用内存缓存作为备选方案
"""
import redis
import redis.connection
from typing import Optional, Dict, Any
from app.config import settings
from app.utils.logger import logger
import threading
import time
from datetime import datetime, timedelta
import json


class RedisClient:
    def __init__(self):
        self.use_redis = False
        self.memory_cache = {}
        self.memory_cache_expiry = {}
        self.pool = None
        self.redis_client = None
        
        # 线程锁，用于防止验证码冲突
        self._locks: Dict[str, threading.Lock] = {}
        self._lock_lock = threading.Lock()
        
        # 延迟初始化Redis连接
        self._init_redis()
    
    def _init_redis(self):
        """延迟初始化Redis连接"""
        try:
            # 创建连接池
            self.pool = redis.ConnectionPool(
                host=settings.redis_host,
                port=settings.redis_port,
                password=settings.redis_password,
                db=settings.redis_db,
                decode_responses=True,
                max_connections=50,  # 最大连接数
                socket_timeout=5,  # socket超时时间
                socket_connect_timeout=5,  # 连接超时时间
                retry_on_timeout=True,  # 超时重试
                health_check_interval=30,  # 健康检查间隔
            )
            
            # 创建Redis客户端
            self.redis_client = redis.Redis(connection_pool=self.pool)
            
            # 测试连接
            self.redis_client.ping()
            self.use_redis = True
            logger.info("Redis连接成功")
        except Exception as e:
            logger.warning(f"Redis连接失败，使用内存缓存: {e}")
            self.use_redis = False
            self.pool = None
            self.redis_client = None
    
    def _get_lock(self, key: str) -> threading.Lock:
        """获取指定key的锁"""
        with self._lock_lock:
            if key not in self._locks:
                self._locks[key] = threading.Lock()
            return self._locks[key]
    
    def _cleanup_expired_memory_cache(self):
        """清理过期的内存缓存"""
        current_time = time.time()
        expired_keys = [k for k, v in self.memory_cache_expiry.items() if v < current_time]
        for key in expired_keys:
            if key in self.memory_cache:
                del self.memory_cache[key]
            del self.memory_cache_expiry[key]
    
    def set_verification_code(self, email: str, code: str, code_type: str = "registration") -> bool:
        """存储验证码，5分钟过期，支持多用户场景和验证码类型区分"""
        try:
            # 使用邮箱作为锁，防止同一邮箱的并发操作
            lock = self._get_lock(f"vc_lock:{email}:{code_type}")
            with lock:
                key = f"verification_code:{code_type}:{email}"
                # 存储验证码和创建时间
                data = {
                    "code": code,
                    "created_at": datetime.now().isoformat(),
                    "attempts": 0,  # 尝试次数
                    "type": code_type  # 验证码类型
                }
                
                if self.use_redis and self.redis_client:
                    try:
                        # 使用hmset替代hset mapping，确保兼容性
                        logger.info(f"存储验证码到Redis - key: {key}, data: {data}")
                        for field, value in data.items():
                            self.redis_client.hset(key, field, value)
                        self.redis_client.expire(key, settings.verification_code_expire_minutes * 60)
                        # 验证存储是否成功
                        stored_data = self.redis_client.hgetall(key)
                        logger.info(f"验证存储结果 - key: {key}, 存储的数据: {stored_data}")
                    except Exception as redis_error:
                        logger.error(f"Redis存储验证码失败，使用内存缓存: {redis_error}")
                        # Redis失败时使用内存缓存
                        self.memory_cache[key] = data
                        self.memory_cache_expiry[key] = time.time() + (settings.verification_code_expire_minutes * 60)
                        self._cleanup_expired_memory_cache()
                else:
                    # 使用内存缓存
                    self.memory_cache[key] = data
                    self.memory_cache_expiry[key] = time.time() + (settings.verification_code_expire_minutes * 60)
                    self._cleanup_expired_memory_cache()
                
                logger.info(f"验证码已存储: {email[:3]}***")
                return True
        except Exception as e:
            logger.error(f"存储验证码错误: {e}")
            return False
    
    def get_verification_code_data(self, email: str, code_type: str = "registration") -> Optional[Dict[str, Any]]:
        """获取验证码完整数据"""
        try:
            key = f"verification_code:{code_type}:{email}"
            
            if self.use_redis and self.redis_client:
                try:
                    data = self.redis_client.hgetall(key)
                    if data:
                        return data
                except Exception as redis_error:
                    logger.error(f"Redis获取验证码数据失败: {redis_error}")
                    # Redis失败时尝试使用内存缓存
                    if key in self.memory_cache:
                        return self.memory_cache[key]
            else:
                # 使用内存缓存
                self._cleanup_expired_memory_cache()
                if key in self.memory_cache:
                    return self.memory_cache[key]
            
            return None
        except Exception as e:
            logger.error(f"获取验证码数据错误: {e}")
            return None
    
    def get_verification_code(self, email: str, code_type: str = "registration") -> Optional[str]:
        """获取验证码"""
        try:
            key = f"verification_code:{code_type}:{email}"
            
            if self.use_redis and self.redis_client:
                try:
                    data = self.redis_client.hgetall(key)
                    if data and "code" in data:
                        return data["code"]
                except Exception as redis_error:
                    logger.error(f"Redis获取验证码失败: {redis_error}")
                    # Redis失败时尝试使用内存缓存
                    if key in self.memory_cache and "code" in self.memory_cache[key]:
                        return self.memory_cache[key]["code"]
            else:
                # 使用内存缓存
                self._cleanup_expired_memory_cache()
                if key in self.memory_cache and "code" in self.memory_cache[key]:
                    return self.memory_cache[key]["code"]
            
            return None
        except Exception as e:
            logger.error(f"获取验证码错误: {e}")
            return None
    
    def delete_verification_code(self, email: str, code_type: str = "registration") -> bool:
        """删除验证码"""
        try:
            key = f"verification_code:{code_type}:{email}"
            
            if self.use_redis and self.redis_client:
                try:
                    self.redis_client.delete(key)
                except Exception as redis_error:
                    logger.error(f"Redis删除验证码失败: {redis_error}")
                    # Redis失败时尝试删除内存缓存
                    if key in self.memory_cache:
                        del self.memory_cache[key]
                    if key in self.memory_cache_expiry:
                        del self.memory_cache_expiry[key]
            else:
                # 使用内存缓存
                if key in self.memory_cache:
                    del self.memory_cache[key]
                if key in self.memory_cache_expiry:
                    del self.memory_cache_expiry[key]
            
            logger.info(f"验证码已删除: {email[:3]}***")
            return True
        except Exception as e:
            logger.error(f"删除验证码错误: {e}")
            return False
    
    def is_verification_code_valid(self, email: str, code: str, code_type: str = "registration") -> bool:
        """验证验证码是否正确，支持尝试次数限制"""
        try:
            logger.info(f"开始验证验证码 - 邮箱: {email[:3]}***, 验证码: {code}, 类型: {code_type}, 使用Redis: {self.use_redis}")
            lock = self._get_lock(f"vc_lock:{email}:{code_type}")
            with lock:
                key = f"verification_code:{code_type}:{email}"
                data = None
                
                # 直接获取数据，避免递归调用
                if self.use_redis and self.redis_client:
                    try:
                        logger.info(f"从Redis读取验证码 - key: {key}")
                        data = self.redis_client.hgetall(key)
                        logger.info(f"从Redis获取验证码数据 - 邮箱: {email}, key: {key}, 数据: {data}")
                    except Exception as redis_error:
                        logger.error(f"Redis获取验证码数据失败: {redis_error}")
                        # 尝试使用内存缓存
                        if key in self.memory_cache:
                            data = self.memory_cache[key]
                            logger.info(f"从内存缓存获取验证码数据 - 邮箱: {email}, 数据: {data}")
                else:
                    # 使用内存缓存
                    self._cleanup_expired_memory_cache()
                    if key in self.memory_cache:
                        data = self.memory_cache[key]
                        logger.info(f"从内存缓存获取验证码数据 - 邮箱: {email}, 数据: {data}")
                
                if not data:
                    logger.warning(f"验证码数据不存在: {email}")
                    return False
                
                stored_code = data.get("code")
                logger.info(f"验证码验证 - 邮箱: {email}, 存储的验证码: {stored_code}, 输入的验证码: {code}")
                attempts = int(data.get("attempts", 0))
                
                # 检查尝试次数，防止暴力破解
                if attempts >= 5:  # 最多尝试5次
                    logger.warning(f"验证码尝试次数过多: {email}")
                    self.delete_verification_code(email)
                    return False
                
                # 验证码错误，增加尝试次数
                if stored_code != code:
                    if self.use_redis and self.redis_client:
                        try:
                            self.redis_client.hincrby(key, "attempts", 1)
                        except Exception as redis_error:
                            logger.error(f"Redis更新尝试次数失败: {redis_error}")
                            # 更新内存缓存
                            if key in self.memory_cache:
                                self.memory_cache[key]["attempts"] = attempts + 1
                    else:
                        self.memory_cache[key]["attempts"] = attempts + 1
                    
                    logger.warning(f"验证码错误: {email}, 尝试次数: {attempts + 1}")
                    return False
                
                # 验证码正确
                logger.info(f"验证码验证成功: {email}")
                return True
        except Exception as e:
            logger.error(f"验证验证码错误: {e}")
            return False
    
    def verify_code_with_details(self, email: str, code: str, code_type: str) -> dict:
        """验证验证码并返回详细信息，包括剩余尝试次数"""
        try:
            logger.info(f"开始验证验证码（详细信息） - 邮箱: {email[:3]}***, 验证码: {code}, 类型: {code_type}, 使用Redis: {self.use_redis}")
            lock = self._get_lock(f"vc_lock:{email}:{code_type}")
            with lock:
                key = f"verification_code:{code_type}:{email}"
                data = None
                
                # 直接获取数据，避免递归调用
                if self.use_redis and self.redis_client:
                    try:
                        data = self.redis_client.hgetall(key)
                        logger.info(f"从Redis获取验证码数据 - 邮箱: {email}, 数据: {data}")
                    except Exception as redis_error:
                        logger.error(f"Redis获取验证码数据失败: {redis_error}")
                        # 尝试使用内存缓存
                        if key in self.memory_cache:
                            data = self.memory_cache[key]
                            logger.info(f"从内存缓存获取验证码数据 - 邮箱: {email}, 数据: {data}")
                else:
                    # 使用内存缓存
                    self._cleanup_expired_memory_cache()
                    if key in self.memory_cache:
                        data = self.memory_cache[key]
                        logger.info(f"从内存缓存获取验证码数据 - 邮箱: {email}, 数据: {data}")
                
                if not data:
                    logger.warning(f"验证码数据不存在: {email}")
                    return {
                        "valid": False,
                        "error_type": "code_not_found",
                        "message": "验证码不存在或已过期",
                        "remaining_attempts": 0
                    }
                
                stored_code = data.get("code")
                logger.info(f"验证码验证 - 邮箱: {email}, 存储的验证码: {stored_code}, 输入的验证码: {code}")
                attempts = int(data.get("attempts", 0))
                
                # 检查尝试次数，防止暴力破解
                if attempts >= 5:  # 最多尝试5次
                    logger.warning(f"验证码尝试次数过多: {email}")
                    self.delete_verification_code(email)
                    return {
                        "valid": False,
                        "error_type": "max_attempts_exceeded",
                        "message": "验证码尝试次数过多，请重新获取验证码",
                        "remaining_attempts": 0
                    }
                
                # 验证码错误，增加尝试次数
                if stored_code != code:
                    new_attempts = attempts + 1
                    if self.use_redis and self.redis_client:
                        try:
                            self.redis_client.hincrby(key, "attempts", 1)
                        except Exception as redis_error:
                            logger.error(f"Redis更新尝试次数失败: {redis_error}")
                            # 更新内存缓存
                            if key in self.memory_cache:
                                self.memory_cache[key]["attempts"] = new_attempts
                    else:
                        self.memory_cache[key]["attempts"] = new_attempts
                    
                    remaining_attempts = 5 - new_attempts
                    logger.warning(f"验证码错误: {email}, 尝试次数: {new_attempts}, 剩余尝试次数: {remaining_attempts}")
                    
                    return {
                        "valid": False,
                        "error_type": "invalid_code",
                        "message": f"验证码错误，剩余尝试次数：{remaining_attempts}",
                        "remaining_attempts": remaining_attempts
                    }
                
                # 验证码正确
                logger.info(f"验证码验证成功: {email}")
                return {
                    "valid": True,
                    "message": "验证码正确",
                    "remaining_attempts": 5 - attempts
                }
        except Exception as e:
            logger.error(f"验证验证码错误: {e}")
            return {
                "valid": False,
                "error_type": "server_error",
                "message": "服务器错误，请稍后重试",
                "remaining_attempts": 0
            }
    
    def cleanup_expired_codes(self):
        """清理过期的验证码"""
        try:
            if not self.use_redis or not self.redis_client:
                # 如果使用内存缓存，清理所有过期项
                self._cleanup_expired_memory_cache()
                return
                
            pattern = "verification_code:*"
            keys = self.redis_client.keys(pattern)
            current_time = datetime.now()
            
            for key in keys:
                # 检查键是否即将过期（提前1分钟清理）
                try:
                    ttl = self.redis_client.ttl(key)
                    if ttl < 60 and ttl > 0:  # 剩余时间小于1分钟
                        email = key.replace("verification_code:", "")
                        logger.info(f"清理过期验证码: {email}")
                        self.redis_client.delete(key)
                except Exception as e:
                    logger.error(f"清理单个验证码失败: {key}, 错误: {e}")
                    continue
        except Exception as e:
            logger.error(f"清理过期验证码错误: {e}")
    
    def close(self):
        """关闭Redis连接"""
        try:
            if self.redis_client and self.pool:
                self.redis_client.close()
                self.pool.disconnect()
                logger.info("Redis连接已关闭")
        except Exception as e:
            logger.error(f"关闭Redis连接错误: {e}")
    
    async def ping(self):
        """测试Redis连接"""
        try:
            if self.use_redis and self.redis_client:
                return self.redis_client.ping()
            return False
        except Exception as e:
            logger.error(f"Redis ping测试失败: {e}")
            return False
    
    async def get(self, key: str):
        """获取Redis键值"""
        try:
            if self.use_redis and self.redis_client:
                return self.redis_client.get(key)
            # 使用内存缓存作为备选
            self._cleanup_expired_memory_cache()
            if key in self.memory_cache:
                return json.dumps(self.memory_cache[key])
            return None
        except Exception as e:
            logger.error(f"Redis获取键值失败: {e}")
            # 尝试使用内存缓存
            self._cleanup_expired_memory_cache()
            if key in self.memory_cache:
                return json.dumps(self.memory_cache[key])
            return None
    
    async def setex(self, key: str, ttl: int, value: str):
        """设置Redis键值并指定过期时间"""
        try:
            if self.use_redis and self.redis_client:
                return self.redis_client.setex(key, ttl, value)
            # 使用内存缓存作为备选
            self.memory_cache[key] = json.loads(value)
            self.memory_cache_expiry[key] = time.time() + ttl
            self._cleanup_expired_memory_cache()
            return True
        except Exception as e:
            logger.error(f"Redis设置键值失败: {e}")
            # 尝试使用内存缓存
            try:
                self.memory_cache[key] = json.loads(value)
                self.memory_cache_expiry[key] = time.time() + ttl
                self._cleanup_expired_memory_cache()
                return True
            except:
                return False
    
    async def delete(self, key: str):
        """删除Redis键"""
        try:
            if self.use_redis and self.redis_client:
                return self.redis_client.delete(key)
            # 使用内存缓存作为备选
            if key in self.memory_cache:
                del self.memory_cache[key]
            if key in self.memory_cache_expiry:
                del self.memory_cache_expiry[key]
            return True
        except Exception as e:
            logger.error(f"Redis删除键失败: {e}")
            # 尝试使用内存缓存
            if key in self.memory_cache:
                del self.memory_cache[key]
            if key in self.memory_cache_expiry:
                del self.memory_cache_expiry[key]
            return True


# 全局Redis客户端实例
redis_client = RedisClient()
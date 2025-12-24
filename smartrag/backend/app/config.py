from pydantic_settings import BaseSettings
from typing import Optional
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


class Settings(BaseSettings):
    # 应用配置
    app_name: str = "SmartRAG Backend"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # MySQL数据库配置
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = ""  # 从环境变量读取
    mysql_database: str = "rag"
    
    @property
    def database_url(self) -> str:
        return f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}?charset=utf8mb4&connect_timeout=10"
    
    # Redis配置
    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    redis_password: Optional[str] = ""  # 从环境变量读取
    redis_db: int = 0
    
    # 邮件配置
    mail_count: str = ""  # 从环境变量读取
    mail_password: str = ""  # 从环境变量读取
    mail_server: str = ""  # 从环境变量读取
    mail_port: int = 465
    
    # JWT配置
    secret_key: str = ""  # 从环境变量读取
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24小时 = 1440分钟
    refresh_token_expire_days: int = 7
    
    # 验证码配置
    verification_code_expire_minutes: int = 5
    
    # Kafka配置
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_group_id: str = "smartrag-group"
    
    # SiliconFlow LLM配置 - 强制从环境变量读取
    siliconflow_api_key: str = ""
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"
    siliconflow_model: str = "THUDM/GLM-4-9B-0414"
    
    # MinIO配置
    minio_endpoint: str = ""
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket: str = "upload"
    
    # 文件存储路径
    file_storage_path: str = "/home/seven/work/talor/rag/file_databases"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 确保关键配置已设置
        self._validate_required_settings()
    
    def _validate_required_settings(self):
        """验证必需的配置项"""
        required_settings = {
            "mysql_password": self.mysql_password,
            "redis_password": self.redis_password,
            "mail_count": self.mail_count,
            "mail_password": self.mail_password,
            "mail_server": self.mail_server,
            "secret_key": self.secret_key,
            "siliconflow_api_key": self.siliconflow_api_key,
        }
        
        missing_settings = [
            setting for setting, value in required_settings.items() 
            if not value or value.strip() == ""
        ]
        
        if missing_settings:
            raise ValueError(
                f"以下必需的环境变量未设置: {', '.join(missing_settings)}. "
                "请检查 .env 文件或环境变量配置。"
            )
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
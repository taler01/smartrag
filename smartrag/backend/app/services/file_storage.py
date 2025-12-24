import os
import hashlib
import shutil
from pathlib import Path
from typing import Tuple, Optional
from fastapi import UploadFile
from minio import Minio
from app.utils.logger import logger
from app.config import settings


class FileStorageService:
    """文件存储服务"""
    
    def __init__(self):
        # 确保文件存储目录存在
        self.base_dir = Path(settings.file_storage_path)
        self.public_dir = self.base_dir / "public"
        self.personal_dir = self.base_dir / "personal"
        
        # MinIO配置 - 从环境变量读取
        self.minio_endpoint = settings.minio_endpoint
        self.minio_access_key = settings.minio_access_key
        self.minio_secret_key = settings.minio_secret_key
        self.minio_bucket = settings.minio_bucket
        self.minio_client = Minio(
            self.minio_endpoint,
            access_key=self.minio_access_key,
            secret_key=self.minio_secret_key,
            secure=False
        )
        
        # 创建目录结构
        self._ensure_directories()
        # 确保MinIO bucket存在
        self._ensure_minio_bucket()
    
    def _ensure_directories(self):
        """确保必要的目录存在"""
        try:
            self.base_dir.mkdir(parents=True, exist_ok=True)
            self.public_dir.mkdir(exist_ok=True)
            self.personal_dir.mkdir(exist_ok=True)
            logger.info(f"文件存储目录已准备: {self.base_dir}")
        except Exception as e:
            logger.error(f"创建文件存储目录失败: {e}")
            raise
    
    def _ensure_minio_bucket(self):
        """确保MinIO bucket存在"""
        try:
            if not self.minio_client.bucket_exists(self.minio_bucket):
                self.minio_client.make_bucket(self.minio_bucket)
                logger.info(f"MinIO bucket已创建: {self.minio_bucket}")
            else:
                logger.info(f"MinIO bucket已存在: {self.minio_bucket}")
        except Exception as e:
            logger.error(f"创建MinIO bucket失败: {e}")
            raise
    
    def _calculate_file_hash(self, file_content: bytes) -> str:
        """计算文件的SHA256哈希值"""
        return hashlib.sha256(file_content).hexdigest()
    
    async def _upload_to_minio(self, file_path: Path, object_name: str) -> str:
        """
        上传文件到MinIO
        
        Args:
            file_path: 本地文件路径
            object_name: MinIO中的对象名称
            
        Returns:
            str: MinIO访问URL
        """
        try:
            if not file_path.exists():
                raise FileNotFoundError(f"文件不存在: {file_path}")
            
            logger.debug(f"开始上传到MinIO: {object_name}")
            
            # 上传文件
            self.minio_client.fput_object(
                bucket_name=self.minio_bucket,
                object_name=object_name,
                file_path=str(file_path)
            )
            
            # 构建访问URL
            file_url = f"http://{self.minio_endpoint}/{self.minio_bucket}/{object_name}"
            
            logger.info(f"文件已上传到MinIO: {object_name}, URL: {file_url}")
            
            return file_url
            
        except Exception as e:
            logger.error(f"上传到MinIO失败: {e} (文件: {file_path})")
            raise
    
    async def save_file(self, file: UploadFile, doc_type: str = "public") -> Tuple[str, str, int, str, str, str]:
        """
        保存上传的文件到本地和MinIO
        
        Args:
            file: 上传的文件对象
            doc_type: 文档类型 ("public" 或 "personal")
            
        Returns:
            Tuple: (文件哈希, 本地文件路径, 文件大小, 文件类型, MinIO文件名, MinIO访问URL)
        """
        try:
            # 读取文件内容
            logger.debug(f"开始读取文件内容: {file.filename}")
            file_content = await file.read()
            file_size = len(file_content)
            logger.debug(f"文件读取完成: {file.filename}, 大小: {file_size}字节")
            
            # 计算文件哈希
            file_hash = self._calculate_file_hash(file_content)
            logger.debug(f"文件哈希计算完成: {file.filename} -> {file_hash}")
            
            # 确定文件类型
            file_extension = Path(file.filename).suffix.lower()
            file_type = file_extension[1:] if file_extension else "unknown"  # 去掉点号
            
            # 确定存储目录
            target_dir = self.public_dir if doc_type == "public" else self.personal_dir
            
            # 构建完整文件路径，直接存放在public或personal文件夹下
            file_path = target_dir / f"{file_hash}{file_extension}"
            
            # 如果文件已存在（相同哈希），则不需要重新保存
            if not file_path.exists():
                # 保存文件到本地
                with open(file_path, "wb") as f:
                    f.write(file_content)
                logger.info(f"文件已保存到本地: {file_path} (原文件名: {file.filename}, 类型: {doc_type})")
            else:
                logger.info(f"文件已存在，跳过本地保存: {file_path} (原文件名: {file.filename}, 类型: {doc_type})")
            
            # 上传到MinIO
            minio_object_name = f"{file_hash}{file_extension}"
            minio_filename = f"{file_hash}{file_extension}"
            minio_url = await self._upload_to_minio(file_path, minio_object_name)
            
            # 返回相对路径（相对于base_dir）
            relative_path = str(file_path.relative_to(self.base_dir))
            
            return file_hash, relative_path, file_size, file_type, minio_filename, minio_url
            
        except Exception as e:
            logger.error(f"保存文件失败: {e} (文件名: {file.filename}, 类型: {doc_type})")
            raise
    
    def get_file_path(self, relative_path: str) -> str:
        """
        获取文件的完整路径
        
        Args:
            relative_path: 相对路径
            
        Returns:
            str: 文件的完整路径
        """
        return str(self.base_dir / relative_path)
    
    def delete_file(self, relative_path: str) -> bool:
        """
        删除文件
        
        Args:
            relative_path: 相对路径
            
        Returns:
            bool: 删除是否成功
        """
        try:
            file_path = self.base_dir / relative_path
            if file_path.exists():
                file_path.unlink()
                logger.info(f"文件已删除: {file_path}")
                return True
            else:
                logger.warning(f"文件不存在，无法删除: {file_path}")
                return False
        except Exception as e:
            logger.error(f"删除文件失败: {e}")
            return False
    
    def file_exists(self, relative_path: str) -> bool:
        """
        检查文件是否存在
        
        Args:
            relative_path: 相对路径
            
        Returns:
            bool: 文件是否存在
        """
        file_path = self.base_dir / relative_path
        return file_path.exists()


# 创建全局文件存储服务实例
file_storage_service = FileStorageService()
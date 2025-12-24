from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class PublicDocument(Base):
    """公共文档模型"""
    __tablename__ = "public_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)              # 原始文件名
    file_path = Column(String(500), nullable=False)             # 文件存储路径
    file_size = Column(BigInteger, nullable=False)              # 文件大小(字节)
    file_type = Column(String(50), nullable=False)               # 文件类型(txt, md, json等)
    file_hash = Column(String(64), unique=True, nullable=False)  # 文件SHA256哈希值(防重复)
    minio_filename = Column(String(500))                        # MinIO中的文件名
    file_url = Column(String(500))                               # MinIO访问URL
    
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 上传者ID
    upload_time = Column(DateTime, default=func.now())           # 上传时间
    
    title = Column(String(255))                                  # 文档标题(可选)
    description = Column(Text)                                   # 文档描述(可选)
    
    is_active = Column(Boolean, default=True)                    # 是否激活
    is_processed = Column(Boolean, default=False)                # 是否已处理(向量化等)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    uploader = relationship("User", back_populates="public_documents")
    permissions = relationship("DocumentPermission", back_populates="document", cascade="all, delete-orphan")


class PersonalDocument(Base):
    """个人文档模型"""
    __tablename__ = "personal_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)              # 原始文件名
    file_path = Column(String(500), nullable=False)             # 文件存储路径
    file_size = Column(BigInteger, nullable=False)              # 文件大小(字节)
    file_type = Column(String(50), nullable=False)               # 文件类型
    file_hash = Column(String(64), unique=True, nullable=False)  # 文件SHA256哈希值
    minio_filename = Column(String(500))                        # MinIO中的文件名
    file_url = Column(String(500))                               # MinIO访问URL
    
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 文件所有者ID
    upload_time = Column(DateTime, default=func.now())           # 上传时间
    
    title = Column(String(255))                                  # 文档标题
    description = Column(Text)                                   # 文档描述
    
    is_active = Column(Boolean, default=True)                    # 是否激活
    is_processed = Column(Boolean, default=False)                # 是否已处理
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    owner = relationship("User", back_populates="personal_documents")


class DocumentPermission(Base):
    """文档权限模型"""
    __tablename__ = "document_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("public_documents.id"), nullable=False)  # 公共文档ID
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)                 # 可访问的角色ID
    
    granted_at = Column(DateTime, default=func.now())           # 授权时间
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # 授权者(通常是上传者)
    
    # 关系
    document = relationship("PublicDocument", back_populates="permissions")
    role = relationship("Role")
    grantor = relationship("User")


class UserRolePermission(Base):
    """用户角色权限模型"""
    __tablename__ = "user_role_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("public_documents.id"), nullable=False)  # 公共文档ID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)                 # 特定用户ID
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)                 # 用户角色ID
    
    can_read = Column(Boolean, default=True)                 # 是否可读
    can_write = Column(Boolean, default=False)               # 是否可写
    can_delete = Column(Boolean, default=False)              # 是否可删除
    
    granted_at = Column(DateTime, default=func.now())        # 授权时间
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # 授权者
    
    # 关系
    document = relationship("PublicDocument")
    user = relationship("User", foreign_keys=[user_id])
    role = relationship("Role")
    grantor = relationship("User", foreign_keys=[granted_by])
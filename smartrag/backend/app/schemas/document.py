from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class DocumentBase(BaseModel):
    """文档基础模型"""
    filename: str
    title: Optional[str] = None
    description: Optional[str] = None


class PublicDocumentCreate(DocumentBase):
    """创建公共文档的请求模型"""
    file_path: str
    file_size: int
    file_type: str
    file_hash: str
    uploader_id: int
    permissions: Optional[List[int]] = None  # 角色ID列表


class PersonalDocumentCreate(DocumentBase):
    """创建个人文档的请求模型"""
    file_path: str
    file_size: int
    file_type: str
    file_hash: str
    owner_id: int


class PublicDocumentResponse(DocumentBase):
    """公共文档响应模型"""
    id: int
    file_path: str
    file_size: int
    file_type: str
    file_hash: str
    uploader_id: int
    upload_time: datetime
    is_active: bool
    is_processed: bool
    created_at: datetime
    updated_at: datetime
    permissions: Optional[List[int]] = None  # 角色ID列表
    
    class Config:
        from_attributes = True


class PersonalDocumentResponse(DocumentBase):
    """个人文档响应模型"""
    id: int
    file_path: str
    file_size: int
    file_type: str
    file_hash: str
    owner_id: int
    upload_time: datetime
    is_active: bool
    is_processed: bool
    created_at: datetime
    updated_at: datetime
    permissions: Optional[List[int]] = None  # 角色ID列表
    
    class Config:
        from_attributes = True


class DocumentPermissionResponse(BaseModel):
    """文档权限响应模型"""
    id: int
    document_id: int
    role_id: int
    granted_at: datetime
    granted_by: int
    
    class Config:
        from_attributes = True


class DocumentUploadResponse(BaseModel):
    """文档上传响应模型"""
    success: bool
    message: str
    document_id: int
    document_type: str  # "public" 或 "personal"
    filename: str
    file_path: str
    file_size: int  # 添加文件大小字段
    permissions: Optional[Dict[str, Any]] = None


class DocumentListResponse(BaseModel):
    """文档列表响应模型"""
    documents: List[PublicDocumentResponse] = []
    total: int
    page: int
    page_size: int


class DocumentProcessRequest(BaseModel):
    """文档处理请求模型"""
    document_ids: List[int]
    process_type: str = "embedding"  # 处理类型，如embedding、indexing等


class DocumentProcessResponse(BaseModel):
    """文档处理响应模型"""
    success: bool
    message: str
    processed_count: int
    failed_count: int
    failed_documents: List[int] = []  # 处理失败的文档ID列表
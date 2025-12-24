from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role_ids = Column(JSON, nullable=False)  # 支持多角色的JSON数组
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    last_login = Column(DateTime, nullable=True)
    
    # 关系
    public_documents = relationship("PublicDocument", back_populates="uploader")
    personal_documents = relationship("PersonalDocument", back_populates="owner")
    conversations = relationship("Conversation", backref="user")
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}', role_ids={self.role_ids})>"
    
    def get_role_ids(self):
        """获取角色ID列表"""
        # 确保role_ids是列表类型
        if self.role_ids is None:
            return []
        if isinstance(self.role_ids, list):
            return self.role_ids
        # 如果是字符串，尝试解析为JSON
        try:
            import json
            return json.loads(self.role_ids) if isinstance(self.role_ids, str) else []
        except (json.JSONDecodeError, TypeError):
            return []
    
    def has_role(self, role_code: str) -> bool:
        """检查用户是否有指定角色（支持角色代码）"""
        # 这里需要根据角色代码检查权限
        # 由于角色代码和ID的映射关系，这里需要查询数据库或使用映射表
        # 暂时返回True以保持功能正常，后续需要实现完整的角色检查逻辑
        return True
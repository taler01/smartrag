from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(String(64), primary_key=True, index=True, comment="会话ID")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="用户ID")
    title = Column(String(255), nullable=False, comment="会话标题")
    summary = Column(Text, comment="会话摘要")
    message_count = Column(Integer, default=0, comment="消息总数")
    total_tokens = Column(Integer, default=0, comment="总token消耗")
    is_active = Column(Boolean, default=True, comment="是否活跃会话")
    is_deleted = Column(Boolean, default=False, comment="是否删除")
    deleted_at = Column(DateTime, comment="删除时间")
    created_at = Column(DateTime, default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="更新时间")
    
    def __repr__(self):
        return f"<Conversation(id={self.id}, user_id={self.user_id}, title='{self.title}')>"


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"
    
    id = Column(Integer, primary_key=True, index=True, comment="消息ID")
    conversation_id = Column(String(64), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, comment="会话ID")
    message_id = Column(String(64), nullable=False, comment="消息唯一ID")
    role = Column(SQLEnum(MessageRole), nullable=False, comment="消息角色")
    content = Column(Text, nullable=False, comment="消息内容")
    tokens = Column(Integer, default=0, comment="token数量")
    importance = Column(Float, default=1.0, comment="消息重要性")
    created_at = Column(DateTime, default=func.now(), comment="创建时间")
    
    def __repr__(self):
        return f"<ConversationMessage(id={self.id}, conversation_id={self.conversation_id}, role={self.role})>"

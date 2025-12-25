"""
会话服务 - 处理会话的数据库操作
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.conversation import Conversation, ConversationMessage, MessageRole
from app.utils.logger import logger


class ConversationService:
    """会话服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_conversation(
        self,
        conversation_id: str,
        user_id: int,
        title: str = "新对话"
    ) -> Conversation:
        """创建新会话"""
        try:
            from datetime import datetime
            conversation = Conversation(
                id=conversation_id,
                user_id=user_id,
                title=title,
                message_count=0,
                total_tokens=0,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            self.db.add(conversation)
            self.db.commit()
            self.db.refresh(conversation)
            logger.info(f"创建新会话: id={conversation_id}, user_id={user_id}, title={title}")
            return conversation
        except Exception as e:
            logger.error(f"创建会话失败: {e}")
            self.db.rollback()
            raise
    
    def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """获取会话信息"""
        try:
            conversation = self.db.query(Conversation).filter(
                and_(
                    Conversation.id == conversation_id,
                    Conversation.is_deleted == False
                )
            ).first()
            return conversation
        except Exception as e:
            logger.error(f"获取会话失败: {e}")
            return None
    
    def get_user_conversations(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
        is_active: Optional[bool] = None
    ) -> tuple[List[Conversation], int]:
        """获取用户的所有会话"""
        try:
            query = self.db.query(Conversation).filter(
                and_(
                    Conversation.user_id == user_id,
                    Conversation.is_deleted == False
                )
            )
            
            if is_active is not None:
                query = query.filter(Conversation.is_active == is_active)
            
            total = query.count()
            conversations = query.order_by(Conversation.updated_at.desc()).offset(skip).limit(limit).all()
            return conversations, total
        except Exception as e:
            logger.error(f"获取用户会话列表失败: {e}")
            return [], 0
    
    def update_conversation_summary(
        self,
        conversation_id: str,
        summary: str
    ) -> bool:
        """更新会话摘要"""
        try:
            conversation = self.db.query(Conversation).filter(
                and_(
                    Conversation.id == conversation_id,
                    Conversation.is_deleted == False
                )
            ).first()
            
            if not conversation:
                logger.warning(f"会话不存在: {conversation_id}")
                return False
            
            conversation.summary = summary
            conversation.updated_at = datetime.now()
            self.db.flush()
            logger.info(f"更新会话摘要: id={conversation_id}")
            return True
        except Exception as e:
            logger.error(f"更新会话摘要失败: {e}")
            self.db.rollback()
            return False
    
    def update_conversation_title(
        self,
        conversation_id: str,
        title: str
    ) -> Optional[Conversation]:
        """更新会话标题"""
        try:
            conversation = self.db.query(Conversation).filter(
                and_(
                    Conversation.id == conversation_id,
                    Conversation.is_deleted == False
                )
            ).first()
            
            if not conversation:
                logger.warning(f"会话不存在: {conversation_id}")
                return None
            
            conversation.title = title
            conversation.updated_at = datetime.now()
            self.db.flush()
            logger.info(f"更新会话标题: id={conversation_id}, title={title}")
            return conversation
        except Exception as e:
            logger.error(f"更新会话标题失败: {e}")
            self.db.rollback()
            return None
    
    def update_conversation_stats(
        self,
        conversation_id: str,
        message_count: int,
        total_tokens: int
    ) -> bool:
        """更新会话统计信息"""
        try:
            conversation = self.db.query(Conversation).filter(
                and_(
                    Conversation.id == conversation_id,
                    Conversation.is_deleted == False
                )
            ).first()
            
            if not conversation:
                logger.warning(f"会话不存在: {conversation_id}")
                return False
            
            conversation.message_count = message_count
            conversation.total_tokens = total_tokens
            conversation.updated_at = datetime.now()
            self.db.flush()
            return True
        except Exception as e:
            logger.error(f"更新会话统计信息失败: {e}")
            self.db.rollback()
            return False
    
    def save_message(
        self,
        conversation_id: str,
        message_id: str,
        role: MessageRole,
        content: str,
        tokens: int = 0,
        importance: float = 1.0
    ) -> Optional[ConversationMessage]:
        """保存会话消息"""
        try:
            from datetime import datetime, timedelta
            message = ConversationMessage(
                conversation_id=conversation_id,
                message_id=message_id,
                role=role,
                content=content,
                tokens=tokens,
                importance=importance,
                created_at=datetime.now() if role == MessageRole.user else datetime.now() + timedelta(seconds=1)
            )
            self.db.add(message)
            self.db.flush()
            logger.debug(f"保存消息: conversation_id={conversation_id}, role={role}")
            return message
        except Exception as e:
            logger.error(f"保存消息失败: {e}")
            self.db.rollback()
            return None
    
    def get_conversation_messages(
        self,
        conversation_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> tuple[List[ConversationMessage], int]:
        """获取会话消息列表"""
        try:
            query = self.db.query(ConversationMessage).filter(
                ConversationMessage.conversation_id == conversation_id
            )
            
            total = query.count()
            messages = query.order_by(ConversationMessage.created_at.asc()).offset(skip).limit(limit).all()
            return messages, total
        except Exception as e:
            logger.error(f"获取会话消息失败: {e}")
            return [], 0
    
    def delete_conversation(self, conversation_id: str) -> bool:
        """删除会话（软删除）"""
        try:
            conversation = self.db.query(Conversation).filter(
                Conversation.id == conversation_id
            ).first()
            
            if not conversation:
                logger.warning(f"会话不存在: {conversation_id}")
                return False
            
            conversation.is_deleted = True
            conversation.deleted_at = datetime.now()
            conversation.updated_at = datetime.now()
            self.db.commit()
            logger.info(f"删除会话: id={conversation_id}")
            return True
        except Exception as e:
            logger.error(f"删除会话失败: {e}")
            self.db.rollback()
            return False
    
    def set_conversation_active(self, conversation_id: str, is_active: bool) -> bool:
        """设置会话活跃状态"""
        try:
            conversation = self.db.query(Conversation).filter(
                Conversation.id == conversation_id
            ).first()
            
            if not conversation:
                logger.warning(f"会话不存在: {conversation_id}")
                return False
            
            conversation.is_active = is_active
            conversation.updated_at = datetime.now()
            self.db.flush()
            logger.info(f"设置会话活跃状态: id={conversation_id}, is_active={is_active}")
            return True
        except Exception as e:
            logger.error(f"设置会话活跃状态失败: {e}")
            self.db.rollback()
            return False

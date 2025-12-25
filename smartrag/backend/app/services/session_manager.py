"""
用户会话管理器 - 实现用户隔离的短期记忆存储
"""
import json
import asyncio
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from sqlalchemy.orm import Session
from app.utils.redis_client import redis_client
from app.utils.logger import logger
from app.database import get_db_context
from app.services.conversation_service import ConversationService
from app.services.summary_service import summary_service


@dataclass
class ChatMessage:
    """聊天消息数据类"""
    role: str
    content: str
    timestamp: datetime
    tokens: int = 0
    importance: float = 1.0


@dataclass
class UserSession:
    """用户会话数据类"""
    user_id: int
    conversation_id: str
    messages: List[ChatMessage]
    total_tokens: int
    last_activity: datetime
    max_tokens: int = 4000
    max_rounds: int = 10
    summary: Optional[str] = None
    
    def get_history(self) -> List[Dict[str, Any]]:
        """获取会话历史记录"""
        history = []
        for message in self.messages:
            history.append({
                "role": message.role,
                "content": message.content
            })
        return history
    
    def get_rounds(self) -> int:
        """获取当前对话轮数（一轮包括用户消息和助手回复）"""
        user_messages = [msg for msg in self.messages if msg.role == "user"]
        return len(user_messages)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        messages = []
        for msg in self.messages:
            messages.append({
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat(),
                "tokens": msg.tokens,
                "importance": msg.importance
            })
        
        return {
            "user_id": self.user_id,
            "conversation_id": self.conversation_id,
            "messages": messages,
            "total_tokens": self.total_tokens,
            "last_activity": self.last_activity.isoformat(),
            "max_tokens": self.max_tokens,
            "max_rounds": self.max_rounds,
            "summary": self.summary
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UserSession":
        """从字典创建实例"""
        messages = []
        for msg_data in data.get("messages", []):
            msg_data["timestamp"] = datetime.fromisoformat(msg_data["timestamp"])
            messages.append(ChatMessage(**msg_data))
        
        return cls(
            user_id=data["user_id"],
            conversation_id=data["conversation_id"],
            messages=messages,
            total_tokens=data["total_tokens"],
            last_activity=datetime.fromisoformat(data["last_activity"]),
            max_tokens=data.get("max_tokens", 4000),
            max_rounds=data.get("max_rounds", 10),
            summary=data.get("summary")
        )


class UserSessionManager:
    """用户会话管理器"""
    
    def __init__(self):
        self.redis_client = redis_client
        self.session_ttl = 600
        self.cleanup_interval = 300
        self._cleanup_task = None
        self._initialized = False
    
    async def initialize(self):
        """初始化会话管理器"""
        if self._initialized:
            return
        
        try:
            await self.redis_client.ping()
            logger.info("Redis连接测试成功")
            
            await self.start_cleanup_task()
            
            self._initialized = True
            logger.info("用户会话管理器初始化完成")
        except Exception as e:
            logger.error(f"用户会话管理器初始化失败: {e}")
            raise
    
    def close(self):
        """关闭会话管理器"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None
            logger.info("用户会话管理器已关闭")
    
    async def start_cleanup_task(self):
        """启动定期清理任务"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_expired_sessions())
    
    async def stop_cleanup_task(self):
        """停止清理任务"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
    
    async def create_conversation(self, user_id: int, conversation_id: str, title: str = "新对话") -> bool:
        """在数据库中创建新会话"""
        try:
            with get_db_context() as db:
                conv_service = ConversationService(db)
                conv_service.create_conversation(conversation_id, user_id, title)
                logger.info(f"在数据库中创建会话: {conversation_id}")
                return True
        except Exception as e:
            logger.error(f"创建会话失败: {e}")
            return False
    
    async def get_conversation_summary(self, conversation_id: str) -> Optional[str]:
        """从数据库获取会话摘要"""
        try:
            with get_db_context() as db:
                conv_service = ConversationService(db)
                conversation = conv_service.get_conversation(conversation_id)
                if conversation:
                    return conversation.summary
                return None
        except Exception as e:
            logger.error(f"获取会话摘要失败: {e}")
            return None
    
    async def conversation_exists(self, conversation_id: str) -> bool:
        """检查会话是否存在于数据库中"""
        try:
            with get_db_context() as db:
                conv_service = ConversationService(db)
                conversation = conv_service.get_conversation(conversation_id)
                return conversation is not None
        except Exception as e:
            logger.error(f"检查会话是否存在失败: {e}")
            return False
    
    async def save_conversation_summary(self, conversation_id: str, summary: str) -> bool:
        """保存会话摘要到数据库"""
        try:
            with get_db_context() as db:
                conv_service = ConversationService(db)
                return conv_service.update_conversation_summary(conversation_id, summary)
        except Exception as e:
            logger.error(f"保存会话摘要失败: {e}")
            return False
    
    async def get_user_session(self, user_id: int, conversation_id: Optional[str] = None) -> UserSession:
        """获取用户会话"""
        if not conversation_id:
            logger.error("conversation_id 不能为空")
            raise ValueError("conversation_id 不能为空")
        
        session_key = f"conversation:{conversation_id}"
        
        try:
            logger.debug(f"从Redis获取会话数据，键: {session_key}")
            session_data = await self.redis_client.get(session_key)
            
            if session_data:
                logger.debug(f"找到会话 {conversation_id} 的缓存数据")
                session = UserSession.from_dict(json.loads(session_data))
                logger.info(f"会话 {conversation_id} 缓存: 消息数={len(session.messages)}, 轮数={session.get_rounds()}")
                session.last_activity = datetime.now()
                await self.save_user_session(session)
                return session
            else:
                logger.info(f"会话 {conversation_id} 没有缓存，从数据库加载")
                
                # 检查会话是否存在于数据库中
                if not await self.conversation_exists(conversation_id):
                    logger.error(f"会话 {conversation_id} 不存在于数据库中")
                    raise ValueError(f"会话 {conversation_id} 不存在")
                
                # 从数据库获取摘要
                summary = await self.get_conversation_summary(conversation_id)
                
                # 返回空消息列表的会话，不创建Redis缓存
                logger.info(f"从数据库加载会话 {conversation_id}，摘要: {summary}")
                return UserSession(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    messages=[],
                    total_tokens=0,
                    last_activity=datetime.now(),
                    summary=summary
                )
        except Exception as e:
            logger.error(f"获取用户会话失败: {e}")
            raise
    
    async def save_user_session(self, session: UserSession):
        """保存用户会话"""
        session_key = f"conversation:{session.conversation_id}"
        
        try:
            session_data = json.dumps(session.to_dict(), ensure_ascii=False)
            await self.redis_client.setex(
                session_key, 
                self.session_ttl, 
                session_data
            )
        except Exception as e:
            logger.error(f"保存用户会话失败: {e}")
    
    async def add_message(self, user_id: int, conversation_id: str, role: str, content: str, tokens: int = 0) -> UserSession:
        """添加消息到用户会话"""
        try:
            session = await self.get_user_session(user_id, conversation_id)
            
            message = ChatMessage(
                role=role,
                content=content,
                timestamp=datetime.now() if role == "user" else datetime.now() + timedelta(seconds=1),
                tokens=tokens,
                importance=self._calculate_importance(role, content)
            )
            
            logger.info(f"添加消息到会话 {conversation_id}: 角色={role}, 内容前50字符={content[:50]}, Token数={tokens}")
            
            session.messages.append(message)
            session.total_tokens += tokens
            session.last_activity = datetime.now()
            
            # 保存消息到数据库
            message_id = f"msg_{uuid.uuid4().hex[:16]}_{user_id}"
            await self._save_message_to_db(session.conversation_id, message_id, role, content, tokens)
            
            # 如果是第一条用户消息，更新会话标题
            if role == "user":
                user_messages = [msg for msg in session.messages if msg.role == "user"]
                if len(user_messages) == 1:
                    await self._update_conversation_title(session.conversation_id, content)
            
            # 检查是否超出对话轮数限制
            if session.get_rounds() > session.max_rounds:
                await self._handle_round_limit(session)
            
            # 保存会话到Redis，每次活动更新过期时间
            await self.save_user_session(session)
            
            logger.info(f"消息已添加并保存，当前会话消息数: {len(session.messages)}, 对话轮数: {session.get_rounds()}, 总Token数: {session.total_tokens}")
            return session
        except Exception as e:
            logger.error(f"添加消息到会话 {conversation_id} 失败: {e}")
            logger.exception(e)
            raise
    
    async def _save_message_to_db(self, conversation_id: str, message_id: str, role: str, content: str, tokens: int) -> bool:
        """保存消息到数据库"""
        try:
            from app.models.conversation import MessageRole
            
            # 转换角色
            role_map = {"user": MessageRole.user, "model": MessageRole.assistant, "assistant": MessageRole.assistant}
            message_role = role_map.get(role, MessageRole.user)
            
            with get_db_context() as db:
                conv_service = ConversationService(db)
                conv_service.save_message(conversation_id, message_id, message_role, content, tokens)
                logger.debug(f"消息已保存到数据库: {message_id}")
                return True
        except Exception as e:
            logger.error(f"保存消息到数据库失败: {e}")
            logger.exception(e)
            return False
    
    async def _update_conversation_title(self, conversation_id: str, first_message: str) -> bool:
        """使用第一条用户消息更新会话标题"""
        try:
            # 截取前30个字符作为标题
            title = first_message[:30]
            if len(first_message) > 30:
                title += "..."
            
            with get_db_context() as db:
                conv_service = ConversationService(db)
                result = conv_service.update_conversation_title(conversation_id, title)
                if result:
                    logger.info(f"会话 {conversation_id} 标题已更新为: {title}")
                return result
        except Exception as e:
            logger.error(f"更新会话标题失败: {e}")
            return False
    
    async def get_conversation_context(self, user_id: int, conversation_id: Optional[str] = None) -> List[Dict[str, str]]:
        """获取用于LLM的对话上下文（包含摘要）"""
        session = await self.get_user_session(user_id, conversation_id)
        
        context = []
        
        # 添加系统消息
        context.append({
            "role": "system",
            "content": "你是一个智能助手，请根据用户的问题提供准确、有用的回答。"
        })
        
        # 添加摘要（如果有）
        if session.summary:
            context.append({
                "role": "system",
                "content": f"以下是之前对话的摘要：{session.summary}"
            })
        
        # 添加历史消息
        for message in session.messages:
            context.append({
                "role": message.role,
                "content": message.content
            })
        
        return context
    
    def get_history(self, session: UserSession) -> List[Dict[str, Any]]:
        """获取会话历史记录"""
        history = []
        for message in session.messages:
            history.append({
                "role": message.role,
                "content": message.content
            })
        return history
    
    async def clear_session(self, conversation_id: str):
        """清除会话缓存"""
        session_key = f"conversation:{conversation_id}"
        
        try:
            await self.redis_client.delete(session_key)
            logger.info(f"已清除会话 {conversation_id} 的缓存")
        except Exception as e:
            logger.error(f"清除会话 {conversation_id} 缓存失败: {e}")
    
    async def _handle_round_limit(self, session: UserSession):
        """处理对话轮数限制，生成摘要并清空Redis"""
        try:
            logger.info(f"会话 {session.conversation_id} 达到 {session.max_rounds} 轮对话，开始生成摘要")
            
            # 获取当前摘要
            old_summary = session.summary
            
            # 生成新摘要
            conversation_history = session.get_history()
            new_summary = await summary_service.generate_summary(conversation_history, old_summary)
            
            # 保存摘要到数据库
            await self.save_conversation_summary(session.conversation_id, new_summary)
            
            # 清空Redis中的消息
            session.messages = []
            session.total_tokens = 0
            session.summary = new_summary
            
            logger.info(f"摘要已生成并保存: {new_summary[:100]}...")
            logger.info(f"Redis中的对话记录已清空")
            
        except Exception as e:
            logger.error(f"处理对话轮数限制失败: {e}")
            logger.exception(e)
    
    def _calculate_importance(self, role: str, content: str) -> float:
        """计算消息重要性"""
        importance = 1.0
        
        role_weights = {"system": 1.0, "user": 0.8, "model": 0.6}
        importance += role_weights.get(role, 0.5)
        
        length = len(content)
        if 50 <= length <= 500:
            importance += 0.2
        elif length > 500:
            importance += 0.1
        
        important_keywords = ["重要", "紧急", "关键", "必须", "请", "谢谢"]
        for keyword in important_keywords:
            if keyword in content:
                importance += 0.1
                break
        
        return min(importance, 2.0)
    
    async def _cleanup_expired_sessions(self):
        """定期清理过期会话"""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval)
                logger.info("开始清理过期用户会话")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"清理过期会话时出错: {e}")


# 创建全局会话管理器实例
user_session_manager = UserSessionManager()

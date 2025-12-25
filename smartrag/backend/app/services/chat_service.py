from typing import List, Dict, Any, Optional, AsyncGenerator
import asyncio
import random
import httpx
from datetime import datetime
from openai import AsyncOpenAI
from app.schemas.chat import ChatRequest, ChatResponse
from app.config import settings
from app.utils.logger import logger
from app.services.session_manager import user_session_manager
from app.database import get_db_context
from app.models.document import PublicDocument, PersonalDocument


class ChatService:
    """聊天服务类，处理消息生成和回复"""
    
    def __init__(self):
        # 初始化 AsyncOpenAI 客户端，使用 SiliconFlow 的 API
        self.client = AsyncOpenAI(
            api_key=settings.siliconflow_api_key,
            base_url=settings.siliconflow_base_url
        )
        self.model = settings.siliconflow_model
        
        # RAG API 配置
        self.rag_api_url = "http://10.168.27.191:8888/rag/query"
        
        # 备用模拟回复（当 API 不可用时使用）
        self.simulation_responses = [
            "收到",
            "已收到您的消息",
            "消息已处理",
            "收到，正在处理中",
            "已收到，感谢您的反馈"
        ]
        
        logger.info(f"ChatService 初始化完成，使用模型: {self.model}")
    
    def _prepare_messages(self, message: str, history: List[Dict[str, Any]] = None) -> List[Dict[str, str]]:
        """准备发送给 API 的消息格式"""
        messages = []
        
        # 添加系统提示
        messages.append({
            "role": "system",
            "content": "你是一个智能助手，请根据用户的问题提供准确、有用的回答。"
        })
        
        # 添加历史对话
        if history:
            for item in history:
                if item.get("role") and item.get("content"):
                    # 将"model"角色转换为"assistant"以符合API要求
                    role = item["role"]
                    if role == "model":
                        role = "assistant"
                    
                    messages.append({
                        "role": role,
                        "content": item["content"]
                    })
        
        # 添加当前用户消息
        messages.append({
            "role": "user",
            "content": message
        })
        
        return messages
    
    async def _prepare_messages_with_summary(self, user_id: int, message: str, conversation_id: Optional[str] = None) -> List[Dict[str, str]]:
        """准备发送给 API 的消息格式（包含摘要）"""
        # 使用会话管理器获取包含摘要的上下文
        context = await user_session_manager.get_conversation_context(user_id, conversation_id)
        
        # 添加当前用户消息
        context.append({
            "role": "user",
            "content": message
        })
        
        return context
    
    async def _call_llm_api(self, messages: List[Dict[str, str]], stream: bool = False) -> Any:
        """调用 LLM API"""
        try:
            params = {
                "model": self.model,
                "messages": messages,
                "stream": stream
            }
            
            logger.info(f"调用 LLM API，模型: {self.model}, 流式: {stream}")
            return await self.client.chat.completions.create(**params)
        except Exception as e:
            logger.error(f"调用 LLM API 失败: {str(e)}")
            raise
    
    async def generate_response(self, request: ChatRequest) -> ChatResponse:
        """
        生成聊天回复
        
        Args:
            request: 聊天请求对象
            
        Returns:
            ChatResponse: 聊天回复对象
        """
        try:
            # 记录请求
            logger.info(f"收到聊天请求: {request.message[:50]}...")
            
            # 准备消息
            messages = self._prepare_messages(request.message, request.history)
            
            try:
                # 调用 LLM API
                response = await self._call_llm_api(messages, stream=False)
                response_text = response.choices[0].message.content
                
                logger.info(f"LLM API 返回回复: {response_text[:50]}...")
            except Exception as api_error:
                logger.warning(f"LLM API 调用失败，使用模拟回复: {str(api_error)}")
                # API 调用失败时使用模拟回复
                await asyncio.sleep(0.5 + random.random() * 1.0)
                response_text = random.choice(self.simulation_responses)
            
            # 生成或使用提供的会话ID
            conversation_id = request.conversation_id or f"conv_{datetime.now().timestamp()}"
            
            # 创建响应
            response = ChatResponse(
                message=response_text,
                conversation_id=conversation_id,
                timestamp=datetime.now()
            )
            
            logger.info(f"生成聊天回复: {response_text[:50]}...")
            return response
            
        except Exception as e:
            logger.error(f"生成聊天回复时出错: {str(e)}")
            # 返回错误响应
            return ChatResponse(
                message="抱歉，处理您的请求时出现了错误，请稍后再试。",
                conversation_id=request.conversation_id or "error",
                timestamp=datetime.now()
            )
    
    async def _call_rag_api(self, query: str, knowledge_name: str) -> dict:
        """调用 RAG API 进行知识检索"""
        try:
            logger.info(f"调用 RAG API: query={query[:50]}..., knowledge_name={knowledge_name}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.rag_api_url,
                    data={
                        "query": query,
                        "knowledge_name": knowledge_name
                    }
                )
                response.raise_for_status()
                result = response.json()
                
                logger.info(f"RAG API 返回结果: {result}")
                
                status = result.get("status", "")
                data = result.get("data", {})
                
                if not isinstance(data, dict):
                    logger.error(f"RAG API 返回的 data 不是字典类型: {type(data)}")
                    return {
                        "status": status,
                        "context": "",
                        "references": []
                    }
                
                chunks = data.get("chunks", [])
                # references = data.get("references", [])
                
                if not isinstance(chunks, list):
                    logger.error(f"RAG API 返回的 chunks 不是列表类型: {type(chunks)}")
                    return {
                        "status": status,
                        "context": "",
                        "references": []
                    }
                
                if len(chunks) == 0:
                    logger.warning(f"RAG 检索未找到相关内容，status: {status}")
                    return {
                        "status": status,
                        "context": "",
                        "references": []
                    }
                
                rag_contents, rag_files = [], []
                chunks_selected = chunks[:3] if len(chunks) > 3 else chunks
                unique_files = set()
                
                for i, chunk in enumerate(chunks_selected):
                    content = chunk.get("content", "")
                    file_path = chunk.get("file_path", "")
                    if content:
                        rag_contents.append(f"文献[{i+1}]:{content}")
                    if file_path and file_path not in unique_files:
                        unique_files.add(file_path)
                        original_filename = await self._get_filename_by_minio_name(file_path)
                        display_filename = original_filename if original_filename else file_path
                        rag_files.append(f"文献[{i+1}]:{display_filename}")
                
                rag_context = "\n\n".join(rag_contents)
                logger.info(f"RAG 检索成功，找到 {len(rag_contents)} 个相关内容片段，{len(rag_files)} 个唯一参考文献")
                
                return {
                    "status": status,
                    "context": rag_context,
                    "references": rag_files
                }
        except Exception as e:
            logger.error(f"调用 RAG API 失败: {str(e)}")
            return {
                "status": "error",
                "context": "",
                "references": []
            }
    
    async def _get_filename_by_minio_name(self, minio_filename: str) -> Optional[str]:
        """根据 MinIO 文件名查询原始文件名"""
        if not minio_filename:
            return None
        
        try:
            with get_db_context() as db:
                public_doc = db.query(PublicDocument).filter(PublicDocument.minio_filename == minio_filename).first()
                if public_doc:
                    return public_doc.filename
                
                personal_doc = db.query(PersonalDocument).filter(PersonalDocument.minio_filename == minio_filename).first()
                if personal_doc:
                    return personal_doc.filename
                
                return None
        except Exception as e:
            logger.error(f"查询文件名失败: {str(e)}")
            return None
    
    async def process_message_with_history(
        self, 
        message: str, 
        history: List[Dict[str, Any]] = None,
        user_role: str = "admin",
        user_id: int = None,
        conversation_id: str = None,
        knowledge_retrieval: bool = False,
        knowledge_name: str = None
    ) -> str:
        """
        处理带有历史记录的消息
        
        Args:
            message: 用户消息
            history: 对话历史
            user_role: 用户角色
            user_id: 用户ID
            conversation_id: 会话ID
            knowledge_retrieval: 是否启用知识检索
            knowledge_name: 知识库名称
            
        Returns:
            str: 回复文本
        """
        try:
            # 记录请求
            logger.info(f"处理消息: {message[:50]}...")
            logger.info(f"用户ID: {user_id}, 会话ID: {conversation_id}, 用户角色: {user_role}")
            logger.info(f"知识检索: {knowledge_retrieval}, 知识库名称: {knowledge_name}")
            
            rag_context = ""
            
            # 如果启用了知识检索，调用 RAG API
            if knowledge_retrieval and knowledge_name:
                try:
                    rag_result = await self._call_rag_api(message, knowledge_name)
                    rag_context = rag_result.get("context", [])
                    rag_files = rag_result.get("references", [])
                    if rag_context:
                        logger.info(f"RAG 检索成功，状态: {rag_result.get('status')}, 上下文长度: {len(rag_context)}, {len(rag_result.get('references', []))} 个引用")
                    else:
                        logger.warning(f"RAG 检索返回空结果，状态: {rag_result.get('status')}")
                except Exception as e:
                    logger.error(f"RAG 检索失败: {str(e)}")
            
            # 如果提供了用户ID，使用会话管理器获取历史记录
            if user_id is not None:
                try:
                    logger.info(f"正在为用户 {user_id} 初始化会话管理器...")
                    # 确保会话管理器已初始化
                    await user_session_manager.initialize()
                    
                    logger.info(f"获取用户 {user_id} 的会话...")
                    # 获取用户会话
                    session = await user_session_manager.get_user_session(user_id, conversation_id)
                    logger.info(f"当前会话ID: {session.conversation_id}, 消息数量: {len(session.messages)}, 对话轮数: {session.get_rounds()}")
                    
                    # 如果提供了会话ID且与当前会话不匹配，创建新会话
                    if conversation_id and conversation_id != session.conversation_id:
                        logger.info(f"会话ID不匹配，创建新会话。旧会话ID: {session.conversation_id}, 新会话ID: {conversation_id}")
                        await user_session_manager.clear_session(user_id)
                        session = await user_session_manager.get_user_session(user_id, conversation_id)
                        logger.info(f"新会话已创建并保存")
                    
                    logger.info(f"添加用户消息到会话: {message[:50]}...")
                    # 添加用户消息到会话
                    await user_session_manager.add_message(user_id, session.conversation_id, "user", message)
                    
                    # 使用带摘要的上下文准备消息
                    messages = await self._prepare_messages_with_summary(user_id, message, session.conversation_id)
                    
                except Exception as e:
                    logger.error(f"使用会话管理器失败，使用传入的历史记录: {str(e)}")
                    logger.exception(e)
                    # 降级使用传入的历史记录
                    messages = self._prepare_messages(message, history)
            else:
                logger.warning("未提供用户ID，无法使用会话管理器")
                messages = self._prepare_messages(message, history)
            
            # 如果有 RAG 上下文，添加到系统提示中
            if rag_context and rag_files:
                messages[0]["content"] = f"你是一个智能助手，请根据用户的问题和以下知识库内容提供准确、有用的回答。\n\n知识库内容：\n{rag_context}\n知识库里面的图片能用尽量用上，图文并茂，尽量避免全是文字\n请基于以上知识库内容回答用户的问题。回答完问题后，请在回答尾部直接添加以下参考文献文本，不要重新格式化或修改参考文献：\n\n**参考文献：**\n{chr(10).join(rag_files)}\n\n注意：知识库内容中可能包含Markdown格式的图片链接（如![图片描述](图片URL)），请务必在回答中保留这些图片链接，不要删除或修改它们。"
            
            try:
                # 调用 LLM API
                response = await self._call_llm_api(messages, stream=False)
                response_text = response.choices[0].message.content
                
                # 如果提供了用户ID，将助手回复添加到会话
                if user_id is not None:
                    try:
                        await user_session_manager.add_message(user_id, session.conversation_id, "assistant", response_text)
                    except Exception as e:
                        logger.warning(f"添加助手回复到会话失败: {str(e)}")
                
                logger.info(f"LLM API 返回回复: {response_text[:50]}...")
                return response_text
            except Exception as api_error:
                logger.warning(f"LLM API 调用失败，使用模拟回复: {str(api_error)}")
                # API 调用失败时使用模拟回复
                await asyncio.sleep(0.5 + random.random() * 1.0)
                response_text = random.choice(self.simulation_responses)
                
                # 如果提供了用户ID，将助手回复添加到会话
                if user_id is not None:
                    try:
                        await user_session_manager.add_message(user_id, session.conversation_id, "assistant", response_text)
                    except Exception as e:
                        logger.warning(f"添加助手回复到会话失败: {str(e)}")
                
                logger.info(f"生成回复: {response_text}")
                return response_text
            
        except Exception as e:
            logger.error(f"处理消息时出错: {str(e)}")
            return "抱歉，处理您的请求时出现了错误，请稍后再试。"
    
    async def stream_response(
        self, 
        message: str, 
        history: List[Dict[str, Any]] = None,
        user_role: str = "admin",
        user_id: int = None,
        conversation_id: str = None,
        knowledge_retrieval: bool = False,
        knowledge_name: str = None
    ) -> AsyncGenerator[str, None]:
        """
        流式生成回复
        
        Args:
            message: 用户消息
            history: 对话历史
            user_role: 用户角色
            user_id: 用户ID
            conversation_id: 会话ID
            knowledge_retrieval: 是否启用知识检索
            knowledge_name: 知识库名称
            
        Yields:
            str: 回复文本片段
        """
        try:
            # 记录请求
            logger.info(f"开始流式处理消息: {message[:50]}...")
            logger.info(f"用户ID: {user_id}, 会话ID: {conversation_id}, 用户角色: {user_role}")
            logger.info(f"知识检索: {knowledge_retrieval}, 知识库名称: {knowledge_name}")
            
            rag_context = ""
            
            # 如果启用了知识检索，调用 RAG API
            if knowledge_retrieval and knowledge_name:
                try:
                    rag_result = await self._call_rag_api(message, knowledge_name)
                    rag_context = rag_result.get("context", [])
                    rag_files = rag_result.get("references", [])
                    
                    if rag_context:
                        logger.info(f"RAG 检索成功，状态: {rag_result.get('status')}, 上下文长度: {len(rag_context)}, {len(rag_result.get('references', []))} 个引用")
                    else:
                        logger.warning(f"RAG 检索返回空结果，状态: {rag_result.get('status')}")
                except Exception as e:
                    logger.error(f"RAG 检索失败: {str(e)}")
            
            # 如果提供了用户ID，使用会话管理器获取历史记录
            if user_id is not None:
                try:
                    logger.info(f"正在为用户 {user_id} 初始化会话管理器...")
                    # 确保会话管理器已初始化
                    await user_session_manager.initialize()
                    
                    logger.info(f"获取用户 {user_id} 的会话...")
                    # 获取用户会话
                    session = await user_session_manager.get_user_session(user_id, conversation_id)
                    logger.info(f"当前会话ID: {session.conversation_id}, 消息数量: {len(session.messages)}, 对话轮数: {session.get_rounds()}")
                    
                    # 如果提供了会话ID且与当前会话不匹配，创建新会话
                    if conversation_id and conversation_id != session.conversation_id:
                        logger.info(f"会话ID不匹配，创建新会话。旧会话ID: {session.conversation_id}, 新会话ID: {conversation_id}")
                        await user_session_manager.clear_session(user_id)
                        session = await user_session_manager.get_user_session(user_id, conversation_id)
                        logger.info(f"新会话已创建并保存")
                    
                    logger.info(f"添加用户消息到会话: {message[:50]}...")
                    # 添加用户消息到会话
                    await user_session_manager.add_message(user_id, session.conversation_id, "user", message)
                    
                    # 使用带摘要的上下文准备消息
                    messages = await self._prepare_messages_with_summary(user_id, message, session.conversation_id)
                    
                except Exception as e:
                    logger.error(f"使用会话管理器失败，使用传入的历史记录: {str(e)}")
                    logger.exception(e)
                    # 降级使用传入的历史记录
                    messages = self._prepare_messages(message, history)
            else:
                logger.warning("未提供用户ID，无法使用会话管理器")
                messages = self._prepare_messages(message, history)
            
            # 如果有 RAG 上下文，添加到系统提示中
            if rag_context and rag_files:
                messages[0]["content"] = f"你是一个智能助手，请根据用户的问题和以下知识库内容提供准确、有用的回答。\n\n知识库内容：\n{rag_context}\n知识库里面的图片能用尽量用上，图文并茂，尽量避免全是文字\n请基于以上知识库内容回答用户的问题。回答完问题后，请在回答尾部直接添加以下参考文献文本，不要重新格式化或修改参考文献：\n\n**参考文献：**\n{chr(10).join(rag_files)}\n\n注意：知识库内容中可能包含Markdown格式的图片链接（如![图片描述](图片URL)），请务必在回答中保留这些图片链接，不要删除或修改它们。"
            
            # 收集完整的回复文本，以便后续添加到会话
            full_response = ""
            
            try:
                # 调用 LLM API (流式)
                response = await self._call_llm_api(messages, stream=True)
                
                async for chunk in response:
                    if not chunk.choices:
                        continue
                    
                    delta = chunk.choices[0].delta
                    if delta.content:
                        full_response += delta.content
                        yield delta.content
                    
                    # 处理推理内容（如果模型支持）
                    if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                        full_response += delta.reasoning_content
                        yield delta.reasoning_content
                
                # 流式完成后，将完整回复添加到会话
                if user_id is not None and full_response:
                    try:
                        await user_session_manager.add_message(user_id, session.conversation_id, "assistant", full_response)
                    except Exception as e:
                        logger.warning(f"添加助手回复到会话失败: {str(e)}")
                        
            except Exception as api_error:
                logger.warning(f"LLM API 流式调用失败，使用模拟回复: {str(api_error)}")
                # API 调用失败时使用模拟回复
                simulation_text = random.choice(self.simulation_responses)
                
                # 模拟流式输出
                for char in simulation_text:
                    full_response += char
                    yield char
                    await asyncio.sleep(0.05)  # 模拟逐字符输出的延迟
                
                # 流式完成后，将完整回复添加到会话
                if user_id is not None and full_response:
                    try:
                        await user_session_manager.add_message(user_id, session.conversation_id, "assistant", full_response)
                    except Exception as e:
                        logger.warning(f"添加助手回复到会话失败: {str(e)}")
            
        except Exception as e:
            logger.error(f"流式处理消息时出错: {str(e)}")
            error_text = "抱歉，处理您的请求时出现了错误，请稍后再试。"
            
            # 模拟流式输出错误消息
            for char in error_text:
                yield char
                await asyncio.sleep(0.05)


# 创建聊天服务实例
chat_service = ChatService()

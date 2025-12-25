from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json
import asyncio
from app.dependencies import get_db, get_current_user
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessage, SimpleMessageRequest
from app.services.chat_service import chat_service
from app.utils.logger import logger
from app.models.user import User
from app.models.role import Role

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


def get_knowledge_name_by_role(user: User, db: Session) -> str:
    """根据用户角色获取知识库名称"""
    try:
        logger.info(f"开始获取用户角色知识库，用户ID: {user.id if user else None}")
        
        if not user:
            logger.warning("用户对象为空，返回默认知识库 knowledge_public")
            return "knowledge_public"
        
        logger.info(f"用户对象存在，用户名: {user.username}")
        
        role_ids = user.get_role_ids()
        logger.info(f"get_role_ids() 返回: {role_ids}, 类型: {type(role_ids)}")
        
        if not role_ids:
            logger.warning(f"用户 {user.username} 没有角色ID，返回默认知识库 knowledge_public")
            return "knowledge_public"
        
        logger.info(f"用户角色ID列表: {role_ids}")
        
        role = db.query(Role).filter(Role.id == role_ids[0]).first()
        logger.info(f"查询角色ID {role_ids[0]} 的结果: {role}")
        
        if role:
            logger.info(f"角色信息 - ID: {role.id}, role_code: {role.role_code}, role_name: {role.role_name}")
        else:
            logger.warning(f"未找到ID为 {role_ids[0]} 的角色")
        
        if role and role.role_code:
            knowledge_name = f"knowledge_{role.role_code}"
            logger.info(f"成功获取知识库名称: {knowledge_name}")
            return knowledge_name
        
        logger.warning(f"角色存在但role_code为空，返回默认知识库 knowledge_public")
        return "knowledge_public"
    except Exception as e:
        logger.error(f"获取用户角色知识库失败: {str(e)}", exc_info=True)
        return "knowledge_public"


@router.post("/send", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    发送聊天消息并获取回复
    
    Args:
        request: 聊天请求对象
        db: 数据库会话
        
    Returns:
        ChatResponse: 聊天回复对象
    """
    try:
        logger.info(f"收到聊天请求: {request.message[:50]}...")
        
        # 调用聊天服务生成回复
        response = await chat_service.generate_response(request)
        
        return response
        
    except Exception as e:
        logger.error(f"处理聊天请求时出错: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="处理聊天请求时出错"
        )


@router.post("/simple-message")
async def process_message(
    request: SimpleMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    处理简单的文本消息并返回回复文本
    
    Args:
        request: 包含message, history, user_role的请求体
        db: 数据库会话
        current_user: 当前用户
        
    Returns:
        dict: 包含回复文本的字典
    """
    try:
        logger.info(f"处理简单消息请求: {request.message[:50]}...")
        
        knowledge_name = request.knowledge_name
        if not knowledge_name:
            knowledge_name = get_knowledge_name_by_role(current_user, db)
        
        logger.info(f"知识检索: {request.knowledge_retrieval}, 知识库名称: {knowledge_name}")
        
        # 调用聊天服务处理消息
        response_text = await chat_service.process_message_with_history(
            request.message, request.history, request.user_role, request.user_id, request.conversation_id,
            request.knowledge_retrieval, knowledge_name
        )
        
        return {"response": response_text}
        
    except Exception as e:
        logger.error(f"处理简单消息时出错: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="处理消息时出错"
        )


@router.get("/health")
async def chat_health_check():
    """聊天服务健康检查"""
    return {"status": "healthy", "service": "chat"}


@router.post("/stream")
async def stream_message(
    request: SimpleMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    流式处理聊天消息并返回回复
    
    Args:
        request: 包含message, history, user_role的请求体
        db: 数据库会话
        current_user: 当前用户
        
    Returns:
        StreamingResponse: 流式响应
    """
    try:
        logger.info(f"处理流式消息请求: {request.message[:50]}...")
        
        knowledge_name = request.knowledge_name
        logger.info(f"请求中的 knowledge_name: {knowledge_name}")
        
        if not knowledge_name:
            logger.info("请求中未提供 knowledge_name，将根据用户角色获取")
            knowledge_name = get_knowledge_name_by_role(current_user, db)
        else:
            logger.info(f"使用请求中提供的 knowledge_name: {knowledge_name}")
        
        logger.info(f"知识检索: {request.knowledge_retrieval}, 知识库名称: {knowledge_name}")
        
        async def generate():
            try:
                async for chunk in chat_service.stream_response(
                    request.message, request.history, request.user_role, request.user_id, request.conversation_id,
                    request.knowledge_retrieval, knowledge_name
                ):
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.01)
                
                yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
            except Exception as e:
                logger.error(f"流式生成回复时出错: {str(e)}")
                yield f"data: {json.dumps({'error': '生成回复时出错'}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
        
    except Exception as e:
        logger.error(f"处理流式消息时出错: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="处理流式消息时出错"
        )
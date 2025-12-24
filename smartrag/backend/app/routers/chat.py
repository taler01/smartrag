from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json
import asyncio
from app.dependencies import get_db
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessage, SimpleMessageRequest
from app.services.chat_service import chat_service
from app.utils.logger import logger

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


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
    db: Session = Depends(get_db)
):
    """
    处理简单的文本消息并返回回复文本
    
    Args:
        request: 包含message, history, user_role的请求体
        db: 数据库会话
        
    Returns:
        dict: 包含回复文本的字典
    """
    try:
        logger.info(f"处理简单消息请求: {request.message[:50]}...")
        
        # 调用聊天服务处理消息
        response_text = await chat_service.process_message_with_history(
            request.message, request.history, request.user_role, request.user_id, request.conversation_id
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
    db: Session = Depends(get_db)
):
    """
    流式处理聊天消息并返回回复
    
    Args:
        request: 包含message, history, user_role的请求体
        db: 数据库会话
        
    Returns:
        StreamingResponse: 流式响应
    """
    try:
        logger.info(f"处理流式消息请求: {request.message[:50]}...")
        
        async def generate():
            try:
                async for chunk in chat_service.stream_response(
                    request.message, request.history, request.user_role, request.user_id, request.conversation_id
                ):
                    # 使用 Server-Sent Events 格式
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                    # 添加小延迟以确保流式输出
                    await asyncio.sleep(0.01)
                
                # 发送结束标记
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
                "X-Accel-Buffering": "no"  # 禁用Nginx缓冲
            }
        )
        
    except Exception as e:
        logger.error(f"处理流式消息时出错: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="处理流式消息时出错"
        )
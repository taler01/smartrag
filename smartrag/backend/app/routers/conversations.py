from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.conversation import Conversation, ConversationMessage
from app.schemas.conversation import (
    ConversationResponse,
    ConversationListResponse,
    CreateConversationRequest,
    UpdateConversationRequest,
    ConversationDetailResponse,
    ConversationMessageResponse,
    ConversationMessageListResponse,
    GenerateTitleRequest,
    GenerateTitleResponse,
    CreateConversationMessageRequest
)
from app.services.conversation_service import ConversationService
from app.services.summary_service import summary_service
from app.services.session_manager import user_session_manager
from app.utils.logger import logger
from datetime import datetime

router = APIRouter(prefix="/api/v1/conversations", tags=["会话管理"])


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: CreateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建新会话
    
    Args:
        request: 创建会话请求
        current_user: 当前用户
        db: 数据库会话
        
    Returns:
        ConversationResponse: 创建的会话信息
    """
    try:
        conversation_service = ConversationService(db)
        
        # 生成会话ID
        conversation_id = request.conversation_id or f"conv_{current_user.id}_{uuid.uuid4().hex[:16]}"
        
        # 创建会话
        conversation = conversation_service.create_conversation(
            conversation_id=conversation_id,
            user_id=current_user.id,
            title=request.title
        )
        
        logger.info(f"用户 {current_user.id} 创建新会话: {conversation_id}")
        
        return ConversationResponse.model_validate(conversation)
        
    except Exception as e:
        logger.error(f"创建会话失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建会话失败"
        )


@router.get("", response_model=ConversationListResponse)
async def get_conversations(
    skip: int = 0,
    limit: int = 20,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取用户的会话列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        is_active: 是否只返回活跃会话
        current_user: 当前用户
        db: 数据库会话
        
    Returns:
        ConversationListResponse: 会话列表
    """
    try:
        conversation_service = ConversationService(db)
        
        # 获取会话列表
        conversations, total = conversation_service.get_user_conversations(
            user_id=current_user.id,
            skip=skip,
            limit=limit,
            is_active=is_active
        )
        
        logger.info(f"用户 {current_user.id} 获取会话列表，共 {total} 个会话")
        
        return ConversationListResponse(
            conversations=[ConversationResponse.model_validate(conv) for conv in conversations],
            total=total
        )
        
    except Exception as e:
        logger.error(f"获取会话列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取会话列表失败"
        )


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取会话详情
    
    Args:
        conversation_id: 会话ID
        current_user: 当前用户
        db: 数据库会话
        
    Returns:
        ConversationDetailResponse: 会话详情
    """
    try:
        conversation_service = ConversationService(db)
        
        # 获取会话
        conversation = conversation_service.get_conversation(conversation_id)
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在"
            )
        
        # 检查权限
        if conversation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该会话"
            )
        
        # 获取会话消息
        messages, _ = conversation_service.get_conversation_messages(conversation_id)
        
        logger.info(f"用户 {current_user.id} 获取会话详情: {conversation_id}")
        
        return ConversationDetailResponse(
            conversation=ConversationResponse.model_validate(conversation),
            messages=[ConversationMessageResponse.model_validate(msg) for msg in messages]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取会话详情失败"
        )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除会话
    
    Args:
        conversation_id: 会话ID
        current_user: 当前用户
        db: 数据库会话
    """
    try:
        conversation_service = ConversationService(db)
        
        # 获取会话
        conversation = conversation_service.get_conversation(conversation_id)
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在"
            )
        
        # 检查权限
        if conversation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权删除该会话"
            )
        
        # 删除会话
        conversation_service.delete_conversation(conversation_id)
        
        # 清空Redis中的会话数据
        await user_session_manager.clear_session(current_user.id)
        
        logger.info(f"用户 {current_user.id} 删除会话: {conversation_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除会话失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除会话失败"
        )


@router.patch("/{conversation_id}/title", response_model=ConversationResponse)
async def update_conversation_title(
    conversation_id: str,
    request: UpdateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新会话标题
    
    Args:
        conversation_id: 会话ID
        request: 更新请求
        current_user: 当前用户
        db: 数据库会话
        
    Returns:
        ConversationResponse: 更新后的会话信息
    """
    try:
        if not request.title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="标题不能为空"
            )
        
        conversation_service = ConversationService(db)
        
        # 获取会话
        conversation = conversation_service.get_conversation(conversation_id)
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在"
            )
        
        # 检查权限
        if conversation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改该会话"
            )
        
        # 更新标题
        updated_conversation = conversation_service.update_conversation_title(
            conversation_id=conversation_id,
            title=request.title
        )
        
        if not updated_conversation:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="更新会话标题失败"
            )
        
        logger.info(f"用户 {current_user.id} 更新会话标题: {conversation_id} -> {request.title}")
        
        return ConversationResponse.model_validate(updated_conversation)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新会话标题失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新会话标题失败"
        )


@router.post("/generate-title", response_model=GenerateTitleResponse)
async def generate_conversation_title(
    request: GenerateTitleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    为会话生成标题
    
    Args:
        request: 生成标题请求
        current_user: 当前用户
        db: 数据库会话
        
    Returns:
        GenerateTitleResponse: 生成的标题
    """
    try:
        conversation_service = ConversationService(db)
        
        # 获取会话
        conversation = conversation_service.get_conversation(request.conversation_id)
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在"
            )
        
        # 检查权限
        if conversation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该会话"
            )
        
        # 获取会话消息
        messages, _ = conversation_service.get_conversation_messages(request.conversation_id)
        
        if not messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="会话没有消息，无法生成标题"
            )
        
        # 构建对话历史
        conversation_history = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        # 生成标题
        title = await summary_service.generate_title(conversation_history)
        
        # 更新会话标题
        updated_conversation = conversation_service.update_conversation_title(
            conversation_id=request.conversation_id,
            title=title
        )
        
        logger.info(f"用户 {current_user.id} 为会话 {request.conversation_id} 生成标题: {title}")
        
        return GenerateTitleResponse(
            conversation_id=request.conversation_id,
            title=title
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成会话标题失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="生成会话标题失败"
        )


@router.get("/{conversation_id}/messages", response_model=ConversationMessageListResponse)
async def get_conversation_messages(
    conversation_id: str,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取会话消息列表
    
    Args:
        conversation_id: 会话ID
        skip: 跳过的记录数
        limit: 返回的最大记录数
        current_user: 当前用户
        db: 数据库会话
        
    Returns:
        ConversationMessageListResponse: 消息列表和总数
    """
    try:
        conversation_service = ConversationService(db)
        
        # 获取会话
        conversation = conversation_service.get_conversation(conversation_id)
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在"
            )
        
        # 检查权限
        if conversation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该会话"
            )
        
        # 获取消息
        messages, total = conversation_service.get_conversation_messages(
            conversation_id=conversation_id,
            skip=skip,
            limit=limit
        )
        
        logger.info(f"用户 {current_user.id} 获取会话 {conversation_id} 的消息列表")
        
        return ConversationMessageListResponse(
            messages=[ConversationMessageResponse.model_validate(msg) for msg in messages],
            total=total
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话消息列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取会话消息列表失败"
        )


@router.post("/{conversation_id}/messages", response_model=ConversationMessageResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation_message(
    conversation_id: str,
    request: CreateConversationMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    保存会话消息
    
    Args:
        conversation_id: 会话ID
        request: 消息请求
        current_user: 当前用户
        db: 数据库会话
        
    Returns:
        ConversationMessageResponse: 保存的消息信息
    """
    try:
        conversation_service = ConversationService(db)
        
        # 获取会话
        conversation = conversation_service.get_conversation(conversation_id)
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在"
            )
        
        # 检查权限
        if conversation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该会话"
            )
        
        # 生成消息ID
        message_id = f"msg_{uuid.uuid4().hex[:16]}"
        
        # 保存消息
        message = conversation_service.save_message(
            conversation_id=conversation_id,
            message_id=message_id,
            role=request.role,
            content=request.content,
            tokens=request.tokens,
            importance=request.importance
        )
        
        if not message:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="保存消息失败"
            )
        
        # 更新会话统计信息
        conversation_service.update_conversation_stats(
            conversation_id=conversation_id,
            message_count=conversation.message_count + 1,
            total_tokens=conversation.total_tokens + request.tokens
        )
        
        logger.info(f"用户 {current_user.id} 保存消息到会话 {conversation_id}")
        
        return ConversationMessageResponse.model_validate(message)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"保存会话消息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="保存会话消息失败"
        )

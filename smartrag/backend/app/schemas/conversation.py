from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ConversationMessageResponse(BaseModel):
    id: int
    message_id: str
    role: str
    content: str
    tokens: int
    importance: float
    created_at: datetime
    
    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    user_id: int
    title: str
    summary: Optional[str]
    message_count: int
    total_tokens: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int


class CreateConversationRequest(BaseModel):
    conversation_id: Optional[str] = None
    title: Optional[str] = "新对话"


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None


class ConversationDetailResponse(BaseModel):
    conversation: ConversationResponse
    messages: List[ConversationMessageResponse]


class GenerateTitleRequest(BaseModel):
    conversation_id: str


class GenerateTitleResponse(BaseModel):
    conversation_id: str
    title: str


class ConversationMessageListResponse(BaseModel):
    messages: List[ConversationMessageResponse]
    total: int


class CreateConversationMessageRequest(BaseModel):
    role: str
    content: str
    tokens: Optional[int] = 0
    importance: Optional[float] = 1.0

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ChatMessage(BaseModel):
    id: str
    role: str  # 'user' or 'model'
    text: str
    timestamp: datetime


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    history: Optional[List[dict]] = []
    user_role: Optional[str] = "admin"


class SimpleMessageRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []
    user_role: Optional[str] = "admin"
    user_id: Optional[int] = None
    conversation_id: Optional[str] = None
    knowledge_retrieval: Optional[bool] = False
    knowledge_name: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: str
    timestamp: datetime
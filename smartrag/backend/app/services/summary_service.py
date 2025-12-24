"""
摘要生成服务 - 用于生成对话摘要
"""
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
from app.config import settings
from app.utils.logger import logger


class SummaryService:
    """摘要生成服务"""
    
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.siliconflow_api_key,
            base_url=settings.siliconflow_base_url
        )
        self.model = settings.siliconflow_model
        logger.info(f"SummaryService 初始化完成，使用模型: {self.model}")
    
    async def generate_summary(
        self,
        conversation_history: List[Dict[str, str]],
        old_summary: Optional[str] = None
    ) -> str:
        """
        生成对话摘要
        
        Args:
            conversation_history: 对话历史记录
            old_summary: 旧的摘要（如果有）
            
        Returns:
            str: 生成的摘要
        """
        try:
            # 构建对话文本
            conversation_text = self._format_conversation(conversation_history)
            
            # 构建提示词
            if old_summary:
                prompt = f"""你是一个专业的对话摘要生成助手。请根据以下信息生成一个简洁、准确的对话摘要，重点是不能遗漏关键信息。

【之前的对话摘要】
{old_summary}

【新增的对话内容】
{conversation_text}

请基于之前的摘要和新增的对话内容，生成一个更新后的摘要。摘要应该：
1. 保留之前摘要中的关键信息
2. 融合新增对话中的重要内容
3. 简洁明了，不超过200字
4. 突出对话的主题和关键信息

请直接输出摘要内容，不要包含其他说明文字。"""
            else:
                prompt = f"""你是一个专业的对话摘要生成助手。请根据以下对话内容生成一个简洁、准确的摘要。

【对话内容】
{conversation_text}

摘要应该：
1. 简洁明了，不超过200字
2. 突出对话的主题和关键信息
3. 包含用户的主要问题和助手的核心回答

请直接输出摘要内容，不要包含其他说明文字。"""
            
            # 调用 LLM API 生成摘要
            messages = [
                {
                    "role": "system",
                    "content": "你是一个专业的对话摘要生成助手，擅长提取对话的核心信息和关键内容。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
            
            logger.info(f"开始生成摘要，对话轮数: {len(conversation_history) // 2}, 是否有旧摘要: {bool(old_summary)}")
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3,  # 降低温度以获得更稳定的摘要
                max_tokens=500
            )
            
            summary = response.choices[0].message.content.strip()
            logger.info(f"摘要生成成功: {summary[:100]}...")
            
            return summary
            
        except Exception as e:
            logger.error(f"生成摘要失败: {e}")
            # 返回默认摘要
            if old_summary:
                return old_summary
            return "对话摘要生成失败"
    
    def _format_conversation(self, conversation_history: List[Dict[str, str]]) -> str:
        """
        格式化对话历史为文本
        
        Args:
            conversation_history: 对话历史记录
            
        Returns:
            str: 格式化后的对话文本
        """
        formatted_lines = []
        
        for msg in conversation_history:
            role = msg.get("role", "")
            content = msg.get("content", "")
            
            if role == "user":
                formatted_lines.append(f"用户: {content}")
            elif role in ["assistant", "model"]:
                formatted_lines.append(f"助手: {content}")
        
        return "\n".join(formatted_lines)
    
    async def generate_title(self, first_message: str) -> str:
        """
        根据第一条用户消息生成会话标题
        
        Args:
            first_message: 用户的第一条消息
            
        Returns:
            str: 生成的标题
        """
        try:
            messages = [
                {
                    "role": "system",
                    "content": "你是一个专业的标题生成助手，擅长根据用户的问题生成简洁、准确的对话标题。"
                },
                {
                    "role": "user",
                    "content": f"""请根据以下用户的问题，生成一个简洁的对话标题（不超过20个字）。

用户问题: {first_message}

请直接输出标题，不要包含其他说明文字。"""
                }
            ]
            
            logger.info(f"开始生成标题，用户消息: {first_message[:50]}...")
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=50
            )
            
            title = response.choices[0].message.content.strip()
            # 限制标题长度
            if len(title) > 20:
                title = title[:20]
            
            logger.info(f"标题生成成功: {title}")
            return title
            
        except Exception as e:
            logger.error(f"生成标题失败: {e}")
            return "新对话"


# 创建摘要服务实例
summary_service = SummaryService()

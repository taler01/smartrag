// 临时的geminiService文件，用于解决导入错误
// 实际功能需要根据项目需求实现

export const generateRAGResponse = async (
  query: string, 
  documents: any[] = [], 
  history: any[] = [], 
  userRole: string = '',
  userId: string = '',
  conversationId: string = ''
): Promise<string> => {
  // 临时实现，返回一个简单的响应
  console.log('generateRAGResponse called with:', { query, documents, history, userRole, userId, conversationId });
  
  // 始终尝试调用后端API，即使userId或conversationId为空
  try {
    const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://10.168.27.191:9090'}/api/v1/chat/simple-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: query,
        history: history,
        user_role: userRole,
        user_id: userId || undefined, // 允许为空
        conversation_id: conversationId || undefined // 允许为空
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '抱歉，无法获取回复。';
  } catch (error) {
    console.error('Error calling backend API:', error);
    // 如果API调用失败，使用下面的模拟响应
  }
  
  // 模拟API调用延迟
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 构建包含历史消息的上下文
  let contextMessage = '';
  if (history.length > 0) {
    contextMessage = `\n\n历史对话记录:\n${history.map((msg, index) => 
      `${index + 1}. ${msg.role === 'user' ? '用户' : '助手'}: ${msg.text}`
    ).join('\n')}\n`;
  }
  
  // 根据用户角色调整回复风格
  let rolePrefix = '';
  if (userRole) {
    const roleResponses: Record<string, string> = {
      'ADMIN': '作为系统管理员，我为您解答：',
      'R_AND_D': '从研发角度分析，这个问题：',
      'AFTER_SALES': '从售后支持角度，我建议：',
      'PRE_SALES': '从售前咨询角度，我为您介绍：',
      'QA': '从测试角度，这个问题：',
      'OPS': '从运维角度，我建议：'
    };
    rolePrefix = roleResponses[userRole] || '';
  }
  
  return `${rolePrefix}这是对查询"${query}"的响应。${contextMessage ? `我已参考了历史对话记录。` : ''}实际项目需要集成真实的Gemini API。`;
};
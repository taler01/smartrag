// 临时的geminiService文件，用于解决导入错误
// 实际功能需要根据项目需求实现

export const generateRAGResponse = async (
  query: string, 
  documents: any[] = [], 
  history: any[] = [], 
  userRole: string = '',
  userId: string = '',
  conversationId: string = '',
  knowledgeRetrieval: boolean = false,
  knowledgeName: string = ''
): Promise<{ response: string; urlMapping?: Record<string, string> }> => {
  console.log('generateRAGResponse called with:', { query, documents, history, userRole, userId, conversationId, knowledgeRetrieval, knowledgeName });
  
  const requestBody: any = {
    message: query,
    history: history,
    user_role: userRole,
    user_id: userId || undefined,
    conversation_id: conversationId || undefined,
    knowledge_retrieval: knowledgeRetrieval,
    knowledge_name: knowledgeName || undefined
  };
  
  try {
    // 获取认证令牌
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('用户未登录，请重新登录');
    }

    const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://10.168.27.191:9090'}/api/v1/chat/simple-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // 处理URL映射表
    let processedResponse = data.response || '抱歉，无法获取回复。';
    const urlMapping = data.url_mapping || {};
    
    // 替换占位符为原始URL
    Object.entries(urlMapping).forEach(([placeholder, url]) => {
      processedResponse = processedResponse.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        url
      );
    });
    
    return { response: processedResponse, urlMapping };
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
  
  return { response: `${rolePrefix}这是对查询"${query}"的响应。${contextMessage ? `我已参考了历史对话记录。` : ''}实际项目需要集成真实的Gemini API。` };
};
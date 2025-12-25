// API服务层，用于与后端通信
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://10.168.27.191:9090';

function handleAuthError(response: Response) {
  if (response.status === 401) {
    console.error('用户认证失败，token可能已过期');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('认证失败，请重新登录');
  }
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    role_ids: number[];
  };
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  message?: string;
}

export interface SendVerificationCodeRequest {
  email: string;
}

export interface SendVerificationCodeResponse {
  success: boolean;
  message?: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  verification_code: string;
  role_ids: number[];
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
}

export interface SendResetCodeRequest {
  email: string;
}

export interface SendResetCodeResponse {
  success: boolean;
  message?: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message?: string;
}

export interface VerifyCodeDetailsRequest {
  email: string;
  code: string;
  code_type?: string;
}

export interface VerifyCodeDetailsResponse {
  valid: boolean;
  message?: string;
  error_type?: string;
  remaining_attempts?: number;
}

export interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GetRolesResponse {
  id: number;
  role_code: string;
  role_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 登录API
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const responseData = await response.json();

    if (!response.ok) {
      // 从后端获取具体的错误信息
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error) {
    console.error('Login error:', error);
    
    // 根据错误类型返回具体的错误信息
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }
    
    return {
      success: false,
      message: '登录失败，请检查网络连接或联系管理员',
    };
  }
};

// 发送验证码API
export const sendVerificationCode = async (request: SendVerificationCodeRequest): Promise<SendVerificationCodeResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/send-verification-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const responseData = await response.json();

    // 添加调试日志
    console.log('原始API响应数据:', responseData);

    if (!response.ok) {
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error) {
    console.error('Send verification code error:', error);
    
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }
    
    return {
      success: false,
      message: '发送验证码失败，请检查网络连接或联系管理员',
    };
  }
};

// 注册API
export const register = async (request: RegisterRequest): Promise<RegisterResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error) {
    console.error('Register error:', error);
    
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }
    
    return {
      success: false,
      message: '注册失败，请检查网络连接或联系管理员',
    };
  }
};

// 发送密码重置验证码API
export const sendResetCode = async (request: SendResetCodeRequest): Promise<SendResetCodeResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/send-reset-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error) {
    console.error('Send reset code error:', error);
    
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }
    
    return {
      success: false,
      message: '发送重置验证码失败，请检查网络连接或联系管理员',
    };
  }
};

// 重置密码API
export const resetPassword = async (request: ResetPasswordRequest): Promise<ResetPasswordResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error) {
    console.error('Reset password error:', error);
    
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }
    
    return {
      success: false,
      message: '重置密码失败，请检查网络连接或联系管理员',
    };
  }
};

// 验证验证码（详细信息）API
export const verifyCodeDetails = async (request: VerifyCodeDetailsRequest): Promise<VerifyCodeDetailsResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify-code-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error) {
    console.error('Verify code details error:', error);
    
    if (error instanceof Error) {
      return {
        valid: false,
        message: error.message,
      };
    }
    
    return {
      valid: false,
      message: '验证验证码失败，请检查网络连接或联系管理员',
    };
  }
};

// 获取角色列表API
export const getRoles = async (token: string): Promise<GetRolesResponse[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/roles`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      handleAuthError(response);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get roles error:', error);
    throw error;
  }
};

// 获取公共角色列表API（用于注册）
export const getPublicRoles = async (): Promise<GetRolesResponse[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/public/roles`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get public roles error:', error);
    throw error;
  }
};

// 通用API请求函数
export const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('用户认证失败，token可能已过期');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('认证失败，请重新登录');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

// 获取当前用户信息API
export const getCurrentUserInfo = async (token: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      handleAuthError(response);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get current user info error:', error);
    throw error;
  }
};

// 获取用户统计信息API
export const getUserStats = async (token: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      handleAuthError(response);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get user stats error:', error);
    throw error;
  }
};

// 聊天消息请求接口
export interface ChatMessageRequest {
  message: string;
  history?: Array<{role: string; parts: Array<{text: string}>}>;
  user_role?: string;
  user_id?: string;
  conversation_id?: string;
  knowledge_retrieval?: boolean;
  knowledge_name?: string;
}

// 文档上传请求接口
export interface DocumentUploadRequest {
  file: File;
  type: 'public' | 'personal';
  title?: string;
  description?: string;
  permissions?: number[]; // 角色ID列表
}

// 文档上传响应接口
export interface DocumentUploadResponse {
  success: boolean;
  message: string;
  document_id: number;
  document_type: 'public' | 'personal';
  filename: string;
  file_path: string;
  file_size: number; // 添加文件大小字段
  permissions?: {
    roles: number[];
  };
}

// 文档信息接口
export interface DocumentInfo {
  id: number;
  filename: string;
  title?: string;
  description?: string;
  file_path: string;
  file_size: number;
  file_type: string;
  file_hash: string;
  uploader_id?: number;
  owner_id?: number;
  upload_time: string;
  is_active: boolean;
  is_processed: boolean;
  created_at: string;
  updated_at: string;
  permissions?: number[]; // 角色ID列表
}

// 文档上传API
export const uploadDocument = async (
  formData: FormData,
  token: string
): Promise<DocumentUploadResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // 不设置Content-Type，让浏览器自动设置multipart/form-data边界
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      handleAuthError(response);
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error) {
    console.error('Upload document error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('文档上传失败，请检查网络连接或联系管理员');
  }
};

// 获取公共文档列表API
export const getPublicDocuments = async (
  token: string,
  skip: number = 0,
  limit: number = 100
): Promise<DocumentInfo[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/documents/public?skip=${skip}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      handleAuthError(response);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get public documents error:', error);
    throw error;
  }
};

// 获取个人文档列表API
export const getPersonalDocuments = async (
  token: string,
  skip: number = 0,
  limit: number = 100
): Promise<DocumentInfo[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/documents/personal?skip=${skip}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      handleAuthError(response);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get personal documents error:', error);
    throw error;
  }
};

// 删除公共文档API
export const deletePublicDocument = async (
  documentId: number,
  token: string
): Promise<{message: string}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/documents/public/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const responseData = await response.json();
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Delete public document error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('删除公共文档失败，请检查网络连接或联系管理员');
  }
};

// 删除个人文档API
export const deletePersonalDocument = async (
  documentId: number,
  token: string
): Promise<{message: string}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/documents/personal/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const responseData = await response.json();
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Delete personal document error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('删除个人文档失败，请检查网络连接或联系管理员');
  }
};

// 文档内容响应接口
export interface DocumentContentResponse {
  document_id: number;
  document_type: 'public' | 'personal';
  filename: string;
  file_size: number;
  file_type: string;
  content: string;
  lines: string[];
  line_count: number;
  page?: number; // 新增：当前页码
  total_pages?: number; // 新增：总页数（仅PDF）
}

// 获取文档内容API
export const getDocumentContent = async (
  documentType: 'public' | 'personal',
  documentId: number,
  token: string,
  page?: number // 新增：分页参数
): Promise<DocumentContentResponse> => {
  try {
    const url = page ? 
      `${API_BASE_URL}/api/documents/${documentType}/${documentId}/content?page=${page}` :
      `${API_BASE_URL}/api/documents/${documentType}/${documentId}/content`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const responseData = await response.json();
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Get document content error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('获取文档内容失败，请检查网络连接或联系管理员');
  }
};

// 获取PDF单页内容API（优化性能）
export const getPDFPageContent = async (
  documentType: 'public' | 'personal',
  documentId: number,
  page: number,
  token: string
): Promise<DocumentContentResponse> => {
  return getDocumentContent(documentType, documentId, token, page);
};

// 流式聊天API
export const streamChatMessage = async (
  request: ChatMessageRequest,
  onChunk: (chunk: string) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
  options: {
    maxRetries?: number;
    retryDelay?: number;
  } = {}
) => {
  const { maxRetries = 2, retryDelay = 1000 } = options;
  let retryCount = 0;

  // 获取认证令牌
  const token = localStorage.getItem('token');
  if (!token) {
    onError(new Error('用户未登录，请重新登录'));
    return;
  }

  const attemptStream = async (): Promise<void> => {
    try {
      console.log('Starting stream request to:', `${API_BASE_URL}/api/v1/chat/stream`);
      console.log('Request payload:', request);
      
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain', // 明确接受SSE格式
          'Cache-Control': 'no-cache',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      console.log('Stream response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      console.log('Starting to read stream...');
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream reading completed');
            break;
          }

          // 解码接收到的数据
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // 按行分割处理
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个可能不完整的行

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            // 处理SSE格式的数据行
            if (line.startsWith('data: ')) {
              try {
                const dataStr = line.slice(6).trim(); // 移除 'data: ' 前缀并去除空格
                if (dataStr) {
                  const parsed = JSON.parse(dataStr);
                  
                  if (parsed.done) {
                    console.log('Stream completed with done flag');
                    onComplete();
                    return;
                  }
                  
                  if (parsed.error) {
                    console.error('Stream error:', parsed.error);
                    onError(new Error(parsed.error));
                    return;
                  }
                  
                  if (parsed.content) {
                    onChunk(parsed.content);
                  }
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', line, parseError);
              }
            }
          }
        }
        
        // 处理流结束后的任何剩余数据
        if (buffer.trim()) {
          console.log('Processing remaining buffer:', buffer);
          if (buffer.startsWith('data: ')) {
            try {
              const dataStr = buffer.slice(6).trim();
              if (dataStr) {
                const parsed = JSON.parse(dataStr);
                
                if (parsed.done) {
                  onComplete();
                } else if (parsed.error) {
                  onError(new Error(parsed.error));
                } else if (parsed.content) {
                  onChunk(parsed.content);
                  onComplete();
                }
              }
            } catch (parseError) {
              console.warn('Failed to parse final SSE data:', parseError);
            }
          }
        }
        
        console.log('Calling onComplete()');
        onComplete();
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Stream error:', error);
      
      // 重试逻辑
      if (retryCount < maxRetries && error instanceof Error) {
        retryCount++;
        console.log(`Retrying stream request (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return attemptStream();
      }
      
      onError(error instanceof Error ? error : new Error('Unknown stream error'));
    }
  };

  return attemptStream();
};

// 会话管理相关接口
export interface Conversation {
  id: string;
  user_id: number;
  title: string;
  summary?: string;
  is_active: boolean;
  message_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tokens: number;
  created_at: string;
}

export interface CreateConversationRequest {
  conversation_id?: string;
  title?: string;
}

export interface UpdateConversationRequest {
  title: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
}

export interface ConversationDetailResponse {
  conversation: Conversation;
  messages: ConversationMessage[];
}

// 创建会话API
export const createConversation = async (
  request: CreateConversationRequest,
  token: string
): Promise<Conversation> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const responseData = await response.json();
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Create conversation error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('创建会话失败，请检查网络连接或联系管理员');
  }
};

// 获取会话列表API
export const getConversations = async (
  token: string,
  skip: number = 0,
  limit: number = 20,
  is_active?: boolean
): Promise<ConversationListResponse> => {
  try {
    let url = `${API_BASE_URL}/api/v1/conversations?skip=${skip}&limit=${limit}`;
    if (is_active !== undefined) {
      url += `&is_active=${is_active}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get conversations error:', error);
    throw error;
  }
};

// 获取会话详情API
export const getConversation = async (
  conversationId: string,
  token: string
): Promise<ConversationDetailResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/conversations/${conversationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const responseData = await response.json();
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Get conversation error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('获取会话详情失败，请检查网络连接或联系管理员');
  }
};

// 删除会话API
export const deleteConversation = async (
  conversationId: string,
  token: string
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const responseData = await response.json();
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Delete conversation error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('删除会话失败，请检查网络连接或联系管理员');
  }
};

// 更新会话标题API
export const updateConversationTitle = async (
  conversationId: string,
  request: UpdateConversationRequest,
  token: string
): Promise<Conversation> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/conversations/${conversationId}/title`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const responseData = await response.json();
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Update conversation title error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('更新会话标题失败，请检查网络连接或联系管理员');
  }
};

// 获取会话消息API
export const getConversationMessages = async (
  conversationId: string,
  skip: number = 0,
  limit: number = 50,
  token: string
): Promise<{messages: ConversationMessage[], total: number}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/conversations/${conversationId}/messages?skip=${skip}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const responseData = await response.json();
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Get conversation messages error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('获取会话消息失败，请检查网络连接或联系管理员');
  }
};

// 保存会话消息API
export const saveConversationMessage = async (
  conversationId: string,
  message: {
    id: string;
    role: 'user' | 'model' | 'assistant';
    text: string;
    timestamp: Date;
  },
  token: string
): Promise<ConversationMessage> => {
  try {
    const content = message.text || '';
    
    if (!content.trim()) {
      console.warn('跳过空消息:', message);
      throw new Error('消息内容不能为空');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: message.role === 'model' ? 'assistant' : message.role,
        content: content.trim()
      }),
    });

    if (!response.ok) {
      const responseData = await response.json();
      const errorMessage = responseData.detail || responseData.message || `HTTP错误! 状态码: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Save conversation message error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('保存会话消息失败，请检查网络连接或联系管理员');
  }
};

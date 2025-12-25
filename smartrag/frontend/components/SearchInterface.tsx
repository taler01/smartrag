import React, { useState, useRef, useEffect } from 'react';
import { generateRAGResponse } from '../services/geminiService';
import { Document, ChatMessage, User, ROLE_LABELS, MCPService, MCPServiceStatus, KnowledgeRetrievalConfig } from '../types';
import { useStreamingChat } from '../hooks/useStreamingChat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import MCPServiceManager from './MCPServiceManager';
import HotQuestionsList from './HotQuestionsList';
interface SearchInterfaceProps {
  documents: Document[];
  user: User;
  currentConversationId: string | null;
  conversations: {[id: string]: {title: string, messageCount: number, timestamp: Date}};
  messages: {[conversationId: string]: ChatMessage[]};
  onSaveConversation: (id: string, title: string, messages: ChatMessage[]) => void;
  onLoadConversation: (id: string, skip?: number, limit?: number) => void;
  onStartNewConversation: () => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  showHotQuestions?: boolean;
  onResetShowHotQuestions?: () => void;
}

const SearchInterface: React.FC<SearchInterfaceProps> = ({ 
  documents, 
  user, 
  currentConversationId, 
  conversations, 
  messages: externalMessages,
  onSaveConversation, 
  onLoadConversation, 
  onStartNewConversation, 
  onDeleteConversation,
  showHotQuestions,
  onResetShowHotQuestions
}) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [shouldSendMessage, setShouldSendMessage] = useState(false);

  // 知识检索配置状态
  const [knowledgeConfig, setKnowledgeConfig] = useState<KnowledgeRetrievalConfig>({
    enabled: true,
    maxDocuments: 5,
    similarityThreshold: 0.7
  });

  // 根据用户角色动态设置知识库名称
  const getDefaultKnowledgeBase = (): string => {
    if (user.roles && user.roles.length > 0) {
      const roleCode = user.roles[0].role_code;
      return `knowledge_${roleCode}`;
    }
    return 'knowledge_public';
  };

  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<string>(getDefaultKnowledgeBase());

  // MCP服务相关状态
  const [mcpServices, setMcpServices] = useState<MCPService[]>([]);
  const [mcpServiceManagerOpen, setMcpServiceManagerOpen] = useState(false);
  const [mcpServiceStatus, setMcpServiceStatus] = useState<MCPServiceStatus | null>(null);
  
  // 热门问题列表显示状态
  const [showHotQuestionsList, setShowHotQuestionsList] = useState(false);
  
  // 流式聊天功能
  const [useStreaming, setUseStreaming] = useState(true); // 默认启用流式
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  
  const { 
    isStreaming, 
    currentMessage, 
    error: streamingError, 
    startStreaming, 
    stopStreaming, 
    resetMessage 
  } = useStreamingChat({
    onMessageComplete: (message) => {
      // 流式消息完成后，添加到消息列表并保存
      setMessages(prev => {
        const updatedMessages = [...prev, message];
        // 保存对话
        if (currentConversationId) {
          const firstUserMessage = updatedMessages.find(msg => msg.role === 'user');
          const title = firstUserMessage ? firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '') : '新对话';
          onSaveConversation(currentConversationId, title, updatedMessages);
        }
        return updatedMessages;
      });
      setStreamingMessage(null);
      resetMessage();
      setIsProcessing(false); // 确保处理状态结束
    },
    onError: (error) => {
      console.error('Streaming error:', error);
      // 如果流式失败，回退到传统方式
      setUseStreaming(false);
      setStreamingMessage(null);
      setIsProcessing(false); // 确保处理状态结束
      // 显示错误消息
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `流式输出失败：${error.message}。已切换到非流式模式，请重试。`,
        timestamp: new Date(Date.now() + 1000)
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  });
  
  // 监听流式消息内容的变化，实时更新 streamingMessage
  useEffect(() => {
    if (isStreaming && currentMessage && streamingMessage) {
      // 只有在流式消息已存在时才更新其内容
      setStreamingMessage(prev => prev ? { ...prev, text: currentMessage } : prev);
    }
  }, [currentMessage, isStreaming, streamingMessage]);
  
  // 流式输出过程中的实时滚动
  useEffect(() => {
    if (isStreaming && currentMessage && !userScrolled) {
      // 使用更短的延迟，提高滚动的实时性
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 30);
      
      return () => clearTimeout(timer);
    }
  }, [currentMessage, isStreaming, userScrolled]);

  useEffect(() => {
    if (currentConversationId && externalMessages[currentConversationId]) {
      setMessages(externalMessages[currentConversationId]);
      setIsInitialLoad(true);
      setUserScrolled(false);
    } else {
      setMessages([]);
    }
  }, [currentConversationId, externalMessages]);

  // 监听用户信息变化，自动更新知识库名称
  useEffect(() => {
    const defaultKnowledgeBase = getDefaultKnowledgeBase();
    setSelectedKnowledgeBase(defaultKnowledgeBase);
    console.log('用户信息更新，知识库设置为:', defaultKnowledgeBase);
  }, [user]);

  const scrollToBottom = (force = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 检测用户是否手动滚动，只用于显示/隐藏按钮
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px阈值
      setUserScrolled(!isAtBottom);
    }
  };

  // 自动滚动到底部的效果
  useEffect(() => {
    // 只有在用户发送新消息后（消息列表长度变化）且用户没有手动滚动离开底部时，才自动滚动
    if (!userScrolled && messages.length > 0) {
      // 延迟一点时间，确保DOM已更新
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [messages.length, userScrolled]); // 只依赖消息长度变化，而不是整个消息数组
  
  // 流式消息更新时自动滚动到底部
  useEffect(() => {
    // 如果正在流式输出且有消息内容，且用户没有手动滚动离开底部，则自动滚动
    if (!userScrolled && isStreaming && (streamingMessage?.text.length > 0 || currentMessage)) {
      // 延迟一点时间，确保DOM已更新
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 50); // 减少延迟时间以提高响应性
      
      return () => clearTimeout(timer);
    }
  }, [streamingMessage?.text, currentMessage, userScrolled, isStreaming]); // 添加currentMessage依赖
  
  // 初始加载后，设置标志为false
  useEffect(() => {
    if (isInitialLoad) {
      // 延迟一点时间，确保DOM已渲染
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 2000); // 进一步增加延迟时间
      
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad]);

  // 处理待发送的消息
  useEffect(() => {
    if (currentConversationId && pendingMessage) {
      setQuery(pendingMessage);
      setPendingMessage(null);
      setShouldSendMessage(true);
    }
  }, [currentConversationId, pendingMessage]);

  // 当设置好待发送消息后，自动发送
  useEffect(() => {
    if (shouldSendMessage && query.trim() && !isProcessing && currentConversationId) {
      setShouldSendMessage(false);
      // 直接调用handleSearch逻辑，避免触发表单提交事件
      processMessage(query);
    }
  }, [shouldSendMessage, query, isProcessing, currentConversationId]);
  
  // 监听显示热门问题列表的请求
  useEffect(() => {
    if (showHotQuestions) {
      setShowHotQuestionsList(true);
    }
  }, [showHotQuestions]);
  
  // 重置热门问题列表状态
  useEffect(() => {
    if (!showHotQuestions && showHotQuestionsList) {
      setShowHotQuestionsList(false);
    }
  }, [showHotQuestions, showHotQuestionsList]);

  // 提取消息处理逻辑
  const processMessage = async (messageText: string) => {
    if (!messageText.trim() || isProcessing || !currentConversationId) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    setQuery('');
    
    // 发送消息后立即滚动到底部
    setTimeout(() => {
      scrollToBottom();
    }, 50);

    try {
      // Prepare history for API
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      // 根据设置选择使用流式或传统方式
      if (useStreaming) {
        // 创建一个临时的流式消息对象
        const tempStreamingMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: '',
          timestamp: new Date()
        };
        
        setStreamingMessage(tempStreamingMsg);
        
        // 立即滚动到底部，确保用户能看到即将开始的流式输出
        setTimeout(() => {
          scrollToBottom();
        }, 50);
        
        // 开始流式请求
        await startStreaming({
          message: userMsg.text,
          history: history,
          user_role: user.role_ids[0].toString(),
          user_id: user.id,
          conversation_id: currentConversationId,
          knowledge_retrieval: knowledgeConfig.enabled,
          knowledge_name: selectedKnowledgeBase
        }, (chunk: string) => {
          // 流式消息内容已由 useStreamingChat 钩子处理，这里不需要额外处理
          console.log('Received chunk:', chunk);
        });
        
        // 注意：在流式模式下，不需要在这里设置 setIsProcessing(false)
        // 因为它会在 useStreamingChat 的 onMessageComplete 或 onError 回调中处理
      } else {
        // 传统方式：调用后端API获取完整回复
        const responseText = await generateRAGResponse(
          userMsg.text, 
          documents, 
          history, 
          String(user.role_ids[0]), 
          user.id, 
          currentConversationId,
          knowledgeConfig.enabled,
          selectedKnowledgeBase
        );

        const modelMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: responseText,
          timestamp: new Date(Date.now() + 1000)
        };

        setMessages(prev => {
          const updatedMessages = [...prev, modelMsg];
          // 保存对话
          if (currentConversationId) {
            const firstUserMessage = updatedMessages.find(msg => msg.role === 'user');
            const title = firstUserMessage ? firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '') : '新对话';
            onSaveConversation(currentConversationId, title, updatedMessages);
          }
          return updatedMessages;
        });
        
        // 接收到回复后滚动到底部
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      
      // 如果流式失败，尝试回退到传统方式
      if (useStreaming) {
        console.log('Streaming failed, falling back to traditional method');
        setUseStreaming(false);
        setStreamingMessage(null);
        
        try {
          // Prepare history for API
          const history = messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          }));
          
          // 传统方式：调用后端API获取完整回复
          const responseText = await generateRAGResponse(
            userMsg.text, 
            documents, 
            history, 
            String(user.role_ids[0]),
            user.id,
            currentConversationId,
            knowledgeConfig.enabled,
            selectedKnowledgeBase
          );

          const modelMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText,
            timestamp: new Date(Date.now() + 1000)
          };

          setMessages(prev => {
            const updatedMessages = [...prev, modelMsg];
            // 保存对话
            if (currentConversationId) {
              const firstUserMessage = updatedMessages.find(msg => msg.role === 'user');
              const title = firstUserMessage ? firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '') : '新对话';
              onSaveConversation(currentConversationId, title, updatedMessages);
            }
            return updatedMessages;
          });
          
          // 接收到回复后滚动到底部
          setTimeout(() => {
            scrollToBottom();
          }, 50);
        } catch (fallbackError) {
          console.error('Fallback method also failed:', fallbackError);
          const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: "抱歉，处理您的请求时出现了错误，请稍后再试。",
            timestamp: new Date(Date.now() + 1000)
          };
          setMessages(prev => [...prev, errorMsg]);
          
          // 显示错误消息后滚动到底部
          setTimeout(() => {
            scrollToBottom();
          }, 50);
        }
      } else {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: "抱歉，处理您的请求时出现了错误，请稍后再试。",
          timestamp: new Date(Date.now() + 1000)
        };
        setMessages(prev => [...prev, errorMsg]);
        
        // 显示错误消息后滚动到底部
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      }
    } finally {
      // 只有在非流式模式下才在这里设置 isProcessing 为 false
      // 因为在流式模式下，isProcessing 会在 onMessageComplete 或 onError 回调中处理
      if (!useStreaming) {
        setIsProcessing(false);
      }
    }
  };

  // MCP服务管理函数
  const handleAddMcpService = (service: Omit<MCPService, 'id'>) => {
    const newService: MCPService = {
      ...service,
      id: Date.now().toString()
    };
    setMcpServices(prev => [...prev, newService]);
  };

  const handleUpdateMcpService = (id: string, updates: Partial<MCPService>) => {
    setMcpServices(prev => 
      prev.map(service => 
        service.id === id ? { ...service, ...updates } : service
      )
    );
  };

  const handleDeleteMcpService = (id: string) => {
    setMcpServices(prev => prev.filter(service => service.id !== id));
  };

  const handleTestMcpConnection = async (id: string): Promise<MCPServiceStatus> => {
    const service = mcpServices.find(s => s.id === id);
    if (!service) {
      throw new Error('服务不存在');
    }

    // 模拟连接测试
    try {
      // 这里应该实际调用API测试连接
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status: MCPServiceStatus = {
        isConnected: Math.random() > 0.3, // 模拟70%的成功率
        serviceName: service.name,
        lastCheck: new Date(),
        error: Math.random() > 0.3 ? undefined : '模拟连接失败：无法访问服务端点'
      };
      
      // 更新服务状态
      handleUpdateMcpService(id, {
        lastConnected: status.isConnected ? new Date() : undefined
      });
      
      return status;
    } catch (error) {
      throw new Error('连接测试失败');
    }
  };

  // 检查活跃的MCP服务状态
  useEffect(() => {
    const activeService = mcpServices.find(s => s.isActive);
    if (activeService) {
      handleTestMcpConnection(activeService.id).then(setMcpServiceStatus);
    } else {
      setMcpServiceStatus(null);
    }
  }, [mcpServices]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    // 如果没有当前会话ID，创建一个新会话并保存待发送的消息
    if (!currentConversationId) {
      setPendingMessage(query);
      setQuery('');
      onStartNewConversation();
      return;
    }

    // 直接调用processMessage处理消息
    processMessage(query);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 relative">
      {/* 主内容头部 */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-800">智能搜索助手</h2>
            </div>
            
            {/* 状态指示器和控制按钮 */}
            <div className="flex items-center gap-3">
              {/* 流式输出开关 */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <span className="text-xs text-slate-600">流式输出</span>
                <button
                  onClick={() => setUseStreaming(!useStreaming)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useStreaming ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useStreaming ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
              
              {/* 知识检索状态 */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <span className="text-xs text-slate-600">知识检索</span>
                <button
                  onClick={() => setKnowledgeConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${knowledgeConfig.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${knowledgeConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
              
              {/* 知识库选择 */}
              {knowledgeConfig.enabled && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                  <span className="text-xs text-slate-600">知识库</span>
                  <select
                    value={selectedKnowledgeBase}
                    onChange={(e) => setSelectedKnowledgeBase(e.target.value)}
                    className="text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="knowledge_personal">个人知识库</option>
                    {user.roles && user.roles.map(role => (
                      <option key={role.id} value={`knowledge_${role.role_code}`}>
                        {role.role_name}知识库
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* MCP服务状态 */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <span className="text-xs text-slate-600">MCP服务</span>
                <div className={`w-2 h-2 rounded-full ${mcpServiceStatus?.isConnected ? 'bg-green-500' : 'bg-slate-400'}`} />
                {mcpServiceStatus?.serviceName && (
                  <span className="text-xs text-slate-700 max-w-20 truncate">
                    {mcpServiceStatus.serviceName}
                  </span>
                )}
              </div>
              
              {/* MCP服务管理按钮 */}
              <button
                onClick={() => setMcpServiceManagerOpen(true)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                title="MCP服务管理"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 聊天内容区域 */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 min-h-0"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
              <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-lg font-medium">您好，{ROLE_LABELS[user.role_ids[0]]} {user.username}</p>
              <p className="text-sm">请输入工作相关问题，我将根据您的权限为您检索</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'model' && (
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[90%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                }`}
              >
                {msg.role === 'model' && (
                  <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-500">SmartRAG 助手</span>
                  </div>
                )}
                <div className="prose prose-sm max-w-none break-words leading-relaxed">
                  {msg.role === 'model' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        code: ({ node, className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !props['data-inline'] && !match;
                          return !isInline && match ? (
                            <pre className="bg-slate-100 rounded-md p-3 overflow-x-auto">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code className="bg-slate-100 px-1 py-0.5 rounded text-sm" {...props}>
                              {children}
                            </code>
                          );
                        },
                        table: ({ children }) => (
                          <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse border border-slate-300">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="border border-slate-300 px-3 py-2 bg-slate-50 text-left font-semibold">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="border border-slate-300 px-3 py-2">
                            {children}
                          </td>
                        ),
                        img: ({ src, alt, ...props }: any) => (
                          <img 
                            src={src} 
                            alt={alt} 
                            className="max-w-full h-auto rounded-lg shadow-sm my-2 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => {
                              // 点击图片时可以放大查看
                              const img = new Image();
                              img.src = src;
                              const w = window.open('');
                              if (w) {
                                w.document.write(img.outerHTML);
                              }
                            }}
                            {...props} 
                          />
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  )}
                </div>
                <div className={`text-[10px] mt-2 text-right ${
                  msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                }`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium ml-2 flex-shrink-0">
                  {user.username?.charAt(0) || 'U'}
                </div>
              )}
            </div>
          ))}
          
          {/* 渲染流式消息 */}
          {streamingMessage && isStreaming && (
            <div className="flex justify-start">
              <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm max-w-[90%]">
                <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-500">SmartRAG 助手</span>
                  {isStreaming && (
                    <div className="ml-auto flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-600">流式输出中</span>
                    </div>
                  )}
                </div>
                <div className="prose prose-sm max-w-none break-words leading-relaxed">
                  {streamingMessage.text ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        code: ({ node, className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !props['data-inline'] && !match;
                          return !isInline && match ? (
                            <pre className="bg-slate-100 rounded-md p-3 overflow-x-auto">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code className="bg-slate-100 px-1 py-0.5 rounded text-sm" {...props}>
                              {children}
                            </code>
                          );
                        },
                        table: ({ children }) => (
                          <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse border border-slate-300">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="border border-slate-300 px-3 py-2 bg-slate-50 text-left font-semibold">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="border border-slate-300 px-3 py-2">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {streamingMessage.text}
                    </ReactMarkdown>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  )}
                  {isStreaming && streamingMessage.text && (
                    <span className="inline-block w-2 h-4 bg-slate-600 ml-1 animate-pulse"></span>
                  )}
                </div>
                <div className="text-[10px] mt-2 text-right text-slate-400">
                  {streamingMessage.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )}
          {isProcessing && !isStreaming && (
             <div className="flex justify-start animate-pulse">
               <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form onSubmit={handleSearch} className="relative">
            <textarea
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // 自动调整文本域高度
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                // 按Enter发送消息，按Shift+Enter换行
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch(e);
                }
              }}
              disabled={isProcessing}
              placeholder={knowledgeConfig.enabled ? (documents.length > 0 ? "你想问点什么？" : "无可用知识库") : "你想问点什么？"}
              rows={1}
              className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden min-h-[48px] max-h-32"
            />
            <button
              type="submit"
              disabled={!query.trim() || isProcessing}
              className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      
      {/* MCP服务管理弹窗 */}
      <MCPServiceManager
        isOpen={mcpServiceManagerOpen}
        onClose={() => setMcpServiceManagerOpen(false)}
        services={mcpServices}
        onAddService={handleAddMcpService}
        onUpdateService={handleUpdateMcpService}
        onDeleteService={handleDeleteMcpService}
        onTestConnection={handleTestMcpConnection}
      />
      
      {/* 热门问题列表弹窗 */}
      {showHotQuestionsList && (
        <HotQuestionsList
          onSelectQuestion={(question) => {
            setQuery(question);
            setShowHotQuestionsList(false);
            // 通知父组件重置showHotQuestions状态
            onResetShowHotQuestions?.();
            // 延迟一下，确保状态更新后再发送
            setTimeout(() => {
              processMessage(question);
            }, 100);
          }}
          onClose={() => {
            setShowHotQuestionsList(false);
            // 通知父组件重置showHotQuestions状态
            onResetShowHotQuestions?.();
          }}
        />
      )}
      
      {/* 滚动到底部按钮 - 相对于聊天界面居中 */}
      {userScrolled && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20">
          <div className="relative group">
            {/* 背景光晕效果 */}
            <div className="absolute inset-0 bg-indigo-400 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
            
            {/* 主按钮 */}
            <button
              onClick={() => {
                scrollToBottom();
              }}
              className="relative bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center group-hover:scale-110 p-4 border border-indigo-400/20"
              title="滚动到底部"
            >
              {/* 箭头图标 */}
              <svg className="w-5 h-5 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
            
            {/* 提示文字 */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              回到最新消息
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchInterface;
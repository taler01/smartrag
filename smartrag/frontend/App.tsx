import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Login from './components/Login.tsx';
import DocumentManager from './components/DocumentManager.tsx';
import SearchInterface from './components/SearchInterface.tsx';
import ConversationHistorySidebar from './components/ConversationHistorySidebar.tsx';
import ProfilePage from './components/ProfilePage.tsx';
import HotSearchRanking from './components/HotSearchRanking.tsx';
import { User, Document, ROLE_LABELS, ChatMessage } from './types.ts';
import { getPublicDocuments, getPersonalDocuments, createConversation, deleteConversation as deleteConversationApi, getConversations, getConversation, getConversationMessages, saveConversationMessage, updateConversationTitle } from './services/apiService.ts';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'manage' | 'profile'>('search');
  const [documents, setDocuments] = useState<Document[]>([]);
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<{[id: string]: {title: string, messageCount: number, timestamp: Date}}>({});
  const [messages, setMessages] = useState<{[conversationId: string]: ChatMessage[]}>({});
  
  const [showHotQuestions, setShowHotQuestions] = useState<boolean>(false);

  // 在组件加载时检查本地存储中的用户信息和文档
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        
        loadDocumentsFromBackend(savedToken);
        loadConversationsFromBackend(savedToken);
        
        if (parsedUser.role_ids && parsedUser.role_ids.includes(1)) {
          setActiveTab('manage');
        } else {
          setActiveTab('search');
        }
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } else {
      const savedDocuments = localStorage.getItem('documents');
      if (savedDocuments) {
        try {
          const parsedDocuments = JSON.parse(savedDocuments);
          const documentsWithDates = parsedDocuments.map((doc: any) => ({
            ...doc,
            uploadDate: new Date(doc.uploadDate)
          }));
          setDocuments(documentsWithDates);
        } catch (error) {
          console.error('Failed to parse saved documents:', error);
          localStorage.removeItem('documents');
        }
      }
    }
  }, []);

  // 保存文档到本地存储
  useEffect(() => {
    if (documents.length > 0) {
      localStorage.setItem('documents', JSON.stringify(documents));
    }
  }, [documents]);

  const loadConversationsFromBackend = async (token: string) => {
    try {
      const response = await getConversations(token);
      const conversationsData: {[id: string]: {title: string, messageCount: number, timestamp: Date}} = {};
      
      for (const conv of response.conversations) {
        conversationsData[conv.id] = {
          title: conv.title,
          messageCount: conv.message_count || 0,
          timestamp: new Date(conv.created_at)
        };
      }
      
      setConversations(conversationsData);
      
      if (response.conversations.length > 0 && !currentConversationId) {
        setCurrentConversationId(response.conversations[0].id);
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
    }
  };

  // 从后端加载文档
  const loadDocumentsFromBackend = async (token: string) => {
    try {
      console.log('=== 开始从后端加载文档 ===');
      
      // 加载公共文档
      const publicDocs = await getPublicDocuments(token);
      console.log('公共文档响应:', publicDocs);
      
      // 加载个人文档
      const personalDocs = await getPersonalDocuments(token);
      console.log('个人文档响应:', personalDocs);
      
      // 转换为前端Document格式
      const convertedPublicDocs = publicDocs.map(doc => ({
        id: doc.id.toString(),
        name: doc.filename,
        content: '',
        uploadDate: new Date(doc.upload_time),
        size: doc.file_size,
        permissions: doc.permissions || [],
        knowledgeBaseType: 'public' as const,
        is_processed: doc.is_processed
      }));
      
      const convertedPersonalDocs = personalDocs.map(doc => ({
        id: doc.id.toString(),
        name: doc.filename,
        content: '',
        uploadDate: new Date(doc.upload_time),
        size: doc.file_size,
        permissions: doc.permissions || [],
        knowledgeBaseType: 'personal' as const,
        is_processed: doc.is_processed
      }));
      
      // 合并文档列表
      const allDocs = [...convertedPublicDocs, ...convertedPersonalDocs];
      console.log('转换后的文档列表:', allDocs);
      
      // 更新文档状态
      setDocuments(allDocs);
      
      // 保存到本地存储
      localStorage.setItem('documents', JSON.stringify(allDocs));
      
      console.log('=== 文档加载完成 ===');
    } catch (error) {
      console.error('从后端加载文档失败:', error);
      
      // 显示用户友好的错误信息
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          console.error('用户认证失败，可能需要重新登录');
          // 可以在这里添加自动登出逻辑
          // handleLogout();
        } else if (error.message.includes('403')) {
          console.error('用户没有权限访问文档');
        } else if (error.message.includes('500')) {
          console.error('服务器内部错误');
        } else {
          console.error('文档加载失败:', error.message);
        }
      } else {
        console.error('文档加载失败: 未知错误');
      }
      
      // 尝试从本地存储加载文档作为备用
      const savedDocuments = localStorage.getItem('documents');
      if (savedDocuments) {
        try {
          const parsedDocuments = JSON.parse(savedDocuments);
          // 转换日期字符串回Date对象
          const documentsWithDates = parsedDocuments.map((doc: any) => ({
            ...doc,
            uploadDate: new Date(doc.uploadDate)
          }));
          setDocuments(documentsWithDates);
          console.log('从本地存储加载文档作为备用');
        } catch (parseError) {
          console.error('解析本地存储文档失败:', parseError);
        }
      }
    }
  };

  const handleLogin = (userInfo: any, token: string) => {
    const newUser = {
      id: userInfo.id || Math.random().toString(),
      username: userInfo.username,
      role_ids: userInfo.role_ids || [],
      roles: userInfo.roles || [],
      primaryRole: userInfo.primaryRole || (userInfo.roles && userInfo.roles.length > 0 ? userInfo.roles[0].role_code : undefined)
    };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('token', token);
    
    loadDocumentsFromBackend(token);
    loadConversationsFromBackend(token);
    
    if (newUser.role_ids.includes(1)) {
      setActiveTab('manage');
    } else {
      setActiveTab('search');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('search');
    // 清除本地存储中的用户信息
    localStorage.removeItem('user');
  };

  const handleAddDocument = async (doc: Document) => {
    // 先添加到本地状态，立即显示
    setDocuments(prev => [...prev, doc]);
    
    // 然后从后端刷新整个文档列表，确保数据同步
    const token = localStorage.getItem('token');
    if (token) {
      await loadDocumentsFromBackend(token);
    }
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(prev => {
      const updatedDocuments = prev.filter(d => d.id !== id);
      // 更新本地存储
      if (updatedDocuments.length === 0) {
        localStorage.removeItem('documents');
      } else {
        localStorage.setItem('documents', JSON.stringify(updatedDocuments));
      }
      return updatedDocuments;
    });
  };

  // 刷新文档列表
  const handleRefreshDocuments = async (type: 'public' | 'personal') => {
    const token = localStorage.getItem('token');
    if (token) {
      console.log(`刷新${type === 'public' ? '公共' : '个人'}知识库文档`);
      await loadDocumentsFromBackend(token);
    }
  };

  const handleSaveConversation = async (id: string, title: string, messages: ChatMessage[]) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      for (const msg of messages) {
        const messageContent = msg.text || msg.content || '';
        
        if (!messageContent.trim()) {
          console.warn('跳过空消息:', msg);
          continue;
        }
        
        await saveConversationMessage(id, {
          id: msg.id,
          role: msg.role,
          text: messageContent,
          timestamp: msg.timestamp
        }, token);
      }
      
      const isFirstMessage = !conversations[id] || conversations[id].messageCount === 0;
      
      if (isFirstMessage && title !== '新对话') {
        await updateConversationTitle(id, { title }, token);
      }
      
      setConversations(prev => ({
        ...prev,
        [id]: {
          title,
          messageCount: messages.length,
          timestamp: prev[id]?.timestamp || new Date()
        }
      }));
      
      setMessages(prev => ({
        ...prev,
        [id]: messages
      }));
    } catch (error) {
      console.error('保存消息失败:', error);
    }
  };

  const handleLoadConversation = async (id: string, skip: number = 0, limit: number = 50) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('用户未登录');
      }
      
      const response = await getConversationMessages(id, skip, limit, token);
      
      const chatMessages: ChatMessage[] = response.messages.map(msg => ({
        id: msg.id,
        role: msg.role === 'assistant' ? 'model' : 'user',
        text: msg.content,
        content: msg.content,
        timestamp: new Date(msg.created_at)
      }));
      
      setMessages(prev => {
        const existingMessages = prev[id] || [];
        const newMessages = skip === 0 ? chatMessages : [...existingMessages, ...chatMessages];
        return {
          ...prev,
          [id]: newMessages
        };
      });
      
      setCurrentConversationId(id);
      
      setConversations(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          messageCount: response.total || chatMessages.length
        }
      }));
    } catch (error) {
      console.error('加载对话失败:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('加载对话失败，请重试');
      }
    }
  };

  const handleStartNewConversation = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('用户未登录');
      }
      
      const response = await createConversation(
        { title: '新对话' },
        token
      );
      
      setCurrentConversationId(response.id);
      
      setConversations(prev => ({
        ...prev,
        [response.id]: {
          title: '新对话',
          messageCount: 0,
          timestamp: new Date()
        }
      }));
      
      setMessages(prev => ({
        ...prev,
        [response.id]: []
      }));
    } catch (error) {
      console.error('创建新对话失败:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('创建新对话失败，请重试');
      }
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('用户未登录');
      }
      
      await deleteConversationApi(id, token);
      
      const newConversations = {...conversations};
      delete newConversations[id];
      setConversations(newConversations);
      
      const newMessages = {...messages};
      delete newMessages[id];
      setMessages(newMessages);
      
      if (Object.keys(newConversations).length === 0) {
        if (id === currentConversationId) {
          setCurrentConversationId(null);
        }
      } else {
        if (id === currentConversationId) {
          const latestId = Object.keys(newConversations)
            .sort((a, b) => newConversations[b].timestamp.getTime() - newConversations[a].timestamp.getTime())[0];
          setCurrentConversationId(latestId);
        }
      }
    } catch (error) {
      console.error('删除对话失败:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('删除对话失败，请重试');
      }
    }
  };

  // 处理热门问题选择
  const handleSelectHotQuestion = (question: string) => {
    // 切换到搜索界面
    setActiveTab('search');
    // 设置显示热门问题列表
    setShowHotQuestions(true);
  };
  
  // 处理显示热门问题列表
  const handleShowHotQuestions = () => {
    // 切换到搜索界面
    setActiveTab('search');
    // 设置显示热门问题列表的标志
    setShowHotQuestions(true);
  };
  
  // 重置热门问题显示状态
  const handleResetShowHotQuestions = () => {
    setShowHotQuestions(false);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Filter documents: Admins see all, Users only see what they have permission for
  const visibleDocuments = user.role_ids && user.role_ids.includes(1) 
    ? documents 
    : documents.filter(doc => {
        // 个人文档：只有文档所有者能看到
        if (doc.knowledgeBaseType === 'personal') {
          return true; // 个人文档对所有者总是可见
        }
        // 公共文档：需要权限匹配
        return doc.permissions.some(permission => user.role_ids.includes(permission));
      });

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <div className="flex h-full">
        {/* Left Sidebar - Navigation */}
        <aside className="w-64 xl:w-80 2xl:w-96 flex flex-col flex-shrink-0 bg-white border-r border-slate-200">
          {/* Logo */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">SmartRAG</h1>
                <p className="text-xs text-slate-500">员工知识门户</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 border-b border-slate-100">
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('search')}
                className={`flex items-center gap-3 w-full px-4 py-2 rounded-lg transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="text-sm font-medium">智能问答</span>
              </button>

              <button
                onClick={() => setActiveTab('manage')}
                className={`flex items-center gap-3 w-full px-4 py-2 rounded-lg transition-all ${activeTab === 'manage' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-sm font-medium">知识库管理</span>
              </button>

              {/* Hot Search Ranking */}
              <HotSearchRanking 
                onSelectQuestion={handleSelectHotQuestion} 
                onShowHotQuestions={handleShowHotQuestions} 
              />
            </div>
          </nav>

          {/* Conversation History */}
          <div className="flex-1 overflow-y-auto">
            <ConversationHistorySidebar
              currentConversationId={currentConversationId}
              conversations={conversations}
              documents={visibleDocuments}
              user={user}
              onLoadConversation={handleLoadConversation}
              onStartNewConversation={handleStartNewConversation}
              onDeleteConversation={handleDeleteConversation}
            />
          </div>

          {/* User Info */}
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 rounded-lg p-2 -m-2 transition-colors"
              onClick={() => setActiveTab('profile')}
              title="点击查看个人主页"
            >
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                {user.username?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{user.username}</p>
                <p className="text-xs text-slate-500">
                  {user.role_ids && user.role_ids.length > 0 
                    ? user.role_ids.map(id => {
                        const roleIdToCode: Record<number, string> = {
                          1: "ADMIN",
                          2: "R_AND_D", 
                          3: "AFTER_SALES",
                          4: "PRE_SALES",
                          5: "QA",
                          6: "OPS"
                        };
                        const roleCode = roleIdToCode[id] || "R_AND_D";
                        return ROLE_LABELS[roleCode];
                      }).join(', ')
                    : '用户'
                  }
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                title="退出登录"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Main Content */}
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {activeTab === 'profile' ? (
            <ProfilePage user={user} onBack={() => setActiveTab(user.role_ids && user.role_ids.includes(1) ? 'manage' : 'search')} />
          ) : activeTab === 'manage' ? (
            <DocumentManager 
              documents={visibleDocuments}
              onAddDocument={handleAddDocument}
              onRemoveDocument={handleRemoveDocument}
              onRefreshDocuments={handleRefreshDocuments}
              userRole={user.role_ids.map(id => {
                const roleIdToCode: Record<number, string> = {
                  1: "ADMIN",
                  2: "R_AND_D", 
                  3: "AFTER_SALES",
                  4: "PRE_SALES",
                  5: "QA",
                  6: "OPS"
                };
                return roleIdToCode[id] || "R_AND_D";
              })}
              token={localStorage.getItem('token') || ''}
            />
          ) : (
            /* 搜索界面 */
            <SearchInterface 
              documents={visibleDocuments}
              user={user}
              currentConversationId={currentConversationId}
              conversations={conversations}
              messages={messages}
              onSaveConversation={handleSaveConversation}
              onLoadConversation={handleLoadConversation}
              onStartNewConversation={handleStartNewConversation}
              onDeleteConversation={handleDeleteConversation}
              showHotQuestions={showHotQuestions}
              onResetShowHotQuestions={handleResetShowHotQuestions}
            />
          )}
        </main>
    </div>
  );
}

export default App;
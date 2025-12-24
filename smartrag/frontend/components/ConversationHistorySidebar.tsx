import React from 'react';
import { ChatMessage, User, ROLE_LABELS } from '../types';

interface ConversationHistorySidebarProps {
  conversations: {[id: string]: {title: string, messageCount: number, timestamp: Date}};
  currentConversationId: string | null;
  documents: any[];
  user: User;
  onLoadConversation: (id: string, skip?: number, limit?: number) => void;
  onStartNewConversation: () => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
}

const ConversationHistorySidebar: React.FC<ConversationHistorySidebarProps> = ({ 
  conversations, 
  currentConversationId,
  documents,
  user,
  onLoadConversation, 
  onStartNewConversation, 
  onDeleteConversation 
}) => {
  return (
    <div className="w-64 xl:w-80 2xl:w-96 border-r border-slate-100 bg-white flex flex-col">
      {/* 侧边栏头部 */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">会话历史</h2>
          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
            {Object.keys(conversations).length} 个对话
          </span>
        </div>
      </div>
      
      {/* 新对话按钮 */}
      <button
        onClick={onStartNewConversation}
        className="m-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        新对话
      </button>
      
      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {Object.entries(conversations)
          .sort(([, a], [, b]) => {
            const convA = a as {title: string, messageCount: number, timestamp: Date};
            const convB = b as {title: string, messageCount: number, timestamp: Date};
            return convB.timestamp.getTime() - convA.timestamp.getTime();
          })
          .map(([id, conversation]) => {
            const conv = conversation as {title: string, messageCount: number, timestamp: Date};
            return (
              <div
                key={id}
                onClick={() => onLoadConversation(id)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${id === currentConversationId ? 'bg-blue-50 border-blue-200' : 'border-slate-100 hover:bg-slate-50'}`}
              >
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium text-slate-800 truncate flex-1">{conv.title}</p>
                  <button
                    onClick={(e) => onDeleteConversation(id, e)}
                    className="ml-2 p-1 hover:bg-red-100 rounded transition-colors"
                    title="删除对话"
                  >
                    <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {conv.timestamp.toLocaleDateString()} {conv.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            );
          })}
      </div>
      
      {/* 侧边栏底部信息 */}
      <div className="p-3 border-t border-slate-100 text-xs text-slate-500">
        <p>当前检索范围: {documents.length} 个文档</p>
        <p className="mt-1">{user.roles && user.roles.length > 0 ? ROLE_LABELS[user.roles[0].role_code] : '未知'}视角</p>
      </div>
    </div>
  );
};

export default ConversationHistorySidebar;
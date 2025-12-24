import React from 'react';
import { ChatMessage } from '../types';
import { useTypewriter } from '../hooks/useTypewriter';

interface TypewriterMessageProps {
  message: ChatMessage;
  isLatestMessage: boolean;
  isProcessing: boolean;
  onScrollToBottom?: (ignoreUserScroll?: boolean) => void;
  userScrolled?: boolean;
}

const TypewriterMessage: React.FC<TypewriterMessageProps> = ({ 
  message, 
  isLatestMessage, 
  isProcessing,
  onScrollToBottom,
  userScrolled
}) => {
  // 只有最新的AI消息才使用打字机效果
  const shouldUseTypewriter = message.role === 'model' && isLatestMessage && !isProcessing;
  
  // 创建一个包装函数，根据用户滚动状态决定是否滚动
  const handleScrollToBottom = () => {
    // 如果用户已经滚动离开底部，则不打断他们查看历史记录
    if (userScrolled) return;
    onScrollToBottom?.();
  };
  
  const { displayedText, isTyping } = useTypewriter({ 
    text: message.text, 
    isComplete: !shouldUseTypewriter,
    onScrollToBottom: handleScrollToBottom
  });

  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[90%] rounded-2xl p-4 shadow-sm ${
          message.role === 'user' 
            ? 'bg-blue-600 text-white rounded-tr-none' 
            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
        }`}
      >
        {message.role === 'model' && (
          <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
            <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-slate-500">SmartRAG 助手</span>
          </div>
        )}
        <div className="prose prose-sm max-w-none break-words whitespace-pre-wrap leading-relaxed">
          {shouldUseTypewriter ? displayedText : message.text}
          {shouldUseTypewriter && isTyping && (
            <span className="inline-block w-2 h-4 bg-slate-600 ml-1 animate-pulse"></span>
          )}
        </div>
        <div className={`text-[10px] mt-2 text-right ${
          message.role === 'user' ? 'text-blue-200' : 'text-slate-400'
        }`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default TypewriterMessage;
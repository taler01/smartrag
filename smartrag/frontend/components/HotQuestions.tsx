import React, { useState } from 'react';

interface HotQuestionsProps {
  questions: string[];
  onSelectQuestion: (question: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

const HotQuestions: React.FC<HotQuestionsProps> = ({ 
  questions, 
  onSelectQuestion, 
  onLoadMore, 
  hasMore = false, 
  loading = false 
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  if (!questions || questions.length === 0) {
    return null;
  }

  // 定义更加花哨的颜色方案和动画效果
  const colorSchemes = [
    { 
      bg: 'from-purple-500 to-pink-500', 
      hoverBg: 'from-purple-50 to-pink-50', 
      border: 'hover:border-purple-300', 
      text: 'group-hover:text-purple-700', 
      icon: 'text-purple-500',
      shadow: 'hover:shadow-purple-200/50',
      glow: 'hover:shadow-lg hover:shadow-purple-300/30'
    },
    { 
      bg: 'from-blue-500 to-cyan-500', 
      hoverBg: 'from-blue-50 to-cyan-50', 
      border: 'hover:border-blue-300', 
      text: 'group-hover:text-blue-700', 
      icon: 'text-blue-500',
      shadow: 'hover:shadow-blue-200/50',
      glow: 'hover:shadow-lg hover:shadow-blue-300/30'
    },
    { 
      bg: 'from-green-500 to-emerald-500', 
      hoverBg: 'from-green-50 to-emerald-50', 
      border: 'hover:border-green-300', 
      text: 'group-hover:text-green-700', 
      icon: 'text-green-500',
      shadow: 'hover:shadow-green-200/50',
      glow: 'hover:shadow-lg hover:shadow-green-300/30'
    },
    { 
      bg: 'from-orange-500 to-yellow-500', 
      hoverBg: 'from-orange-50 to-yellow-50', 
      border: 'hover:border-orange-300', 
      text: 'group-hover:text-orange-700', 
      icon: 'text-orange-500',
      shadow: 'hover:shadow-orange-200/50',
      glow: 'hover:shadow-lg hover:shadow-orange-300/30'
    },
    { 
      bg: 'from-pink-500 to-rose-500', 
      hoverBg: 'from-pink-50 to-rose-50', 
      border: 'hover:border-pink-300', 
      text: 'group-hover:text-pink-700', 
      icon: 'text-pink-500',
      shadow: 'hover:shadow-pink-200/50',
      glow: 'hover:shadow-lg hover:shadow-pink-300/30'
    },
    { 
      bg: 'from-indigo-500 to-purple-500', 
      hoverBg: 'from-indigo-50 to-purple-50', 
      border: 'hover:border-indigo-300', 
      text: 'group-hover:text-indigo-700', 
      icon: 'text-indigo-500',
      shadow: 'hover:shadow-indigo-200/50',
      glow: 'hover:shadow-lg hover:shadow-indigo-300/30'
    },
    { 
      bg: 'from-teal-500 to-cyan-500', 
      hoverBg: 'from-teal-50 to-cyan-50', 
      border: 'hover:border-teal-300', 
      text: 'group-hover:text-teal-700', 
      icon: 'text-teal-500',
      shadow: 'hover:shadow-teal-200/50',
      glow: 'hover:shadow-lg hover:shadow-teal-300/30'
    },
    { 
      bg: 'from-red-500 to-orange-500', 
      hoverBg: 'from-red-50 to-orange-50', 
      border: 'hover:border-red-300', 
      text: 'group-hover:text-red-700', 
      icon: 'text-red-500',
      shadow: 'hover:shadow-red-200/50',
      glow: 'hover:shadow-lg hover:shadow-red-300/30'
    }
  ];

  return (
    <div className="w-full max-w-2xl mt-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
        <h3 className="text-lg font-semibold text-slate-700 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">热门问题</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 via-purple-200 to-pink-200"></div>
        <div className="flex gap-1">
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
          <span className="inline-block w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
          <span className="inline-block w-2 h-2 bg-pink-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {questions.map((question, index) => {
          const colorScheme = colorSchemes[index % colorSchemes.length];
          const isHovered = hoveredIndex === index;
          return (
            <button
              key={index}
              onClick={() => onSelectQuestion(question)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`group relative p-4 bg-white border border-slate-200 rounded-xl shadow-sm ${colorScheme.border} ${colorScheme.glow} transition-all duration-300 text-left overflow-hidden transform ${isHovered ? 'scale-105 -translate-y-1' : ''}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${colorScheme.hoverBg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
              
              {/* 装饰性背景元素 */}
              <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${colorScheme.bg} opacity-0 group-hover:opacity-10 rounded-bl-full transition-opacity duration-300`}></div>
              <div className={`absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr ${colorScheme.bg} opacity-0 group-hover:opacity-10 rounded-tr-full transition-opacity duration-300`}></div>
              
              <div className="relative flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 bg-gradient-to-br ${colorScheme.bg} text-white rounded-lg flex items-center justify-center text-sm font-semibold shadow-sm transform transition-transform duration-300 ${isHovered ? 'rotate-12 scale-110' : ''}`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className={`text-slate-700 ${colorScheme.text} transition-colors duration-300 font-medium`}>
                    {question}
                  </p>
                </div>
                <div className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 transform ${isHovered ? 'translate-x-0' : 'translate-x-2'}`}>
                  <svg className={`w-5 h-5 ${colorScheme.icon} transform transition-transform duration-300 ${isHovered ? 'translate-x-0' : 'translate-x-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
              
              {/* 底部装饰线 */}
              <div className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r ${colorScheme.bg} transform transition-transform duration-300 origin-left ${isHovered ? 'scale-x-100' : 'scale-x-0'}`}></div>
            </button>
          );
        })}
        
        {/* 更多按钮 */}
        {hasMore && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className={`group relative p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-2 border-dashed border-slate-300 rounded-xl transition-all duration-300 text-left overflow-hidden transform hover:scale-105 hover:-translate-y-1 ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-400 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50'}`}
          >
            <div className="relative flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-slate-600 font-medium">加载中...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-slate-600 group-hover:text-blue-600 font-medium transition-colors duration-300">更多热门问题</span>
                </>
              )}
            </div>
            
            {/* 装饰性背景元素 */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-400 opacity-0 group-hover:opacity-5 rounded-bl-full transition-opacity duration-300"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-blue-400 to-purple-400 opacity-0 group-hover:opacity-5 rounded-tr-full transition-opacity duration-300"></div>
            
            {/* 底部装饰线 */}
            <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 transform transition-transform duration-300 origin-left scale-x-0 group-hover:scale-x-100"></div>
          </button>
        )}
      </div>
    </div>
  );
};

export default HotQuestions;
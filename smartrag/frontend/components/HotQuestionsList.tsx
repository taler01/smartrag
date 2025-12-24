import React from 'react';

interface HotQuestionsListProps {
  onSelectQuestion: (question: string) => void;
  onClose: () => void;
}

const HotQuestionsList: React.FC<HotQuestionsListProps> = ({ onSelectQuestion, onClose }) => {
  const hotQuestions = [
    "今天有什么重要任务？",
    "最近的项目进展如何？",
    "团队会议安排在什么时候？",
    "当前优先级最高的工作是什么？",
    "下周有什么重要截止日期？",
    "当前项目的风险点有哪些？",
    "团队资源分配情况如何？",
    "客户反馈的最新进展是什么？",
    "技术债务需要优先处理哪些？",
    "产品路线图的关键节点是什么？"
  ];

  // 定义五彩缤纷的颜色方案
  const colorSchemes = [
    { bg: 'from-red-500 to-orange-500', text: 'text-red-600', border: 'border-red-200', hoverBg: 'hover:bg-red-50', badge: 'bg-gradient-to-r from-red-500 to-orange-500' },
    { bg: 'from-orange-500 to-yellow-500', text: 'text-orange-600', border: 'border-orange-200', hoverBg: 'hover:bg-orange-50', badge: 'bg-gradient-to-r from-orange-500 to-yellow-500' },
    { bg: 'from-yellow-500 to-green-500', text: 'text-yellow-600', border: 'border-yellow-200', hoverBg: 'hover:bg-yellow-50', badge: 'bg-gradient-to-r from-yellow-500 to-green-500' },
    { bg: 'from-green-500 to-teal-500', text: 'text-green-600', border: 'border-green-200', hoverBg: 'hover:bg-green-50', badge: 'bg-gradient-to-r from-green-500 to-teal-500' },
    { bg: 'from-teal-500 to-blue-500', text: 'text-teal-600', border: 'border-teal-200', hoverBg: 'hover:bg-teal-50', badge: 'bg-gradient-to-r from-teal-500 to-blue-500' },
    { bg: 'from-blue-500 to-indigo-500', text: 'text-blue-600', border: 'border-blue-200', hoverBg: 'hover:bg-blue-50', badge: 'bg-gradient-to-r from-blue-500 to-indigo-500' },
    { bg: 'from-indigo-500 to-purple-500', text: 'text-indigo-600', border: 'border-indigo-200', hoverBg: 'hover:bg-indigo-50', badge: 'bg-gradient-to-r from-indigo-500 to-purple-500' },
    { bg: 'from-purple-500 to-pink-500', text: 'text-purple-600', border: 'border-purple-200', hoverBg: 'hover:bg-purple-50', badge: 'bg-gradient-to-r from-purple-500 to-pink-500' },
    { bg: 'from-pink-500 to-rose-500', text: 'text-pink-600', border: 'border-pink-200', hoverBg: 'hover:bg-pink-50', badge: 'bg-gradient-to-r from-pink-500 to-rose-500' },
    { bg: 'from-gray-500 to-slate-500', text: 'text-gray-600', border: 'border-gray-200', hoverBg: 'hover:bg-gray-50', badge: 'bg-gradient-to-r from-gray-500 to-slate-500' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* 标题区域 */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-red-500 via-orange-500 to-yellow-500 rounded-full animate-pulse"></div>
              <h3 className="text-lg font-semibold text-slate-700">🔥 热搜榜</h3>
              <div className="flex gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
                <span className="inline-block w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* 热门问题列表 */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            {hotQuestions.map((question, index) => {
              const colorScheme = colorSchemes[index % colorSchemes.length];
              const isTopThree = index < 3;
              
              return (
                <div
                  key={index}
                  onClick={() => {
                    onSelectQuestion(question);
                    onClose();
                  }}
                  className={`p-4 rounded-lg border ${colorScheme.border} ${colorScheme.hoverBg} cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-md ${isTopThree ? 'ring-2 ring-offset-2 ' + colorScheme.text.replace('text', 'ring') : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 ${colorScheme.badge} text-white rounded-full flex items-center justify-center text-sm font-bold ${isTopThree ? 'animate-pulse' : ''}`}>
                      {index + 1}
                    </div>
                    <p className={`text-base ${colorScheme.text} font-medium flex-1 ${isTopThree ? 'font-semibold' : ''}`}>
                      {question}
                    </p>
                    {isTopThree && (
                      <div className="flex-shrink-0">
                        <svg className={`w-5 h-5 ${colorScheme.text} animate-pulse`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotQuestionsList;
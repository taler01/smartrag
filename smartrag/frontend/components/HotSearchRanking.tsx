import React from 'react';

interface HotSearchRankingProps {
  onSelectQuestion: (question: string) => void;
  onShowHotQuestions: () => void;
}

const HotSearchRanking: React.FC<HotSearchRankingProps> = ({ onSelectQuestion, onShowHotQuestions }) => {
  return (
    <div 
      className={`flex items-center gap-3 w-full px-4 py-2 rounded-lg transition-all cursor-pointer text-slate-600 hover:bg-slate-100`}
      onClick={onShowHotQuestions}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
      </svg>
      <span className="text-sm font-medium">热搜榜</span>
    </div>
  );
};

export default HotSearchRanking;
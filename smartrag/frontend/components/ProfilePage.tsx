import React from 'react';
import { User, ROLE_LABELS } from '../types';

interface ProfilePageProps {
  user: User;
  onBack: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack }) => {
  // 获取用户的主要角色（如果有多个角色，取第一个）
  const getPrimaryRole = () => {
     // 首先检查是否有primaryRole字段
     if (user.primaryRole) {
       return user.primaryRole;
     }
     
     // 然后检查roles数组
     if (user.roles && user.roles.length > 0) {
       return user.roles[0].role_code;
     }
     
     // 最后尝试从role_ids推断（将数字ID映射到角色代码）
     if (user.role_ids && user.role_ids.length > 0) {
       // 简单的角色ID到角色代码映射
       const roleIdToCode: Record<number, string> = {
         1: "ADMIN",
         2: "R_AND_D", 
         3: "AFTER_SALES",
         4: "PRE_SALES",
         5: "QA",
         6: "OPS"
       };
       
       const firstRoleId = user.role_ids[0];
       return roleIdToCode[firstRoleId] || "R_AND_D";
     }
     
     return "R_AND_D"; // 默认角色
   };

  const primaryRole = getPrimaryRole();
  const roleLabel = ROLE_LABELS[primaryRole] || '未知角色';

  return (
    <div className="flex-1 min-w-0 h-full overflow-hidden bg-white">
      {/* 页面头部 */}
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">个人主页</h2>
          <p className="text-sm text-slate-500 mt-1">查看和管理您的个人信息</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors self-start sm:self-auto"
        >
          返回
        </button>
      </div>
      
      {/* 个人信息内容 */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto">
          {/* 用户头像和基本信息 */}
          <div className="flex items-center gap-4 sm:gap-6 mb-8 sm:mb-10">
            <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-24 lg:w-24 lg:h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-lg sm:text-xl md:text-2xl lg:text-4xl font-bold flex-shrink-0">
              {user.username?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 truncate">{user.username}</h3>
              <p className="text-sm sm:text-base md:text-lg text-slate-600 mt-1">{roleLabel}</p>
            </div>
          </div>
          
          {/* 详细信息卡片 */}
          <div className="bg-slate-50 rounded-xl p-4 sm:p-6 border border-slate-100">
            <h4 className="text-base font-semibold text-slate-800 mb-3 sm:mb-4">用户信息</h4>
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-4">
                <div className="text-slate-600 text-sm sm:text-base md:col-span-1">用户名</div>
                <div className="md:col-span-3 font-medium text-sm sm:text-base">{user.username}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-4">
                <div className="text-slate-600 text-sm sm:text-base md:col-span-1">角色</div>
                <div className="md:col-span-3 font-medium text-sm sm:text-base">{roleLabel}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-4">
                <div className="text-slate-600 text-sm sm:text-base md:col-span-1">账户状态</div>
                <div className="md:col-span-3 font-medium text-green-600 text-sm sm:text-base">活跃</div>
              </div>
            </div>
          </div>
          
          {/* 系统信息 */}
          <div className="bg-slate-50 rounded-xl p-4 sm:p-6 border border-slate-100 mt-4 sm:mt-6">
            <h4 className="text-base font-semibold text-slate-800 mb-3 sm:mb-4">系统信息</h4>
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-4">
                <div className="text-slate-600 text-sm sm:text-base md:col-span-1">系统版本</div>
                <div className="md:col-span-3 font-medium text-sm sm:text-base">v1.0.0</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-4">
                <div className="text-slate-600 text-sm sm:text-base md:col-span-1">更新时间</div>
                <div className="md:col-span-3 font-medium text-sm sm:text-base">2025-12-17</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
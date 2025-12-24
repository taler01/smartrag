import React, { useState, useEffect } from 'react';
import { MCPService, MCPServiceStatus } from '../types';

interface MCPServiceManagerProps {
  isOpen: boolean;
  onClose: () => void;
  services: MCPService[];
  onAddService: (service: Omit<MCPService, 'id'>) => void;
  onUpdateService: (id: string, updates: Partial<MCPService>) => void;
  onDeleteService: (id: string) => void;
  onTestConnection: (id: string) => Promise<MCPServiceStatus>;
}

const MCPServiceManager: React.FC<MCPServiceManagerProps> = ({
  isOpen,
  onClose,
  services,
  onAddService,
  onUpdateService,
  onDeleteService,
  onTestConnection
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [testingServices, setTestingServices] = useState<Set<string>>(new Set());
  const [serviceStatuses, setServiceStatuses] = useState<Map<string, MCPServiceStatus>>(new Map());
  
  // 新增服务表单状态
  const [newService, setNewService] = useState({
    name: '',
    endpoint: '',
    apiKey: '',
    description: '',
    serviceType: 'openai' as MCPService['serviceType'],
    isActive: true
  });

  if (!isOpen) return null;

  const handleAddService = () => {
    if (!newService.name || !newService.endpoint) {
      alert('请填写服务名称和端点地址');
      return;
    }
    
    onAddService(newService);
    setNewService({
      name: '',
      endpoint: '',
      apiKey: '',
      description: '',
      serviceType: 'openai',
      isActive: true
    });
    setActiveTab('list');
  };

  const handleTestConnection = async (serviceId: string) => {
    setTestingServices(prev => new Set(prev).add(serviceId));
    try {
      const status = await onTestConnection(serviceId);
      setServiceStatuses(prev => new Map(prev).set(serviceId, status));
    } catch (error) {
      console.error('连接测试失败:', error);
      setServiceStatuses(prev => new Map(prev).set(serviceId, {
        isConnected: false,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : '连接测试失败'
      }));
    } finally {
      setTestingServices(prev => {
        const newSet = new Set(prev);
        newSet.delete(serviceId);
        return newSet;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">MCP服务管理</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'list' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              服务列表
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'add' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              添加服务
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'list' && (
            <div className="space-y-4">
              {services.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p>暂无MCP服务</p>
                  <p className="text-sm mt-2">点击"添加服务"按钮来配置您的第一个MCP服务</p>
                </div>
              ) : (
                services.map(service => {
                  const status = serviceStatuses.get(service.id);
                  const isTesting = testingServices.has(service.id);
                  
                  return (
                    <div key={service.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-800">{service.name}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              service.isActive 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {service.isActive ? '已启用' : '已禁用'}
                            </span>
                            <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                              {service.serviceType}
                            </span>
                          </div>
                          
                          {service.description && (
                            <p className="text-sm text-slate-600 mb-2">{service.description}</p>
                          )}
                          
                          <div className="text-sm text-slate-500">
                            <div>端点: {service.endpoint}</div>
                            {service.lastConnected && (
                              <div>最后连接: {service.lastConnected.toLocaleString()}</div>
                            )}
                          </div>
                          
                          {status && (
                            <div className={`mt-2 text-sm ${
                              status.isConnected ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {status.isConnected ? '✓ 连接正常' : '✗ 连接失败'}
                              {status.error && <span className="block">{status.error}</span>}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestConnection(service.id)}
                            disabled={isTesting}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            {isTesting ? '测试中...' : '测试连接'}
                          </button>
                          
                          <button
                            onClick={() => onUpdateService(service.id, { isActive: !service.isActive })}
                            className="px-3 py-1.5 text-sm bg-slate-50 text-slate-600 rounded hover:bg-slate-100 transition-colors"
                          >
                            {service.isActive ? '禁用' : '启用'}
                          </button>
                          
                          <button
                            onClick={() => onDeleteService(service.id)}
                            className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'add' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">服务名称</label>
                <input
                  type="text"
                  value={newService.name}
                  onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="例如: OpenAI GPT-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">服务类型</label>
                <select
                  value={newService.serviceType}
                  onChange={(e) => setNewService(prev => ({ ...prev, serviceType: e.target.value as MCPService['serviceType'] }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="local">本地服务</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">端点地址</label>
                <input
                  type="text"
                  value={newService.endpoint}
                  onChange={(e) => setNewService(prev => ({ ...prev, endpoint: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API密钥</label>
                <input
                  type="password"
                  value={newService.apiKey}
                  onChange={(e) => setNewService(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="sk-..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                <textarea
                  value={newService.description}
                  onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="服务描述信息..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newService.isActive}
                  onChange={(e) => setNewService(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-slate-700">启用服务</label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddService}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  添加服务
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MCPServiceManager;
export enum UserRole {
  ADMIN = "ADMIN",
  R_AND_D = "R_AND_D",
  AFTER_SALES = "AFTER_SALES", 
  PRE_SALES = "PRE_SALES",
  QA = "QA",
  OPS = "OPS"
}

export interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const ROLE_LABELS: Record<string, string> = {
  "ADMIN": '系统管理员',
  "R_AND_D": '研发工程师',
  "AFTER_SALES": '售后支持',
  "PRE_SALES": '售前咨询',
  "QA": '测试工程师',
  "OPS": '运维工程师'
};

export interface User {
  id: string;
  username: string;
  role_ids: number[];  // 支持多角色
  roles?: Role[];      // 角色详细信息
  primaryRole?: string; // 主角色代码（兼容字段）
}

export interface Document {
  id: string;
  name: string;
  content: string;
  uploadDate: Date;
  size: number;
  permissions: number[]; // List of role IDs allowed to access this document
  knowledgeBaseType?: 'public' | 'personal'; // 知识库类型：公共知识库或个人知识库
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}

export interface SearchResult {
  answer: string;
  sourceDocuments: string[]; // IDs of documents used
}

// 知识检索相关类型
export interface KnowledgeRetrievalConfig {
  enabled: boolean;
  maxDocuments: number;
  similarityThreshold: number;
}

// MCP服务相关类型
export interface MCPService {
  id: string;
  name: string;
  endpoint: string;
  apiKey?: string;
  description?: string;
  isActive: boolean;
  lastConnected?: Date;
  serviceType: 'openai' | 'anthropic' | 'local' | 'custom';
}

export interface MCPServiceStatus {
  isConnected: boolean;
  serviceName?: string;
  lastCheck: Date;
  error?: string;
}
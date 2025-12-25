export enum UserRole {
  ADMIN = 'ADMIN',
  R_AND_D = 'R_AND_D',
  QA = 'QA',
  OPS = 'OPS',
  PRE_SALES = 'PRE_SALES',
  AFTER_SALES = 'AFTER_SALES'
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  role_ids?: number[];
  roles?: Role[];
}

export interface Role {
  id: number;
  role_code: string;
  role_name: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const ROLE_LABELS: Record<string, string> = {
  'ADMIN': '管理员',
  'R_AND_D': '研发',
  'QA': '测试',
  'OPS': '运维',
  'PRE_SALES': '售前',
  'AFTER_SALES': '售后'
};

export interface Document {
  id: string;
  name: string;
  content: string;
  uploadDate: Date;
  size: number;
  permissions: number[]; // List of role IDs allowed to access this document
  knowledgeBaseType?: 'public' | 'personal'; // 知识库类型：公共知识库或个人知识库
  is_processed?: boolean; // 文档是否已处理（向量化等）
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  type: 'public' | 'personal';
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'model';
  text?: string;
  content?: string;
  timestamp: Date;
  documentReferences?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  knowledgeBaseId?: string;
}

export interface DocumentInfo {
  id: number;
  filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  file_hash: string;
  minio_filename?: string;
  file_url?: string;
  title?: string;
  description?: string;
  is_active: boolean;
  is_processed: boolean;
  upload_time: string;
  created_at: string;
  updated_at: string;
  document_type: 'public' | 'personal';
  uploader_id?: number;
  owner_id?: number;
  permissions?: number[];
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface KnowledgeRetrievalConfig {
  enabled: boolean;
  maxDocuments: number;
  similarityThreshold: number;
}

export interface MCPService {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  enabled: boolean;
  lastConnected?: Date;
}

export interface MCPServiceStatus {
  isConnected: boolean;
  serviceName: string | null;
  lastCheck?: Date;
  error?: string;
}

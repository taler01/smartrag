import React, { useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Document as DocType, Role, ROLE_LABELS, UserRole } from '../types';
import { uploadDocument, getDocumentContent, getPDFPageContent, getPublicDocuments, getPersonalDocuments, DocumentUploadResponse, DocumentContentResponse } from '../services/apiService';
import { Document as PDFDocument, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { renderAsync } from 'docx-preview';
import '../src/styles/docx-preview.css';

// 配置PDF.js worker
import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface DocumentManagerProps {
  documents: DocType[];
  onAddDocument: (doc: DocType) => void;
  onRemoveDocument: (id: string) => void;
  onRefreshDocuments: (type: 'public' | 'personal') => void; // 添加刷新文档回调
  userRole: string[]; // 改为role_codes数组
  availableRoles?: Role[]; // 添加可选的角色列表
  token: string; // 添加token参数
}

type KnowledgeBaseType = 'public' | 'personal';

// 格式化文件大小显示
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 字节';
  if (isNaN(bytes) || !isFinite(bytes)) return '0 字节';
  
  const k = 1024;
  const sizes = ['字节', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const DocumentManager: React.FC<DocumentManagerProps> = ({ documents, onAddDocument, onRemoveDocument, onRefreshDocuments, userRole, availableRoles = [], token }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [activeTab, setActiveTab] = useState<KnowledgeBaseType>('public');
  const [processingDocIds, setProcessingDocIds] = useState<Set<string>>(new Set());
  
  // 文档查看器相关状态
  const [viewingDocument, setViewingDocument] = useState<DocType | null>(null);
  const [documentContent, setDocumentContent] = useState<DocumentContentResponse | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  
  // PDF相关状态
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [visiblePages, setVisiblePages] = useState<number[]>([]); // 当前可见的页面
  const [loadedPages, setLoadedPages] = useState<{ [page: number]: string }>({}); // 已加载的页面数据
  const [loadingPages, setLoadingPages] = useState<{ [page: number]: boolean }>({}); // 正在加载的页面
  const [loadingProgress, setLoadingProgress] = useState<number>(0); // 加载进度百分比
  
  // Word文档相关状态
  const wordDocContainerRef = useRef<HTMLDivElement>(null);
  
  // 公共知识库权限选择
  const [publicPermissions, setPublicPermissions] = useState<string[]>([]);
  // 个人知识库权限选择（仅自己可见）
  const [personalPermissions, setPersonalPermissions] = useState<string[]>(userRole);
  
  // 文件夹上传相关状态
  const [uploadProgress, setUploadProgress] = useState<{ [filename: string]: { success: boolean; message: string } }>({});
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  useEffect(() => {
    // 设置公共知识库默认权限 - 用户只能选择自己的部门
    setPublicPermissions(userRole);
  }, [userRole]);

  const togglePublicPermission = (roleCode: string) => {
    setPublicPermissions(prev => 
      prev.includes(roleCode) ? prev.filter(r => r !== roleCode) : [...prev, roleCode]
    );
  };

  const togglePersonalPermission = (roleCode: string) => {
    setPersonalPermissions(prev => 
      prev.includes(roleCode) ? prev.filter(r => r !== roleCode) : [...prev, roleCode]
    );
  };

  const showError = (message: string) => {
    setErrorModalMessage(message);
    setShowErrorModal(true);
    setTimeout(() => setShowErrorModal(false), 5000);
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>, type: KnowledgeBaseType) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentPermissions = type === 'public' ? publicPermissions : personalPermissions;
    
    if (type === 'public' && currentPermissions.length === 0) {
      setActiveTab('personal');
      showError("已自动切换到个人知识库上传");
      return;
    }
    
    if (type === 'public' && !currentPermissions.some(permission => userRole.includes(permission))) {
      setActiveTab('personal');
      showError("已自动切换到个人知识库上传");
      return;
    }

    setIsUploading(true);
    setShowUploadProgress(true);
    setUploadProgress({});

    try {
      const fileArray = Array.from(files) as File[];
      const allowedExtensions = ['.txt', '.md', '.json', '.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg'];
      
      const validFiles = fileArray.filter((file: File) => {
        if (!file.type && file.name.endsWith('/') || file.size === 0) {
          return false;
        }
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        return allowedExtensions.includes(fileExtension);
      });

      if (validFiles.length === 0) {
        showError("没有找到支持的文件类型");
        return;
      }

      const formData = new FormData();
      validFiles.forEach((file: File) => {
        const pureFilename = file.name.split('/').pop() || file.name.split('\\').pop() || file.name;
        formData.append('files', file, pureFilename);
      });
      formData.append('type', type);
      
      if (type === 'public') {
        const permissionIds = currentPermissions.map(role => {
          const roleCodeToId: Record<string, number> = {
            "ADMIN": 1,
            "R_AND_D": 2,
            "AFTER_SALES": 3,
            "PRE_SALES": 4,
            "QA": 5,
            "OPS": 6
          };
          return roleCodeToId[role] || 2;
        });
        formData.append('permissions', JSON.stringify(permissionIds));
      }

      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://10.168.27.191:9090'}/api/documents/upload-folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUploadProgress(result.results.reduce((acc: { [key: string]: { success: boolean; message: string } }, item: { filename: string; success: boolean; message: string }) => {
            acc[item.filename] = { success: item.success, message: item.message };
            return acc;
          }, {}));
          onRefreshDocuments(type);
          
          // 自动处理成功上传的文档
          const successfulUploads = result.results.filter((item: { success: boolean; document_id?: number; document_type?: string }) => 
            item.success && item.document_id
          );
          
          for (const upload of successfulUploads) {
            const doc: DocType = {
              id: upload.document_id.toString(),
              name: upload.filename,
              content: '',
              uploadDate: new Date(),
              size: 0,
              permissions: [],
              knowledgeBaseType: upload.document_type as 'public' | 'personal',
              is_processed: false // 明确设置为未处理状态
            };
            await handleProcessDocument(doc);
          }
        } else {
          showError(result.message || "文件夹上传失败");
        }
      } else {
        const errorData = await response.json();
        showError(errorData.detail || errorData.message || "文件夹上传失败");
      }
    } catch (error) {
      console.error("文件夹上传失败:", error);
      showError(error instanceof Error ? error.message : "文件夹上传失败");
    } finally {
      setIsUploading(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
      setTimeout(() => setShowUploadProgress(false), 3000);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: KnowledgeBaseType) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentPermissions = type === 'public' ? publicPermissions : personalPermissions;
    
    if (type === 'public' && currentPermissions.length === 0) {
      // 如果用户没有勾选任何部门角色，自动切换到个人知识库
      setActiveTab('personal');
      showError("已自动切换到个人知识库上传");
      return;
    }
    
    // 对于公共知识库，如果用户没有勾选本部门，自动切换到个人知识库
    if (type === 'public' && !currentPermissions.some(permission => userRole.includes(permission))) {
      setActiveTab('personal');
      showError("已自动切换到个人知识库上传");
      return;
    }

    setIsUploading(true);

    try {
      // 逐个处理文件
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 跳过文件夹
        if (!file.type && file.name.endsWith('/') || file.size === 0) {
          console.log(`跳过文件夹: ${file.name}`);
          continue;
        }
        
        // 验证文件类型
        const allowedExtensions = ['.txt', '.md', '.json', '.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
          showError(`不支持的文件类型: ${fileExtension}。支持的类型: ${allowedExtensions.join(', ')}`);
          continue;
        }
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        formData.append('title', file.name);
        
        // 如果是公共文件，添加权限信息
        if (type === 'public') {
          // 将角色代码转换为角色ID
          const permissionIds = currentPermissions.map(role => {
            const roleCodeToId: Record<string, number> = {
              "ADMIN": 1,
              "R_AND_D": 2,
              "AFTER_SALES": 3,
              "PRE_SALES": 4,
              "QA": 5,
              "OPS": 6
            };
            return roleCodeToId[role] || 2; // 默认研发工程师
          });
          formData.append('permissions', JSON.stringify(permissionIds));
        }
        
        // 调用上传API
        const response = await uploadDocument(formData, token);
        
        // 添加详细的调试日志
        console.log('=== DocumentManager 上传响应调试 ===');
        console.log('1. API响应:', response);
        console.log('2. response.file_size:', response.file_size);
        console.log('3. response.file_size类型:', typeof response.file_size);
        console.log('4. response.file_size是否存在:', 'file_size' in response);
        
        if (response.success) {
          // 创建前端文档对象
          const newDoc: DocType = {
            id: response.document_id.toString(),
            name: response.filename,
            content: '', // 内容不需要存储在前端
            uploadDate: new Date(),
            size: response.file_size || 0, // 使用从API返回的实际文件大小
            permissions: response.permissions?.roles || [],
            knowledgeBaseType: type,
            is_processed: false // 明确设置为未处理状态
          };
          
          console.log('5. 创建的文档对象:', newDoc);
          console.log('6. newDoc.size:', newDoc.size);
          console.log('7. newDoc.size类型:', typeof newDoc.size);
          console.log('=== DocumentManager 调试结束 ===');
          
          // 添加到文档列表
          onAddDocument(newDoc);
          
          // 自动调用处理接口
          await handleProcessDocument(newDoc);
        } else {
          showError(response.message || "文件上传失败");
        }
      }
    } catch (error) {
      console.error("文件上传失败:", error);
      showError(error instanceof Error ? error.message : "文件上传失败");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 处理查看文档内容
  const handleViewDocument = async (document: DocType) => {
    setViewingDocument(document);
    setContentError(null);
    setIsLoadingContent(true);
    setDocumentContent(null);
    
    // 重置PDF状态
    setNumPages(null);
    setPageNumber(1);
    setPdfScale(1.0);
    
    // 清空Word文档容器
    if (wordDocContainerRef.current) {
      wordDocContainerRef.current.innerHTML = '';
    }
    
    try {
      // 对于PDF文件，直接加载第一页，而不是整个文件
      if (document.name.match(/\.pdf$/i)) {
        // 立即加载第一页
        const firstPageContent = await getPDFPageContent(
          document.knowledgeBaseType as 'public' | 'personal',
          parseInt(document.id),
          1,
          token
        );
        
        // 处理第一页数据
        const base64Match = firstPageContent.content.match(/Base64编码: ([\s\S]*)/);
        if (base64Match) {
          setLoadedPages(prev => ({ ...prev, 1: base64Match[1] }));
        }
        
        // 从第一页内容中提取基本信息
        setDocumentContent(firstPageContent);
        
        // 提取页数信息
        const pageMatch = firstPageContent.content.match(/页数: (\d+)/);
        if (pageMatch) {
          const totalPages = parseInt(pageMatch[1]);
          setNumPages(totalPages);
          setVisiblePages([1, 2, 3].filter(page => page <= totalPages));
          
          // 预加载后续页面
          if (totalPages > 1) loadPDFPage(2);
          if (totalPages > 2) loadPDFPage(3);
        } else {
          // 如果无法从第一页获取页数，设置默认值
          setNumPages(1);
          setVisiblePages([1]);
        }
      } else {
        // 对于其他文件类型，保持原有逻辑
        const content = await getDocumentContent(
          document.knowledgeBaseType as 'public' | 'personal',
          parseInt(document.id),
          token
        );
        setDocumentContent(content);
        
        // 如果是Word文档，渲染原始格式
        if (document.name.match(/\.(docx|doc)$/i) && content.content.includes('[Word文档]') && content.content.includes('Base64编码:')) {
          try {
            // 更精确地提取Base64数据
            const base64Match = content.content.match(/Base64编码:\s*([A-Za-z0-9+/=]+)/);
            if (!base64Match || !base64Match[1]) {
              throw new Error('无法找到有效的Base64数据');
            }
            
            let base64Data = base64Match[1];
            console.log('Base64数据长度:', base64Data.length);
            
            // 清理Base64数据，移除换行符和空格
            const cleanBase64Data = base64Data.replace(/\s+/g, '');
            
            // 验证Base64格式
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64Data)) {
              throw new Error('Base64数据包含无效字符');
            }
            
            // 检查Base64数据长度是否合理（至少几百字节）
            if (cleanBase64Data.length < 100) {
              throw new Error('Base64数据长度过短，可能不完整');
            }
            
            console.log('清理后的Base64数据长度:', cleanBase64Data.length);
            console.log('Base64数据前50字符:', cleanBase64Data.substring(0, 50));
            
            // 使用更安全的base64解码方法
            const binaryString = atob(cleanBase64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            console.log('解码后的字节数:', bytes.length);
            
            const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            
            if (wordDocContainerRef.current) {
              // 清空容器内容
              wordDocContainerRef.current.innerHTML = '';
              
              renderAsync(blob, wordDocContainerRef.current, null, {
                className: 'docx-container',
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
                ignoreFonts: false,
                breakPages: true,
                experimental: false,
              }).then(() => {
                console.log('Word文档渲染完成');
              }).catch((error) => {
                console.error('Word文档渲染失败:', error);
              });
            }
          } catch (error) {
            console.error('Word文档Base64解码失败:', error);
            console.error('原始内容:', content.content.substring(0, 500)); // 只显示前500字符
          }
        }
      }
    } catch (error) {
      console.error("获取文档内容失败:", error);
      setContentError(error instanceof Error ? error.message : "获取文档内容失败");
    } finally {
      setIsLoadingContent(false);
    }
  };
  
  // PDF加载成功回调
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    // 初始化可见页面，默认显示前几页
    setVisiblePages([1, 2, 3].filter(page => page <= numPages));
    
    // 预加载前几页
    if (viewingDocument && numPages > 0) {
      loadPDFPage(1); // 立即加载第一页
      if (numPages > 1) loadPDFPage(2); // 预加载第二页
      if (numPages > 2) loadPDFPage(3); // 预加载第三页
    }
  };

  // 加载单个PDF页面
  const loadPDFPage = async (pageNum: number) => {
    if (!viewingDocument || loadingPages[pageNum] || loadedPages[pageNum]) return;
    
    setLoadingPages(prev => ({ ...prev, [pageNum]: true }));
    
    try {
      const content = await getPDFPageContent(
        viewingDocument.knowledgeBaseType as 'public' | 'personal',
        parseInt(viewingDocument.id),
        pageNum,
        token
      );
      
      // 提取Base64编码的PDF数据
      const base64Match = content.content.match(/Base64编码: ([\s\S]*)/);
      if (base64Match) {
        setLoadedPages(prev => ({ 
          ...prev, 
          [pageNum]: base64Match[1] 
        }));
        
        // 更新加载进度
        if (numPages) {
          const loadedCount = Object.keys({ ...loadedPages, [pageNum]: base64Match[1] }).length;
          const progress = Math.round((loadedCount / numPages) * 100);
          setLoadingProgress(progress);
        }
      }
    } catch (error) {
      console.error(`加载PDF第${pageNum}页失败:`, error);
    } finally {
      setLoadingPages(prev => ({ ...prev, [pageNum]: false }));
    }
  };
  
  // 切换PDF页面
  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => Math.min(Math.max(1, prevPageNumber + offset), numPages || 1));
  };
  
  // 缩放PDF
  const changeScale = (delta: number) => {
    setPdfScale(prevScale => Math.min(Math.max(0.5, prevScale + delta), 3.0));
  };

  // 关闭文档查看器
  const closeDocumentViewer = () => {
    setViewingDocument(null);
    setDocumentContent(null);
    setContentError(null);
  };

  // 处理文档
  const handleProcessDocument = async (doc: DocType) => {
    if (doc.is_processed || processingDocIds.has(doc.id)) return;
    
    setProcessingDocIds(prev => new Set(prev).add(doc.id));
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://10.168.27.191:9090'}/api/documents/${doc.knowledgeBaseType}/${doc.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 开始轮询文档处理状态
          pollDocumentStatus(doc);
        } else {
          showError(result.message || '文档处理失败');
          setProcessingDocIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(doc.id);
            return newSet;
          });
        }
      } else {
        const errorData = await response.json();
        showError(errorData.detail || errorData.message || '文档处理失败');
        setProcessingDocIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(doc.id);
          return newSet;
        });
      }
    } catch (error) {
      console.error('文档处理失败:', error);
      showError('文档处理功能暂未实现，请稍后再试');
      setProcessingDocIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  // 轮询文档处理状态
  const pollDocumentStatus = async (doc: DocType) => {
    const maxAttempts = 10;
    const pollInterval = 30000; // 30秒
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      try {
        console.log(`=== 第${attempt + 1}次查询文档状态 ===`, { docId: doc.id, docName: doc.name });
        
        // 直接从后端获取最新文档状态
        let updatedDoc;
        if (doc.knowledgeBaseType === 'public') {
          const docs = await getPublicDocuments(token);
          console.log('公共文档列表:', docs);
          updatedDoc = docs.find(d => d.id === parseInt(doc.id));
        } else {
          const docs = await getPersonalDocuments(token);
          console.log('个人文档列表:', docs);
          updatedDoc = docs.find(d => d.id === parseInt(doc.id));
        }
        
        console.log('找到的文档:', updatedDoc);
        
        // 检查文档状态
        if (updatedDoc && updatedDoc.is_processed) {
          console.log('文档处理完成，更新状态');
          setProcessingDocIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(doc.id);
            return newSet;
          });
          onRefreshDocuments(doc.knowledgeBaseType as 'public' | 'personal');
          return;
        } else {
          console.log('文档未处理完成，继续轮询', { 
            hasDoc: !!updatedDoc, 
            isProcessed: updatedDoc?.is_processed 
          });
        }
      } catch (error) {
        console.error(`第${attempt + 1}次查询文档状态失败:`, error);
        if (attempt === maxAttempts - 1) {
          setProcessingDocIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(doc.id);
            return newSet;
          });
          showError('文档处理超时，请稍后查看');
        }
      }
    }
    
    setProcessingDocIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(doc.id);
      return newSet;
    });
    showError('文档处理超时，请稍后查看');
  };

  const rolesList = Object.values(UserRole);
  
  // 检查是否是管理员（检查是否包含"ADMIN"角色代码）
  const isAdmin = userRole.includes("ADMIN");
  
  // userRole已经是角色代码数组，不需要转换
  const userRoleCodes = userRole;

  // 按知识库类型过滤文档
  const publicDocuments = documents.filter(doc => doc.knowledgeBaseType === 'public');
  const personalDocuments = documents.filter(doc => doc.knowledgeBaseType === 'personal');

  const renderDocumentCard = (doc: DocType) => {
    // 添加调试日志
    console.log('=== 渲染文档卡片调试 ===', {
      docId: doc.id,
      docName: doc.name,
      docSize: doc.size,
      docSizeType: typeof doc.size,
      formattedSize: formatBytes(doc.size)
    });

    return (
    <div key={doc.id} className="group bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-all relative">
      
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-lg ${doc.knowledgeBaseType === 'public' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => handleViewDocument(doc)}
            className="text-slate-300 hover:text-blue-500 transition-colors p-1"
            title="查看文档内容"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={() => handleProcessDocument(doc)}
            disabled={doc.is_processed || processingDocIds.has(doc.id)}
            className={`transition-colors p-1 ${
              doc.is_processed 
                ? 'text-slate-300 cursor-not-allowed' 
                : processingDocIds.has(doc.id)
                  ? 'text-blue-500 animate-pulse'
                  : 'text-slate-300 hover:text-blue-500'
            }`}
            title={doc.is_processed ? '已处理' : '处理文档'}
          >
            {processingDocIds.has(doc.id) ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            )}
          </button>
          {isAdmin && (
            <button
              onClick={() => onRemoveDocument(doc.id)}
              className="text-slate-300 hover:text-red-500 transition-colors p-1"
              title="删除文档"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <h3 className="font-semibold text-slate-800 truncate mb-1" title={doc.name}>{doc.name}</h3>
      <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 pb-3 border-b border-slate-50">
         <span>{formatBytes(doc.size)}</span>
         <span>•</span>
         <span>{doc.uploadDate.toLocaleDateString()}</span>
         <span>•</span>
         <span className={`px-2 py-0.5 text-xs rounded-full ${
           processingDocIds.has(doc.id)
             ? 'bg-yellow-100 text-yellow-700'
             : doc.is_processed 
               ? 'bg-green-100 text-green-700' 
               : 'bg-red-100 text-red-700'
         }`}>
           {processingDocIds.has(doc.id)
             ? '处理中' 
             : doc.is_processed ? '已处理' : '未处理'}
         </span>
      </div>
      
      <div className="mt-3">
         <div className="text-[10px] uppercase text-slate-400 font-bold mb-1 tracking-wider">可见部门</div>
         <div className="flex flex-wrap gap-1">
           {doc.permissions.map(roleId => {
             // 将角色ID转换为角色代码
             const roleIdToCode: Record<number, string> = {
               1: "ADMIN",
               2: "R_AND_D", 
               3: "AFTER_SALES",
               4: "PRE_SALES",
               5: "QA",
               6: "OPS"
             };
             const roleCode = roleIdToCode[roleId] || "R_AND_D";
             return (
               <span key={roleId} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                 {ROLE_LABELS[roleCode]}
               </span>
             );
           })}
         </div>
      </div>
      
      <div className="mt-2">
        <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
          doc.knowledgeBaseType === 'public' 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {doc.knowledgeBaseType === 'public' ? '公共知识库' : '个人知识库'}
        </span>
      </div>
    </div>
    );
  };

  const renderUploadSection = (type: KnowledgeBaseType) => {
    const isPublic = type === 'public';
    const currentPermissions = isPublic ? publicPermissions : personalPermissions;
    const togglePermission = isPublic ? togglePublicPermission : togglePersonalPermission;
    
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {isPublic ? '公共知识库' : '个人知识库'} - 上传文档
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {isPublic 
                ? '上传共享文档，设置可见部门范围' 
                : '上传个人文档，仅自己可见'
              }
            </p>
          </div>
          
          <div className="flex gap-2">
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e, type)}
              accept=".txt,.md,.json,.csv,.pdf,.docx,.doc,.png,.jpg,.jpeg,.gif,.bmp,.svg"
              className="hidden"
            />
            <button
              onClick={() => {
                if (isPublic && currentPermissions.length === 0) {
                  setActiveTab('personal');
                  showError("已自动切换到个人知识库上传");
                  return;
                }
                if (isPublic && !currentPermissions.some(perm => userRoleCodes.includes(perm))) {
                  setActiveTab('personal');
                  showError("已自动切换到个人知识库上传");
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={isUploading}
              className={`flex items-center gap-2 text-white px-5 py-2.5 rounded-lg transition-colors font-medium shadow-lg ${
                isPublic 
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' 
                  : 'bg-green-600 hover:bg-green-700 shadow-green-200'
              }`}
            >
              {isUploading ? '上传中...' : '上传文档'}
            </button>
            
            <input
              type="file"
              ref={folderInputRef}
              onChange={(e) => handleFolderChange(e, type)}
              webkitdirectory="true"
              directory="true"
              className="hidden"
            />
            <button
              onClick={() => {
                if (isPublic && currentPermissions.length === 0) {
                  setActiveTab('personal');
                  showError("已自动切换到个人知识库上传");
                  return;
                }
                if (isPublic && !currentPermissions.some(perm => userRoleCodes.includes(perm))) {
                  setActiveTab('personal');
                  showError("已自动切换到个人知识库上传");
                  return;
                }
                folderInputRef.current?.click();
              }}
              disabled={isUploading}
              className="flex items-center gap-2 text-white px-5 py-2.5 rounded-lg transition-colors font-medium shadow-lg bg-purple-600 hover:bg-purple-700 shadow-purple-200"
            >
              上传文件夹
            </button>
          </div>
        </div>

        {/* Upload Progress Modal */}
        {showUploadProgress && Object.keys(uploadProgress).length > 0 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-lg font-bold text-slate-800">上传进度</h4>
                <button 
                  onClick={() => setShowUploadProgress(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                  title="关闭"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <div className="space-y-2">
                  {Object.entries(uploadProgress).map(([filename, result]: [string, { success: boolean; message: string }]) => (
                    <div key={filename} className="flex items-center justify-between text-sm p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <span className="truncate flex-1 mr-3 text-slate-700" title={filename}>{filename}</span>
                      <span className={`flex items-center gap-1.5 font-medium ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                        {result.success ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {result.success ? '成功' : result.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
                <button 
                  onClick={() => setShowUploadProgress(false)}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Modal */}
        {showErrorModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-lg font-bold text-slate-800">提示</h4>
                <button 
                  onClick={() => setShowErrorModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                  title="关闭"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <p className="text-slate-700">{errorModalMessage}</p>
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => setShowErrorModal(false)}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permission Selector - Only show for public knowledge base */}
        {isPublic && (
          <div className="bg-slate-50 p-4 rounded-lg">
              <span className="text-sm font-bold text-slate-700 block mb-2">设置文档可见范围:</span>
            <div className="flex flex-wrap gap-3">
              {rolesList.filter(role => role !== UserRole.ADMIN).map(role => {
                const isUserOwnRole = userRoleCodes.includes(role);
                const isDisabled = !isUserOwnRole && !isAdmin;
                
                return (
                  <label 
                    key={role} 
                    className={`flex items-center gap-2 select-none ${
                      isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      currentPermissions.includes(role) 
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-slate-300 bg-white'
                    } ${isDisabled ? 'opacity-50' : ''}`}>
                      {currentPermissions.includes(role) && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={currentPermissions.includes(role)} 
                      onChange={() => !isDisabled && togglePermission(role)} 
                      disabled={isDisabled}
                    />
                    <span className={`text-sm ${
                      currentPermissions.includes(role) 
                        ? 'text-blue-700 font-medium'
                        : 'text-slate-600'
                    }`}>
                      {ROLE_LABELS[role]}
                      {isUserOwnRole && (
                        <span className="ml-1 text-xs text-blue-600" title="取消勾选将切换到个人知识库">(本部门)</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 文档内容查看器组件
  const renderDocumentViewer = () => {
    if (!viewingDocument) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
          {/* 查看器头部 */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${viewingDocument.knowledgeBaseType === 'public' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">{viewingDocument.name}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>{formatBytes(viewingDocument.size)}</span>
                  <span>•</span>
                  <span>{viewingDocument.uploadDate.toLocaleDateString()}</span>
                  <span>•</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    viewingDocument.knowledgeBaseType === 'public' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {viewingDocument.knowledgeBaseType === 'public' ? '公共知识库' : '个人知识库'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={closeDocumentViewer}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              title="关闭查看器"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 查看器内容 */}
          <div className="flex-1 overflow-auto p-4">
            {isLoadingContent ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-slate-500">正在加载文档内容...</p>
                </div>
              </div>
            ) : contentError ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center text-red-600">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>{contentError}</p>
                </div>
              </div>
            ) : documentContent ? (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="mb-3 text-xs text-slate-500 border-b border-slate-200 pb-2">
                  共 {documentContent.line_count} 行，{formatBytes(documentContent.file_size)}
                </div>
                
                {/* 检查是否是图片文件 */}
                {viewingDocument.name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i) ? (
                  <div className="space-y-4">
                    {/* 尝试渲染图片 */}
                    {documentContent.content.includes('[图片信息]') && documentContent.content.includes('Base64编码:') ? (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h4 className="font-medium text-blue-800 mb-2">图片信息</h4>
                          <div className="text-sm text-blue-700">
                            {documentContent.content.split('\n').slice(0, -1).join('\n')}
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <img 
                            src={`data:image/${viewingDocument.name.split('.').pop()?.toLowerCase()};base64,${
                              documentContent.content.split('Base64编码:')[1]
                            }`}
                            alt={viewingDocument.name}
                            className="max-w-full max-h-96 border border-slate-200 rounded-lg shadow-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-yellow-800">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span>无法显示图片内容</span>
                        </div>
                        <div className="mt-2 text-sm text-yellow-700">
                          请检查图片文件格式是否正确
                        </div>
                      </div>
                    )}
                  </div>
                ) : viewingDocument.name.match(/\.(docx|doc)$/i) ? (
                      <div className="space-y-4">
                    {documentContent.content.includes('[Word文档]') && documentContent.content.includes('Base64编码:') ? (
                      <>
                        {/* Word文档信息 */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h4 className="font-medium text-blue-800 mb-2">Word文档信息</h4>
                          <div className="text-sm text-blue-700">
                            {documentContent.content.split('\n').slice(0, -1).join('\n')}
                          </div>
                        </div>
                        
                        {/* Word文档渲染区域 */}
                        <div className="border border-slate-200 rounded-lg bg-white p-4 overflow-auto" style={{ minHeight: '500px' }}>
                          <div 
                            ref={wordDocContainerRef}
                            className="docx-preview-container"
                            style={{ maxWidth: '100%', margin: '0 auto' }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-yellow-800">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span>无法显示Word文档内容</span>
                        </div>
                        <div className="mt-2 text-sm text-yellow-700">
                          请检查Word文档格式是否正确
                        </div>
                      </div>
                    )}
                  </div>
                ) : viewingDocument.name.match(/\.pdf$/i) ? (
                  /* PDF文件渲染 */
                  <div className="space-y-4">
                    {documentContent.content.includes('[PDF文档]') && documentContent.content.includes('Base64编码:') ? (
                      <>
                        {/* PDF控制栏 */}
                        <div className="flex items-center justify-between bg-slate-100 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => changePage(-1)}
                              disabled={pageNumber <= 1}
                              className="px-3 py-1 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              上一页
                            </button>
                            <span className="text-sm text-slate-600">
                              第 {pageNumber} 页 / 共 {numPages || '?'} 页
                            </span>
                            <button
                              onClick={() => changePage(1)}
                              disabled={numPages ? pageNumber >= numPages : true}
                              className="px-3 py-1 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              下一页
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => changeScale(-0.25)}
                              className="px-3 py-1 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              缩小
                            </button>
                            <span className="text-sm text-slate-600">
                              {Math.round(pdfScale * 100)}%
                            </span>
                            <button
                              onClick={() => changeScale(0.25)}
                              className="px-3 py-1 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              放大
                            </button>
                          </div>
                        </div>
                        
                        {/* PDF文档信息 */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h4 className="font-medium text-blue-800 mb-2">PDF文档信息</h4>
                          <div className="text-sm text-blue-700">
                            {documentContent.content.split('\n').slice(0, -1).join('\n')}
                          </div>
                        </div>
                        
                        {/* PDF渲染区域 - 智能懒加载 */}
                        <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                          {/* 加载进度指示器 */}
                          {numPages && loadingProgress < 100 && (
                            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                              <div className="flex items-center justify-between text-sm text-blue-700">
                                <span>PDF加载进度: {loadingProgress}%</span>
                                <span>
                                  {Object.keys(loadedPages).length}/{numPages} 页已加载
                                </span>
                              </div>
                              <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${loadingProgress}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                          
                          <div 
                            className="max-h-96 overflow-y-auto p-4"
                            onScroll={(e) => {
                              // 智能滚动检测，动态加载页面
                              const container = e.currentTarget;
                              const scrollTop = container.scrollTop;
                              const containerHeight = container.clientHeight;
                              
                              if (numPages) {
                                // 计算当前可见的页面范围
                                const pageHeight = 800 * pdfScale; // 估算页面高度
                                const startPage = Math.max(1, Math.floor(scrollTop / pageHeight) - 1);
                                const endPage = Math.min(numPages, Math.ceil((scrollTop + containerHeight) / pageHeight) + 1);
                                
                                const newVisiblePages = [];
                                for (let i = startPage; i <= endPage; i++) {
                                  newVisiblePages.push(i);
                                }
                                setVisiblePages(newVisiblePages);
                                
                                // 动态加载可见页面
                                newVisiblePages.forEach(pageNum => {
                                  if (!loadedPages[pageNum] && !loadingPages[pageNum]) {
                                    loadPDFPage(pageNum);
                                  }
                                });
                              }
                            }}
                          >
                            {/* 分页渲染PDF */}
                            {documentContent && documentContent.content && (
                              visiblePages.length > 0 ? (
                                visiblePages.map(pageNum => (
                                  <div key={`page_${pageNum}`} className="mb-4 last:mb-0">
                                    <div className="text-xs text-slate-500 mb-1">
                                      第 {pageNum} 页 
                                      {loadingPages[pageNum] && (
                                        <span className="ml-2 text-blue-500">加载中...</span>
                                      )}
                                      {loadedPages[pageNum] && (
                                        <span className="ml-2 text-green-500">✓ 已加载</span>
                                      )}
                                    </div>
                                    
                                    {loadedPages[pageNum] ? (
                                      <PDFDocument
                                        file={`data:application/pdf;base64,${loadedPages[pageNum]}`}
                                        loading={<div className="text-center py-4 text-slate-400">渲染第 {pageNum} 页...</div>}
                                        error={<div className="text-center py-4 text-red-500">第 {pageNum} 页渲染失败</div>}
                                        className="pdf-document"
                                      >
                                        <Page 
                                          pageNumber={1} // 单页PDF总是第一页
                                          scale={pdfScale}
                                          renderTextLayer={true}
                                          renderAnnotationLayer={true}
                                          className="pdf-page border border-slate-200 bg-white"
                                          loading={<div className="text-center py-4 text-slate-400">渲染第 {pageNum} 页...</div>}
                                        />
                                      </PDFDocument>
                                    ) : (
                                      <div className="flex items-center justify-center h-64 bg-slate-100 border border-slate-200 rounded">
                                        {loadingPages[pageNum] ? (
                                          <div className="text-center">
                                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                            <p className="mt-2 text-sm text-slate-500">正在加载第 {pageNum} 页...</p>
                                          </div>
                                        ) : (
                                          <div className="text-center text-slate-400">
                                            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-sm">点击滚动区域加载第 {pageNum} 页</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                // 初始加载时显示第一页
                                <div className="mb-4">
                                  <div className="text-xs text-slate-500 mb-1">第 1 页</div>
                                  {loadedPages[1] ? (
                                    <PDFDocument
                                      file={`data:application/pdf;base64,${loadedPages[1]}`}
                                      loading={<div className="text-center py-4 text-slate-400">渲染第 1 页...</div>}
                                      error={<div className="text-center py-4 text-red-500">第 1 页渲染失败</div>}
                                      className="pdf-document"
                                    >
                                      <Page 
                                        pageNumber={1} // 单页PDF总是第一页
                                        scale={pdfScale}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                        className="pdf-page border border-slate-200 bg-white"
                                        loading={<div className="text-center py-4 text-slate-400">渲染第 1 页...</div>}
                                      />
                                    </PDFDocument>
                                  ) : (
                                    <div className="flex items-center justify-center h-64 bg-slate-100 border border-slate-200 rounded">
                                      <div className="text-center">
                                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                        <p className="mt-2 text-sm text-slate-500">正在加载第 1 页...</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-64 bg-slate-100 border border-slate-200 rounded">
                        <div className="text-center text-slate-400">
                          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm">正在加载PDF内容...</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 对于Markdown文件，使用react-markdown渲染 */
                  viewingDocument.name.match(/\.md$/i) ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          img: ({src, alt, ...props}) => {
                            // 如果是相对路径，尝试转换为绝对路径
                            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                              // 这里可以添加图片路径处理逻辑
                              return <img src={src} alt={alt} {...props} className="max-w-full h-auto border border-slate-200 rounded" />;
                            }
                            return <img src={src} alt={alt} {...props} className="max-w-full h-auto border border-slate-200 rounded" />;
                          }
                        }}
                      >
                        {documentContent.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    /* 对于其他文本文件，按行显示 */
                    <div className="space-y-1">
                      {documentContent.lines.map((line, index) => (
                        <div key={index} className="flex hover:bg-slate-100 rounded">
                          <span className="text-slate-400 text-right pr-3 select-none" style={{ minWidth: '2.5rem' }}>
                            {index + 1}
                          </span>
                          <span className="text-slate-700 whitespace-pre-wrap break-all">{line || ' '}</span>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">知识库管理</h2>
            <p className="text-sm text-slate-500 mt-1">
              管理部门知识库和个人知识文档
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => {
              setActiveTab('public');
              onRefreshDocuments('public');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'public'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            公共知识库
          </button>
          <button
            onClick={() => {
              setActiveTab('personal');
              onRefreshDocuments('personal');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'personal'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            个人知识库
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Upload Section */}
        {renderUploadSection(activeTab)}

        {/* Documents List */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            {activeTab === 'public' ? '公共知识库文档' : '个人知识库文档'} 
            <span className="text-sm font-normal text-slate-500 ml-2">
              ({activeTab === 'public' ? publicDocuments.length : personalDocuments.length} 个文档)
            </span>
          </h3>
          
          {activeTab === 'public' && publicDocuments.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
              <div className="bg-white p-4 rounded-full mb-4">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-medium">暂无部门知识库文档</p>
              <p className="text-sm">上传文档以构建部门知识库</p>
            </div>
          ) : activeTab === 'personal' && personalDocuments.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
              <div className="bg-white p-4 rounded-full mb-4">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-lg font-medium">暂无个人知识文档</p>
              <p className="text-sm">上传文档以构建个人知识库</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(activeTab === 'public' ? publicDocuments : personalDocuments).map(renderDocumentCard)}
            </div>
          )}
        </div>
      </div>
      
      {/* 文档内容查看器 */}
      {renderDocumentViewer()}
    </div>
  );
};

export default DocumentManager;
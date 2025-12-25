# 🚀 SmartRAG - 智能知识库系统

> 让知识触手可及，让对话更加智能！

---

## ✨ 项目简介

SmartRAG 是一个基于 RAG（Retrieval-Augmented Generation）技术的智能知识库系统，它能够理解你的文档，并基于文档内容进行智能问答。无论是技术文档、产品手册，还是个人笔记，SmartRAG 都能帮你快速找到答案！

![系统架构](https://via.placeholder.com/800x400/4A90E2/FFFFFF?text=SmartRAG+Architecture)

---

## 🎯 核心功能

### 📚 文档管理
- 支持多种格式：PDF、Word、TXT 等
- 智能去重：相同文件只存储一份
- 分类管理：公共文档 & 个人文档
- 在线预览：无需下载即可查看内容

### 💬 智能对话
- 基于 RAG 技术的精准问答
- 流式输出：实时显示 AI 回复
- 上下文记忆：记住之前的对话内容
- 热门问题推荐：快速找到常见问题

### 🔐 用户系统
- 邮箱验证注册
- 密码重置功能
- 角色权限管理
- Token 自动刷新

### 📊 数据统计
- 热门搜索排行
- 文档访问统计
- 用户行为分析

---

## 🏗️ 技术架构

### 后端技术栈

```
┌─────────────────────────────────────────────────┐
│                  FastAPI                         │
│              (高性能异步框架)                      │
└─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   MySQL      │  │    Redis     │  │    MinIO     │
│  (数据存储)   │  │   (缓存)      │  │  (文件存储)   │
└──────────────┘  └──────────────┘  └──────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
              ┌──────────────────┐
              │  SiliconFlow LLM │
              │    (GLM-4)       │
              └──────────────────┘
```

**核心依赖：**
- `FastAPI` - 现代化的 Web 框架
- `SQLAlchemy` - ORM 数据库操作
- `Redis` - 缓存和会话管理
- `MinIO` - 对象存储服务
- `OpenAI` - LLM 接口调用

### 前端技术栈

```
┌─────────────────────────────────────────────────┐
│                  React 19                       │
│              (现代化 UI 框架)                     │
└─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ React Router │  │ React Markdown│  │   PDF.js     │
│  (路由管理)   │  │  (Markdown渲染)│  │  (PDF预览)   │
└──────────────┘  └──────────────┘  └──────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
              ┌──────────────────┐
              │     Vite         │
              │   (构建工具)      │
              └──────────────────┘
```

**核心依赖：**
- `React 19` - 用户界面框架
- `TypeScript` - 类型安全
- `Vite` - 快速构建工具
- `React Router` - 路由管理
- `docx-preview` - Word 文档预览
- `react-pdf` - PDF 文档预览

---

## 📁 项目结构

```
smartrag/
├── backend/                    # 后端服务
│   ├── app/
│   │   ├── models/            # 数据模型
│   │   │   ├── user.py       # 用户模型
│   │   │   ├── document.py   # 文档模型
│   │   │   ├── conversation.py # 对话模型
│   │   │   └── role.py       # 角色模型
│   │   ├── routers/          # API 路由
│   │   │   ├── auth.py       # 认证接口
│   │   │   ├── users.py      # 用户接口
│   │   │   ├── documents.py  # 文档接口
│   │   │   ├── chat.py       # 对话接口
│   │   │   └── conversations.py # 对话历史接口
│   │   ├── services/         # 业务逻辑
│   │   │   ├── auth_service.py
│   │   │   ├── file_storage.py
│   │   │   └── session_manager.py
│   │   ├── utils/            # 工具函数
│   │   │   ├── logger.py     # 日志系统
│   │   │   ├── security.py   # 安全工具
│   │   │   ├── redis_client.py
│   │   │   └── email_service.py
│   │   ├── schemas/          # 数据验证
│   │   ├── dependencies.py   # 依赖注入
│   │   ├── config.py         # 配置管理
│   │   └── database.py       # 数据库连接
│   ├── requirements.txt      # Python 依赖
│   └── run.py               # 启动入口
│
└── frontend/                  # 前端服务
    ├── src/
    │   ├── components/       # React 组件
    │   │   ├── Login.tsx
    │   │   ├── DocumentManager.tsx
    │   │   ├── SearchInterface.tsx
    │   │   ├── ConversationHistorySidebar.tsx
    │   │   ├── HotQuestions.tsx
    │   │   └── ProfilePage.tsx
    │   ├── services/         # API 服务
    │   │   ├── apiService.ts
    │   │   └── geminiService.ts
    │   ├── hooks/            # 自定义 Hooks
    │   │   ├── useStreamingChat.ts
    │   │   └── useTypewriter.ts
    │   └── styles/           # 样式文件
    ├── package.json          # Node 依赖
    ├── vite.config.ts        # Vite 配置
    └── tsconfig.json         # TypeScript 配置
```

---

## 🚀 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+
- MySQL 8.0+
- Redis 6.0+
- MinIO

### 后端启动

```bash
# 1. 进入后端目录
cd backend

# 2. 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入数据库、Redis、MinIO 等配置

# 5. 启动服务
python run.py
```

后端服务将在 `http://10.168.27.191:9090` 启动

### 前端启动

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

前端服务将在 `http://localhost:5173` 启动

---

## 🔧 配置说明

### 后端配置 (.env)

```env
# MySQL 数据库
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=rag

# Redis 缓存
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# MinIO 对象存储
MINIO_ENDPOINT=your_minio_endpoint
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_BUCKET=upload

# JWT 密钥
SECRET_KEY=your_secret_key

# SiliconFlow LLM
SILICONFLOW_API_KEY=your_api_key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=THUDM/GLM-4-9B-0414

# 邮件服务
MAIL_COUNT=your_email
MAIL_PASSWORD=your_email_password
MAIL_SERVER=smtp.feishu.cn
MAIL_PORT=465
```

---

## 📖 使用指南

### 1. 用户注册

访问系统首页，点击"注册"按钮，输入邮箱和密码。系统会发送验证码到你的邮箱，输入验证码即可完成注册。

### 2. 上传文档

登录后进入文档管理页面，点击"上传文档"按钮，支持拖拽上传。系统会自动解析文档内容并建立索引。

### 3. 智能问答

在搜索框输入问题，系统会基于你的文档内容进行智能回答。回答会引用相关文档片段，方便你追溯来源。

### 4. 对话历史

左侧侧边栏显示历史对话记录，点击即可查看之前的对话内容。

---

## 🎨 界面展示

### 登录页面
![登录页面](https://via.placeholder.com/600x400/6C5CE7/FFFFFF?text=Login+Page)

### 文档管理
![文档管理](https://via.placeholder.com/800x500/00CEC9/FFFFFF?text=Document+Manager)

### 智能对话
![智能对话](https://via.placeholder.com/800x500/FD79A8/FFFFFF?text=Chat+Interface)

---

## 🔐 安全特性

- **密码加密**：使用 bcrypt 加密存储
- **JWT 认证**：无状态的身份验证
- **Token 刷新**：自动刷新访问令牌
- **CORS 保护**：跨域请求控制
- **SQL 注入防护**：ORM 参数化查询
- **XSS 防护**：输入输出过滤

---

## 📊 性能优化

- **异步处理**：FastAPI 异步框架，高并发支持
- **Redis 缓存**：热点数据缓存，减少数据库压力
- **文件去重**：基于哈希的去重机制，节省存储空间
- **流式输出**：实时返回 AI 回复，提升用户体验
- **连接池**：数据库连接池管理，提高资源利用率

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📝 更新日志

### v1.0.0
- ✨ 初始版本发布
- 📚 文档上传与管理
- 💬 智能问答功能
- 🔐 用户认证系统
- 📊 热门问题推荐

---

## 🙏 致谢

感谢以下开源项目：

- [FastAPI](https://fastapi.tiangolo.com/) - 现代化的 Web 框架
- [React](https://react.dev/) - 用户界面库
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [SiliconFlow](https://siliconflow.cn/) - LLM API 服务

---

## 📮 联系方式

- 项目地址：[GitHub](https://github.com/taler01/smartrag)
- 问题反馈：[Issues](https://github.com/taler01/smartrag/issues)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**

Made with ❤️ by SmartRAG Team

</div>

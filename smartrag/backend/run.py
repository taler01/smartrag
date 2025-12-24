"""
SmartRAG Backend 启动脚本
"""
import uvicorn
import atexit
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.utils.logger import logger, setup_logging
from app.database import engine, Base
from app.routers import auth, users, chat, documents, conversations
from app.utils.redis_client import redis_client
from app.utils.email_service import email_service
from app.services.session_manager import user_session_manager

# 初始化日志系统
setup_logging()


def cleanup_resources():
    """清理资源，防止内存泄漏"""
    logger.info("开始清理应用资源...")
    
    try:
        # 关闭邮件服务
        if email_service:
            email_service.shutdown()
        
        # 清理Redis连接
        if redis_client:
            redis_client.close()
        
        logger.info("应用资源清理完成")
    except Exception as e:
        logger.error(f"资源清理过程中出错: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info("SmartRAG Backend 正在启动...")
    
    # 初始化会话管理器
    await user_session_manager.initialize()
    logger.info("会话管理器初始化完成")
    
    yield
    
    # 关闭时执行
    logger.info("SmartRAG Backend 正在关闭...")
    
    # 关闭会话管理器
    user_session_manager.close()
    logger.info("会话管理器已关闭")
    
    cleanup_resources()


# 创建数据库表
Base.metadata.create_all(bind=engine)


# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan
)


# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 注册路由
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(chat.router)
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(conversations.router)


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "SmartRAG Backend API",
        "version": settings.app_version
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


if __name__ == "__main__":
    # 注册清理函数，在应用关闭时调用
    atexit.register(cleanup_resources)
    
    # 启动服务器
    logger.info(f"启动服务器: {settings.app_name} v{settings.app_version}")
    uvicorn.run(
        "run:app", 
        host="10.168.27.191",
        port=9090,
        # workers=4,
        reload=settings.debug,
        log_config=None,  # 使用我们自定义的loguru日志系统
        access_log=False,  # 禁用uvicorn的访问日志，避免重复
    )
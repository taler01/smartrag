"""
日志配置模块
使用loguru作为统一的日志管理器
"""
import sys
import logging
from pathlib import Path
from loguru import logger
from app.config import settings


def setup_logging():
    """配置loguru日志系统"""
    # 移除默认的处理器
    logger.remove()
    
    # 控制台输出格式
    console_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )
    
    # 添加控制台处理器
    logger.add(
        sys.stdout,
        format=console_format,
        level="INFO" if not settings.debug else "DEBUG",
        colorize=True
    )
    
    # 创建日志目录
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # 文件输出格式（无颜色）
    file_format = (
        "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
        "{level: <8} | "
        "{name}:{function}:{line} - "
        "{message}"
    )
    
    # 添加常规日志文件处理器（所有级别的日志都写入此文件）
    logger.add(
        log_dir / "app.log",
        format=file_format,
        level="DEBUG" if settings.debug else "INFO",  # 根据环境设置日志级别
        rotation="10 MB",
        retention="30 days",
        compression="zip",
        encoding="utf-8"
    )
    
    # 拦截标准库的logging并重定向到loguru
    class InterceptHandler(logging.Handler):
        def emit(self, record):
            # 获取对应的loguru级别
            try:
                level = logger.level(record.levelname).name
            except ValueError:
                level = record.levelno

            # 找到调用栈的源头
            frame, depth = logging.currentframe(), 2
            while frame.f_code.co_filename == logging.__file__:
                frame = frame.f_back
                depth += 1

            logger.opt(depth=depth, exception=record.exc_info).log(
                level, record.getMessage()
            )
    
    # 配置标准库logging使用我们的拦截器
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    
    # 设置特定库的日志级别 - 禁用uvicorn的访问日志，避免重复
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"]:
        logging_logger = logging.getLogger(logger_name)
        logging_logger.handlers = [InterceptHandler()]
        # 禁用uvicorn的访问日志，避免重复记录
        if logger_name == "uvicorn.access":
            logging_logger.setLevel(logging.CRITICAL + 1)  # 完全禁用
    
    logger.info("日志系统初始化完成")


# 导出logger实例
__all__ = ["logger", "setup_logging"]
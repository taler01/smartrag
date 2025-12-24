"""
数据库连接管理
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from contextlib import contextmanager
from app.config import settings
from app.utils.logger import logger

# 创建MySQL数据库引擎，优化连接池配置
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=20,  # 连接池大小
    max_overflow=30,  # 最大溢出连接数
    pool_timeout=30,  # 获取连接超时时间
    echo=settings.debug
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建线程安全的会话
Session = scoped_session(SessionLocal)

# 创建基类
Base = declarative_base()


def get_db():
    """数据库依赖，确保会话正确关闭"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"数据库会话错误: {e}")
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def get_db_context():
    """数据库上下文管理器，用于非依赖注入场景"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        logger.error(f"数据库操作错误: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def close_db():
    """关闭所有数据库连接"""
    Session.remove()
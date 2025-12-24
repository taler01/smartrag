import smtplib
import threading
import queue
import time
from contextlib import contextmanager
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from app.utils.logger import logger
from app.config import settings


class EmailService:
    def __init__(self):
        self.mail_count = settings.mail_count
        self.mail_password = settings.mail_password
        self.mail_server = settings.mail_server
        self.mail_port = settings.mail_port
        
        logger.info(f"邮件服务初始化 - 服务器: {self.mail_server}, 端口: {self.mail_port}, 账号: {self.mail_count}")
        
        # 创建邮件连接池
        self.connection_pool = queue.Queue(maxsize=10)
        self.pool_lock = threading.Lock()
        
        # 邮件发送队列，支持异步发送
        self.email_queue = queue.Queue()
        self.worker_thread = None
        self.stop_worker = False
        
        # 启动邮件发送工作线程
        self._start_worker()
        
        logger.info("邮件服务初始化完成，连接池和异步发送已启用")
    
    def _start_worker(self):
        """启动邮件发送工作线程"""
        if self.worker_thread is None or not self.worker_thread.is_alive():
            self.stop_worker = False
            self.worker_thread = threading.Thread(target=self._email_worker, daemon=True)
            self.worker_thread.start()
            logger.info("邮件发送工作线程已启动")
    
    def _email_worker(self):
        """邮件发送工作线程"""
        while not self.stop_worker:
            try:
                # 从队列中获取邮件任务，最多等待1秒
                try:
                    email_task = self.email_queue.get(timeout=1)
                    self._send_email_sync(
                        email_task['to_email'], 
                        email_task['code'],
                        email_task.get('code_type', 'registration')
                    )
                    self.email_queue.task_done()
                except queue.Empty:
                    continue
            except Exception as e:
                logger.error(f"邮件发送工作线程错误: {e}")
    
    @contextmanager
    def _get_connection(self):
        """获取邮件连接"""
        connection = None
        try:
            # 尝试从连接池获取连接
            try:
                connection = self.connection_pool.get_nowait()
                # 检查连接是否仍然有效
                try:
                    connection.noop()  # 测试连接
                except smtplib.SMTPException:
                    connection = None
            except queue.Empty:
                pass
            
            # 如果没有可用连接，创建新连接
            if connection is None:
                if self.mail_port == 465:  # SSL
                    connection = smtplib.SMTP_SSL(self.mail_server, self.mail_port)
                else:  # TLS
                    connection = smtplib.SMTP(self.mail_server, self.mail_port)
                    connection.starttls()
                
                connection.login(self.mail_count, self.mail_password)
                logger.debug("创建新的邮件连接")
            
            yield connection
        except Exception as e:
            logger.error(f"获取邮件连接失败: {e}")
            raise
        finally:
            # 将连接返回连接池
            if connection:
                try:
                    # 如果连接池未满，将连接放回池中
                    self.connection_pool.put_nowait(connection)
                except queue.Full:
                    # 连接池已满，关闭连接
                    try:
                        connection.quit()
                    except:
                        pass
    
    def _send_email_sync(self, to_email: str, code: str, code_type: str = "registration") -> bool:
        """同步发送邮件"""
        try:
            # 根据code_type设置邮件主题和内容
            if code_type == "password_reset":
                subject = "SmartRAG 密码重置验证码"
                greeting = "您好！您正在重置 SmartRAG 账户密码"
                usage_instruction = "1. 请在密码重置页面输入上述 6 位数字验证码"
                header_color = "linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)"  # 红色渐变
                code_color = "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)"  # 粉色渐变
            else:  # registration
                subject = "SmartRAG 注册验证码"
                greeting = "您好！欢迎使用 SmartRAG 智能系统"
                usage_instruction = "1. 请在注册页面输入上述 6 位数字验证码"
                header_color = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"  # 蓝色渐变
                code_color = "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"  # 紫色渐变
            
            # 创建邮件对象
            msg = MIMEMultipart()
            msg['From'] = Header(f"SmartRAG <{self.mail_count}>", 'utf-8')
            msg['To'] = Header(to_email, 'utf-8')
            msg['Subject'] = Header(subject, 'utf-8')
            
            # 邮件正文
            body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>{subject}</title>
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: #f5f7fa;
                        margin: 0;
                        padding: 0;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 30px auto;
                        background-color: #ffffff;
                        border-radius: 12px;
                        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
                        overflow: hidden;
                    }}
                    .header {{
                        background: {header_color};
                        padding: 30px;
                        text-align: center;
                    }}
                    .header h1 {{
                        color: #ffffff;
                        font-size: 32px;
                        margin: 0;
                        font-weight: 700;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }}
                    .content {{
                        padding: 40px 30px;
                        text-align: center;
                    }}
                    .greeting {{
                        font-size: 18px;
                        color: #5a6c7d;
                        margin-bottom: 30px;
                    }}
                    .code-container {{
                        background: {code_color};
                        border-radius: 12px;
                        padding: 30px;
                        margin: 30px 0;
                        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
                        animation: pulse 2s infinite;
                    }}
                    @keyframes pulse {{
                        0% {{ transform: scale(1); }}
                        50% {{ transform: scale(1.05); }}
                        100% {{ transform: scale(1); }}
                    }}
                    .code {{
                        font-size: 42px;
                        font-weight: bold;
                        color: #ffffff;
                        letter-spacing: 8px;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        margin: 0;
                    }}
                    .info {{
                        background-color: #f8f9fa;
                        border-left: 4px solid #4a90e2;
                        padding: 20px;
                        margin: 30px 0;
                        border-radius: 0 8px 8px 0;
                        text-align: left;
                    }}
                    .info h3 {{
                        color: #4a90e2;
                        margin-top: 0;
                        font-size: 18px;
                    }}
                    .info p {{
                        color: #5a6c7d;
                        margin: 8px 0;
                        line-height: 1.6;
                    }}
                    .footer {{
                        background-color: #f5f7fa;
                        padding: 30px;
                        text-align: center;
                        color: #5a6c7d;
                        font-size: 14px;
                    }}
                    .logo {{
                        width: 120px;
                        height: 120px;
                        background: {header_color};
                        border-radius: 60px;
                        margin: 0 auto 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 48px;
                        font-weight: bold;
                    }}
                    .warning {{
                        color: #e74c3c;
                        font-weight: bold;
                        margin-top: 20px;
                    }}
                    .timer {{
                        font-size: 16px;
                        color: #ffffff;
                        margin-top: 15px;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>{subject}</h1>
                    </div>
                    <div class="content">
                        <div class="logo">S</div>
                        <p class="greeting">{greeting}</p>
                        
                        <div class="code-container">
                            <p class="code">{code}</p>
                            <p class="timer">⏰ 验证码将在 5 分钟后失效</p>
                        </div>
                        
                        <div class="info">
                            <h3>📋 使用说明</h3>
                            <p>{usage_instruction}</p>
                            <p>2. 验证码有效期为 5 分钟，请尽快使用</p>
                            <p>3. 每个验证码只能使用一次</p>
                        </div>
                        
                        <p class="warning">⚠️ 如果您没有请求此验证码，请忽略此邮件</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 SmartRAG 团队 | 智能检索增强生成系统</p>
                        <p>此邮件由系统自动发送，请勿直接回复</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(body, 'html', 'utf-8'))
            
            # 使用连接池发送邮件
            with self._get_connection() as server:
                server.sendmail(self.mail_count, [to_email], msg.as_string())
            
            logger.info(f"验证码邮件发送成功: {to_email[:3]}***")
            return True
        except Exception as e:
            logger.error(f"邮件发送失败: {e}")
            return False
    
    def send_verification_code(self, to_email: str, code: str, code_type: str = "registration", async_send: bool = True) -> bool:
        """发送验证码邮件"""
        if async_send:
            # 异步发送：将邮件任务放入队列
            try:
                self.email_queue.put({
                    'to_email': to_email,
                    'code': code,
                    'code_type': code_type
                })
                logger.info(f"验证码邮件已加入发送队列: {to_email[:3]}***, 类型: {code_type}")
                return True
            except Exception as e:
                logger.error(f"邮件加入队列失败: {e}")
                return False
        else:
            # 同步发送
            return self._send_email_sync(to_email, code, code_type)
    
    def shutdown(self):
        """关闭邮件服务"""
        logger.info("正在关闭邮件服务...")
        self.stop_worker = True
        
        # 等待工作线程结束
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=5)
        
        # 关闭连接池中的所有连接
        while not self.connection_pool.empty():
            try:
                connection = self.connection_pool.get_nowait()
                try:
                    connection.quit()
                except:
                    pass
            except queue.Empty:
                break
        
        logger.info("邮件服务已关闭")


# 全局邮件服务实例
email_service = EmailService()
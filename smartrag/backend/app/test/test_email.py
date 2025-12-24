#!/usr/bin/env python3
"""
测试邮件发送功能
"""
import sys
import os

# 添加项目路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.email_service import email_service


def test_email_sending():
    """测试邮件发送功能"""
    test_email = "jianshan.cui@7x-networks.com"  # 替换为您的测试邮箱
    test_code = "123456"
    
    print(f"正在发送测试邮件到: {test_email}")
    print(f"验证码: {test_code}")
    
    success = email_service.send_verification_code(test_email, test_code)
    
    if success:
        print("邮件发送成功！")
    else:
        print("邮件发送失败！")


if __name__ == "__main__":
    test_email_sending()
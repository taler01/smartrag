import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { UserRole, ROLE_LABELS, Role } from '../types.ts';
import * as apiService from '../services/apiService.ts';
import PasswordInput from './PasswordInput.tsx';

type AuthMode = 'login' | 'register' | 'forgot-password';

interface LoginProps {
  onLogin: (userInfo: any, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.R_AND_D);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isResetCodeSent, setIsResetCodeSent] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);
  
  // 密码可见性状态
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPasswordReset, setShowConfirmNewPasswordReset] = useState(false);
  
  // 使用useCallback优化toggle函数
  const togglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);
  
  const toggleConfirmPassword = useCallback(() => {
    setShowConfirmPassword(prev => !prev);
  }, []);
  
  const toggleNewPassword = useCallback(() => {
    setShowNewPassword(prev => !prev);
  }, []);
  
  const toggleConfirmNewPasswordReset = useCallback(() => {
    setShowConfirmNewPasswordReset(prev => !prev);
  }, []);

  // 使用useCallback优化输入处理函数
  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  }, []);
  
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);
  
  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
  }, []);
  
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);
  
  const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value);
  }, []);
  
  const handleConfirmNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmNewPassword(e.target.value);
  }, []);
  
  const handleVerificationCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVerificationCode(e.target.value.replace(/[^0-9]/g, ''));
  }, []);

  // 获取角色列表
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const roles = await apiService.getPublicRoles();
        setAvailableRoles(roles);
        // 默认选择第一个角色
        if (roles.length > 0) {
          setSelectedRoleIds([roles[0].id]);
        }
      } catch (error) {
        console.error('Failed to fetch roles:', error);
        // 如果API调用失败，使用默认角色列表
        const defaultRoles: Role[] = [
          { id: 2, role_code: 'R_AND_D', role_name: '研发部', description: '研发部门', is_active: true, created_at: '', updated_at: '' },
          { id: 3, role_code: 'QA', role_name: '测试部', description: '测试部门', is_active: true, created_at: '', updated_at: '' },
          { id: 4, role_code: 'OPS', role_name: '运维部', description: '运维部门', is_active: true, created_at: '', updated_at: '' },
          { id: 5, role_code: 'PRE_SALES', role_name: '售前部', description: '售前部门', is_active: true, created_at: '', updated_at: '' },
          { id: 6, role_code: 'AFTER_SALES', role_name: '售后部', description: '售后部门', is_active: true, created_at: '', updated_at: '' }
        ];
        setAvailableRoles(defaultRoles);
        // 默认选择第一个角色
        if (defaultRoles.length > 0) {
          setSelectedRoleIds([defaultRoles[0].id]);
        }
      }
    };

    fetchRoles();
  }, []);

  // 密码强度验证函数
  const validatePasswordStrength = (password: string) => {
    const errors = [];
    
    // 检查长度
    if (password.length < 8) {
      errors.push("密码长度不能少于8位");
    }
    
    // 检查是否包含数字
    if (!/\d/.test(password)) {
      errors.push("密码必须包含至少1个数字");
    }
    
    // 检查是否包含小写字母
    if (!/[a-z]/.test(password)) {
      errors.push("密码必须包含至少1个小写字母");
    }
    
    // 检查是否包含大写字母
    if (!/[A-Z]/.test(password)) {
      errors.push("密码必须包含至少1个大写字母");
    }
    
    // 检查是否包含特殊字符
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
      errors.push("密码必须包含至少1个特殊字符(!@#$%^&*()_+-=[]{}|;:,.<>?)");
    }
    
    // 检查是否包含常见弱密码
    const commonPasswords = ["password", "123456", "qwerty", "abc123", "password123", "admin123"];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push("密码不能是常见弱密码");
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  };

  // 使用useMemo优化密码强度验证
  const passwordStrength = useMemo(() => {
    return validatePasswordStrength(password);
  }, [password]);
  
  const newPasswordStrength = useMemo(() => {
    return validatePasswordStrength(newPassword);
  }, [newPassword]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      alert('请输入邮箱和密码');
      return;
    }
    setIsLoading(true);
    
    try {
      const loginRequest: apiService.LoginRequest = {
        email: email.trim(),
        password: password.trim()
      };
      
      const response = await apiService.login(loginRequest);
      
      if (response.user && response.access_token) {
        // 必须获取完整的用户信息，不能使用默认角色
        try {
          const userInfo = await apiService.getCurrentUserInfo(response.access_token);
          
          if (!userInfo || !userInfo.role_ids || userInfo.role_ids.length === 0) {
            throw new Error('用户角色信息不完整');
          }
          
          // 传递完整的用户信息给父组件
          onLogin(userInfo, response.access_token);
        } catch (error) {
          console.error('获取用户信息失败:', error);
          // 如果获取用户信息失败，显示错误信息，而不是使用默认角色
          alert('无法获取用户角色信息，请联系管理员');
          return;
        }
      } else {
        alert(response.message || '登录失败，请检查邮箱和密码');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('登录失败，请检查网络连接或联系管理员');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !email.trim() || !verificationCode.trim()) return;
    
    if (password !== confirmPassword) {
      alert('密码确认不一致');
      return;
    }
    
    if (!validatePasswordStrength(password).valid) {
      alert('密码强度不符合要求，请检查密码');
      return;
    }
    
    if (!isCodeSent) {
      alert('请先发送验证码');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // 先验证验证码
      const verifyRequest: apiService.VerifyCodeDetailsRequest = {
        email: email.trim(),
        code: verificationCode.trim(),
        code_type: 'registration'
      };
      
      const verifyResponse = await apiService.verifyCodeDetails(verifyRequest);
      
      if (!verifyResponse.valid) {
        let errorMessage = verifyResponse.message || '验证码错误';
        
        // 显示剩余尝试次数
        if (verifyResponse.remaining_attempts !== undefined && verifyResponse.remaining_attempts > 0) {
          errorMessage += `，还有 ${verifyResponse.remaining_attempts} 次尝试机会`;
        }
        
        alert(errorMessage);
        setIsLoading(false);
        return;
      }
      
      // 验证码正确，继续注册
      const registerRequest: apiService.RegisterRequest = {
        username: username.trim(),
        password: password.trim(),
        email: email.trim(),
        verification_code: verificationCode.trim(),
        role_ids: selectedRoleIds
      };
      
      const response = await apiService.register(registerRequest);
      
      if (response.success) {
        alert('注册成功！请使用新账号登录。');
        setAuthMode('login');
        // 重置表单状态
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        setVerificationCode('');
        setIsCodeSent(false);
        setCountdown(0);
      } else {
        // 检查是否是密码强度错误
        if (response.message && typeof response.message === 'object' && (response.message as any).message === '密码强度不足') {
          const errors = (response.message as any).errors || [];
          alert(`密码强度不足：\n${errors.join('\n')}`);
        } else {
          alert((response.message as any) || '注册失败');
        }
      }
    } catch (error) {
      console.error('Register error:', error);
      alert('注册失败，请检查网络连接或联系管理员');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !verificationCode.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      alert('请填写所有字段');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      alert('密码确认不一致');
      return;
    }
    
    if (!validatePasswordStrength(newPassword).valid) {
      alert('密码强度不符合要求');
      return;
    }
    
    if (!isResetCodeSent) {
      alert('请先发送验证码');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // 先验证验证码
      const verifyRequest: apiService.VerifyCodeDetailsRequest = {
        email: email.trim(),
        code: verificationCode.trim()
      };
      
      const verifyResponse = await apiService.verifyCodeDetails(verifyRequest);
      
      if (!verifyResponse.valid) {
        let errorMessage = verifyResponse.message || '验证码错误';
        
        // 显示剩余尝试次数
        if (verifyResponse.remaining_attempts !== undefined && verifyResponse.remaining_attempts > 0) {
          errorMessage += `，还有 ${verifyResponse.remaining_attempts} 次尝试机会`;
        }
        
        alert(errorMessage);
        setIsLoading(false);
        return;
      }
      
      // 验证码正确，继续重置密码
      const resetRequest: apiService.ResetPasswordRequest = {
        email: email.trim(),
        code: verificationCode.trim(),
        new_password: newPassword.trim()
      };
      
      const response = await apiService.resetPassword(resetRequest);
      
      if (response.success) {
        alert('密码重置成功！请使用新密码登录。');
        setAuthMode('login');
        // 重置表单状态
        setEmail('');
        setVerificationCode('');
        setNewPassword('');
        setConfirmNewPassword('');
        setIsResetCodeSent(false);
        setResetCountdown(0);
      } else {
        // 检查是否是密码强度错误
        if (response.message && typeof response.message === 'object' && (response.message as any).message === '密码强度不足') {
          const errors = (response.message as any).errors || [];
          alert(`密码强度不足：\n${errors.join('\n')}`);
        } else {
          alert((response.message as any) || '密码重置失败');
        }
      }
    } catch (error) {
      console.error('Reset password error:', error);
      alert('密码重置失败，请检查网络连接或联系管理员');
    } finally {
      setIsLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    if (!email.trim()) {
      alert('请输入邮箱地址');
      return;
    }
    
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('请输入有效的邮箱地址');
      return;
    }

    setIsSendingCode(true);
    
    try {
      const request: apiService.SendVerificationCodeRequest = {
        email: email.trim()
      };
      
      console.log('发送验证码请求:', request);
      const response = await apiService.sendVerificationCode(request);
      console.log('发送验证码响应:', response);
      
      // 只有在响应成功时才设置状态
      if (response.success) {
        setIsCodeSent(true);
        setCountdown(60); // 60秒倒计时
        
        // 启动倒计时
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        alert(`验证码已发送到 ${email}`);
      } else {
        // 响应失败，不设置状态
        alert(response.message || '发送验证码失败，请稍后重试');
      }
    } catch (error) {
      console.error('Send verification code error:', error);
      // 错误情况下不设置状态，确保用户必须成功发送验证码才能继续
      alert('发送验证码失败，请检查网络连接或联系管理员');
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyRegistrationCode = async () => {
    if (!email.trim() || !verificationCode.trim()) {
      alert('请输入邮箱和验证码');
      return;
    }

    try {
      const request: apiService.VerifyCodeDetailsRequest = {
        email: email.trim(),
        code: verificationCode.trim(),
        code_type: 'registration'
      };
      
      const response = await apiService.verifyCodeDetails(request);
      
      if (!response.valid) {
        let errorMessage = response.message || '验证码错误';
        
        // 显示剩余尝试次数
        if (response.remaining_attempts !== undefined && response.remaining_attempts > 0) {
          errorMessage += `，还有 ${response.remaining_attempts} 次尝试机会`;
        }
        
        alert(errorMessage);
      } else {
        alert('验证码正确');
      }
    } catch (error) {
      console.error('Verify code error:', error);
      alert('验证验证码失败，请检查网络连接或联系管理员');
    }
  };

  const verifyResetCode = async () => {
    if (!email.trim() || !verificationCode.trim()) {
      alert('请输入邮箱和验证码');
      return;
    }

    try {
      const request: apiService.VerifyCodeDetailsRequest = {
        email: email.trim(),
        code: verificationCode.trim(),
        code_type: 'password_reset'
      };
      
      const response = await apiService.verifyCodeDetails(request);
      
      if (!response.valid) {
        let errorMessage = response.message || '验证码错误';
        
        // 显示剩余尝试次数
        if (response.remaining_attempts !== undefined && response.remaining_attempts > 0) {
          errorMessage += `，还有 ${response.remaining_attempts} 次尝试机会`;
        }
        
        alert(errorMessage);
      } else {
        alert('验证码正确');
      }
    } catch (error) {
      console.error('Verify reset code error:', error);
      alert('验证验证码失败，请检查网络连接或联系管理员');
    }
  };

  const sendResetCode = async () => {
    if (!email.trim()) {
      alert('请输入邮箱地址');
      return;
    }
    
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('请输入有效的邮箱地址');
      return;
    }

    setIsSendingCode(true);
    
    try {
      const request: apiService.SendResetCodeRequest = {
        email: email.trim()
      };
      
      console.log('发送重置验证码请求:', request);
      const response = await apiService.sendResetCode(request);
      console.log('发送重置验证码响应:', response);
      
      // 只有在响应成功时才设置状态
      if (response.success) {
        setIsResetCodeSent(true);
        setResetCountdown(60); // 60秒倒计时
        
        // 启动倒计时
        const timer = setInterval(() => {
          setResetCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        alert(`重置验证码已发送到 ${email}`);
      } else {
        // 响应失败，不设置状态
        alert(response.message || '发送重置验证码失败，请稍后重试');
      }
    } catch (error) {
      console.error('Send reset code error:', error);
      // 错误情况下不设置状态，确保用户必须成功发送验证码才能继续
      alert('发送重置验证码失败，请检查网络连接或联系管理员');
    } finally {
      setIsSendingCode(false);
    }
  };

  const staffRoles = [
    UserRole.R_AND_D,
    UserRole.QA,
    UserRole.OPS,
    UserRole.PRE_SALES,
    UserRole.AFTER_SALES
  ];

  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          邮箱
        </label>
        <input
          type="email"
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="请输入邮箱"
          value={email}
          onChange={handleEmailChange}
        />
      </div>

      <PasswordInput
        label="密码"
        value={password}
        onChange={handlePasswordChange}
        showPassword={showPassword}
        togglePassword={togglePassword}
        placeholder="请输入密码"
      />

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-lg shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed"
      >
        {isLoading ? '登录中...' : '登录系统'}
      </button>

      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={() => setAuthMode('register')}
          className="text-blue-600 hover:text-blue-700 transition-colors"
        >
          注册新账号
        </button>
        <button
          type="button"
          onClick={() => setAuthMode('forgot-password')}
          className="text-slate-600 hover:text-slate-700 transition-colors"
        >
          忘记密码？
        </button>
      </div>
    </form>
  );

  const renderRegisterForm = () => (
    <form onSubmit={handleRegister} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          用户名
        </label>
        <input
          type="text"
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="请输入用户名"
          value={username}
          onChange={handleUsernameChange}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          邮箱地址
        </label>
        <input
          type="email"
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="请输入公司邮箱"
          value={email}
          onChange={handleEmailChange}
          disabled={isCodeSent}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          验证码
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            required
            maxLength={6}
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center"
            placeholder="6位验证码"
            value={verificationCode}
            onChange={handleVerificationCodeChange}
          />
          <button
            type="button"
            onClick={sendVerificationCode}
            disabled={isSendingCode || countdown > 0}
            className="w-24 px-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed whitespace-nowrap text-sm"
          >
            {isSendingCode ? '发送中' : 
             countdown > 0 ? `${countdown}s` : 
             '发送'}
          </button>
        </div>
        {isCodeSent && (
          <p className="text-xs text-slate-500 mt-1">验证码已发送到您的邮箱，请输入6位数字验证码</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          所属部门 / 角色
        </label>
        <select
          value={selectedRoleIds.length > 0 ? selectedRoleIds[0] : ''}
          onChange={(e) => {
            const roleId = parseInt(e.target.value);
            setSelectedRoleIds([roleId]);
          }}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        >
          <option value="" disabled>请选择角色</option>
          {availableRoles.map(role => (
            <option key={role.id} value={role.id}>
              {role.role_name}
            </option>
          ))}
        </select>
        {selectedRoleIds.length === 0 && (
          <p className="text-red-500 text-xs mt-1">请选择一个角色</p>
        )}
      </div>

      <div>
      <PasswordInput
        label="密码"
        value={password}
        onChange={handlePasswordChange}
        showPassword={showPassword}
        togglePassword={togglePassword}
        placeholder="请输入密码"
      />
        {password.length > 0 && (
          <div className={`mt-1 ${
            password.length > 0 && !passwordStrength.valid
              ? 'border-red-500' 
              : password.length > 0 && passwordStrength.valid
                ? 'border-green-500' 
                : ''
          }`}>
            {passwordStrength.valid ? (
              <p className="text-green-600 text-xs">密码强度符合要求</p>
            ) : (
              <div>
                <p className="text-red-500 text-xs">密码强度不足，请满足以下要求：</p>
                <ul className="text-red-500 text-xs mt-1 ml-4 list-disc">
                  {passwordStrength.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <PasswordInput
        label="确认密码"
        value={confirmPassword}
        onChange={handleConfirmPasswordChange}
        showPassword={showConfirmPassword}
        togglePassword={toggleConfirmPassword}
        placeholder="请再次输入密码"
      />

      <button
        type="submit"
        disabled={isLoading || !username.trim() || !password.trim() || !email.trim() || !verificationCode.trim() || password !== confirmPassword || !validatePasswordStrength(password).valid || selectedRoleIds.length === 0}
        className="w-full py-4 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold text-lg shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed"
      >
        {isLoading ? '注册中...' : '注册账号'}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setAuthMode('login');
            // 重置验证码相关状态
            setVerificationCode('');
            setIsCodeSent(false);
            setCountdown(0);
          }}
          className="text-blue-600 hover:text-blue-700 transition-colors text-sm"
        >
          已有账号？立即登录
        </button>
      </div>
    </form>
  );

  const renderForgotPasswordForm = () => (
    <form onSubmit={handleForgotPassword} className="space-y-6">
      <div className="text-center mb-4">
        <p className="text-slate-600">请输入您的邮箱地址、验证码和新密码</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          邮箱地址
        </label>
        <input
          type="email"
          required
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          placeholder="请输入注册时使用的邮箱"
          value={email}
          onChange={handleEmailChange}
          disabled={isResetCodeSent}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          重置验证码
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            required
            maxLength={6}
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center"
            placeholder="6位验证码"
            value={verificationCode}
            onChange={handleVerificationCodeChange}
          />
          <button
            type="button"
            onClick={sendResetCode}
            disabled={isSendingCode || resetCountdown > 0}
            className="w-24 px-2 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg font-medium transition-all disabled:cursor-not-allowed whitespace-nowrap text-sm"
          >
            {isSendingCode ? '发送中' : 
             resetCountdown > 0 ? `${resetCountdown}s` : 
             '发送'}
          </button>
        </div>
        {isResetCodeSent && (
          <p className="text-xs text-slate-500 mt-1">重置验证码已发送到您的邮箱，请输入6位数字验证码</p>
        )}
      </div>

      <div>
      <PasswordInput
        label="新密码"
        value={newPassword}
        onChange={handleNewPasswordChange}
        showPassword={showNewPassword}
        togglePassword={toggleNewPassword}
        placeholder="请输入新密码"
      />
        {newPassword.length > 0 && (
          <div className={`mt-1 ${
            newPassword.length > 0 && !newPasswordStrength.valid
              ? 'border-red-500' 
              : newPassword.length > 0 && newPasswordStrength.valid
                ? 'border-green-500' 
                : ''
          }`}>
            {newPasswordStrength.valid ? (
              <p className="text-green-600 text-xs">密码强度符合要求</p>
            ) : (
              <div>
                <p className="text-red-500 text-xs">密码强度不足，请满足以下要求：</p>
                <ul className="text-red-500 text-xs mt-1 ml-4 list-disc">
                  {newPasswordStrength.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
      <PasswordInput
        label="确认新密码"
        value={confirmNewPassword}
        onChange={handleConfirmNewPasswordChange}
        showPassword={showConfirmNewPasswordReset}
        togglePassword={toggleConfirmNewPasswordReset}
        placeholder="请再次输入新密码"
      />
        {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
          <p className="text-red-500 text-xs mt-1">密码确认不一致</p>
        )}
        {confirmNewPassword.length > 0 && newPassword === confirmNewPassword && validatePasswordStrength(newPassword).valid && (
          <p className="text-green-600 text-xs mt-1">密码确认一致</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || !email.trim() || !verificationCode.trim() || !newPassword.trim() || !confirmNewPassword.trim() || newPassword !== confirmNewPassword || !validatePasswordStrength(newPassword).valid}
        className="w-full py-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-bold text-lg shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed"
      >
        {isLoading ? '重置中...' : '重置密码'}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setAuthMode('login');
            // 重置表单状态
            setEmail('');
            setVerificationCode('');
            setNewPassword('');
            setConfirmNewPassword('');
            setIsResetCodeSent(false);
            setResetCountdown(0);
          }}
          className="text-blue-600 hover:text-blue-700 transition-colors text-sm"
        >
          返回登录
        </button>
      </div>
    </form>
  );

  const getFormTitle = () => {
    switch (authMode) {
      case 'register':
        return '新用户注册';
      case 'forgot-password':
        return '重置密码';
      default:
        return '用户登录';
    }
  };

  const getFormDescription = () => {
    switch (authMode) {
      case 'register':
        return '创建您的企业账号';
      case 'forgot-password':
        return '请输入您的邮箱以重置密码';
      default:
        return '请输入您的信息以继续';
    }
  };

  return (
    <>
      <style>{`
        @keyframes metalShine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        
        @keyframes logoMetal {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        
        .metal-text {
          background: linear-gradient(
            90deg,
            #ff0000 0%,
            #ff7f00 15%,
            #ffff00 30%,
            #00ff00 45%,
            #00ffff 60%,
            #0000ff 75%,
            #8b00ff 90%,
            #ff0000 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: metalShine 50s linear infinite;
        }
        
        .metal-logo {
          background: linear-gradient(
            90deg,
            #ff0000 0%,
            #ff7f00 15%,
            #ffff00 30%,
            #00ff00 45%,
            #00ffff 60%,
            #0000ff 75%,
            #8b00ff 90%,
            #ff0000 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: logoMetal 50s linear infinite;
        }
      `}</style>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="mb-8 text-center">
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto metal-logo" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </div>
        <h1 className="text-4xl font-bold tracking-tight metal-text">SmartRAG - 智能知识库检索系统</h1>
      </div>

      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">{getFormTitle()}</h2>
            <p className="text-slate-500 mt-1">{getFormDescription()}</p>
          </div>

          {authMode === 'login' && renderLoginForm()}
          {authMode === 'register' && renderRegisterForm()}
          {authMode === 'forgot-password' && renderForgotPasswordForm()}

          <div className="mt-6 text-center text-xs text-slate-500">
            <p>安全提示：请确保在授权的网络环境下访问。</p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Login;
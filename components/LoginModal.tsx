
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, LogIn, User, Lock, AlertCircle, CheckCircle, Download } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Global PWA prompt variable (captured in index.html or logic)
let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

export const LoginModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { login, validateUser, updateUser } = useApp();
  const [step, setStep] = useState<'LOGIN' | 'CHANGE_PW'>('LOGIN');
  
  // Login Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Change Password Fields
  const [tempUser, setTempUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeError, setChangeError] = useState('');

  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    if (isOpen) {
        // Reset state on open
        setStep('LOGIN');
        setUsername('');
        setPassword('');
        setError('');
        setNewPassword('');
        setConfirmPassword('');
        setChangeError('');
        setTempUser(null);
        // Check install availability
        if (deferredPrompt) setShowInstallBtn(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
        setShowInstallBtn(false);
      }
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = validateUser(username, password);
    
    if (user) {
        if (user.mustChangePassword) {
            // User credentials valid, but MUST change password first
            setTempUser(user);
            setStep('CHANGE_PW');
            setError('');
        } else {
            // Normal login
            const success = login(username, password);
            if (success) onClose();
            else setError('登入失敗，請稍後再試');
        }
    } else {
        setError('帳號或密碼錯誤');
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
        setChangeError('確認密碼不相符');
        return;
    }
    if (newPassword.length < 4) {
        setChangeError('密碼長度至少需 4 碼');
        return;
    }
    
    try {
        await updateUser(tempUser.id, {
            password: newPassword,
            mustChangePassword: false
        });
        
        // Auto login after change
        login(username, newPassword);
        onClose();
    } catch (e) {
        setChangeError('密碼更新失敗，請稍後再試');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in duration-200 my-auto">
        
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10 p-2"
        >
            <X size={24} />
        </button>

        <div className="p-8">
            {step === 'LOGIN' ? (
                <>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-zen-50 text-zen-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LogIn size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">歡迎回來</h2>
                        <p className="text-gray-500 text-sm mt-1">請登入您的帳號以管理預約</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">帳號</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white focus:outline-none transition-all text-gray-900"
                                    placeholder="請輸入帳號"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">密碼</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white focus:outline-none transition-all text-gray-900 font-mono text-sm"
                                    placeholder="請輸入密碼"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            className="w-full bg-zen-600 text-white font-bold py-3.5 rounded-xl hover:bg-zen-700 shadow-lg shadow-zen-200 transition-all mt-2 active:scale-95 touch-manipulation"
                        >
                            登入
                        </button>
                    </form>

                    <div className="mt-6 text-center space-y-3">
                        <p className="text-xs text-gray-400">
                            若無帳號，請聯繫管理員建立。
                        </p>
                        {showInstallBtn && (
                            <button 
                                onClick={handleInstallClick}
                                className="inline-flex items-center gap-2 text-xs text-zen-600 font-bold border border-zen-200 px-3 py-1.5 rounded-full hover:bg-zen-50 transition-colors"
                            >
                                <Download size={14} />
                                下載 App
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">變更密碼</h2>
                        <p className="text-gray-500 text-sm mt-1">為了您的帳戶安全，首次登入請設定新密碼</p>
                    </div>

                    {changeError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600">
                            <AlertCircle size={16} />
                            {changeError}
                        </div>
                    )}

                    <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">新密碼</label>
                            <input 
                                type="password" 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:outline-none text-gray-900 font-mono text-sm"
                                placeholder="輸入新密碼"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">確認新密碼</label>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:outline-none text-gray-900 font-mono text-sm"
                                placeholder="再次輸入新密碼"
                            />
                        </div>

                        <button 
                            type="submit"
                            className="w-full bg-zen-600 text-white font-bold py-3.5 rounded-xl hover:bg-zen-700 shadow-lg shadow-zen-200 transition-all mt-2 active:scale-95 flex items-center justify-center gap-2 touch-manipulation"
                        >
                            <CheckCircle size={18} />
                            確認並登入
                        </button>
                    </form>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

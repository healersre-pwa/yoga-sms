
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, LogIn, User, Lock, AlertCircle, CheckCircle, Download, UserPlus, Phone, Mail } from 'lucide-react';

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

type ModalMode = 'LOGIN' | 'REGISTER';

export const LoginModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { login, registerStudent } = useApp();
  const [mode, setMode] = useState<ModalMode>('LOGIN');
  
  // Login Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Register Fields
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    if (isOpen) {
        // Reset state on open
        setMode('LOGIN');
        setEmail('');
        setPassword('');
        setError('');
        
        // Reset Register
        setRegName('');
        setRegPhone('');
        setRegEmail('');
        setRegPassword('');
        setRegConfirmPassword('');
        setIsProcessing(false);

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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    const success = await login(email, password);
    setIsProcessing(false);
    
    if (success) {
        onClose();
    } else {
        setError('登入失敗：Email 或密碼錯誤');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      if (regPassword !== regConfirmPassword) {
          setError('確認密碼不相符');
          return;
      }
      if (regPassword.length < 6) {
          setError('密碼長度至少需 6 碼');
          return;
      }
      if (!regName || !regEmail) {
          setError('請填寫完整欄位');
          return;
      }

      setIsProcessing(true);
      const result = await registerStudent({
          name: regName,
          phoneNumber: regPhone,
          email: regEmail,
          password: regPassword
      });
      setIsProcessing(false);

      if (result.success) {
          onClose(); // Close modal on success (auto-login handled in context)
      } else {
          setError(result.message || '註冊失敗');
      }
  };

  // Render Content based on Mode
  const renderContent = () => {
      // LOGIN or REGISTER mode
      return (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
                <button 
                    onClick={() => { setMode('LOGIN'); setError(''); }}
                    className={`flex-1 py-3 text-center font-bold text-sm relative transition-colors ${mode === 'LOGIN' ? 'text-zen-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    登入
                    {mode === 'LOGIN' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zen-600" />}
                </button>
                <button 
                    onClick={() => { setMode('REGISTER'); setError(''); }}
                    className={`flex-1 py-3 text-center font-bold text-sm relative transition-colors bg-blue-50/50 ${mode === 'REGISTER' ? 'text-zen-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    註冊帳號
                    {mode === 'REGISTER' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zen-600" />}
                    <div className="absolute top-0 right-0 p-1">
                        <UserPlus size={10} className="text-zen-600 opacity-50"/>
                    </div>
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {mode === 'LOGIN' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white focus:outline-none transition-all text-gray-900"
                                placeholder="請輸入 Email"
                                autoFocus
                                required
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
                                required
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isProcessing}
                        className="w-full bg-zen-600 text-white font-bold py-3.5 rounded-xl hover:bg-zen-700 shadow-lg shadow-zen-200 transition-all mt-2 active:scale-95 touch-manipulation flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {isProcessing ? '登入中...' : '登入'}
                    </button>

                    <div className="mt-6 text-center space-y-3">
                        {showInstallBtn && (
                            <button 
                                type="button"
                                onClick={handleInstallClick}
                                className="inline-flex items-center gap-2 text-xs text-zen-600 font-bold border border-zen-200 px-3 py-1.5 rounded-full hover:bg-zen-50 transition-colors"
                            >
                                <Download size={14} />
                                下載 App
                            </button>
                        )}
                    </div>
                </form>
            ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    <div className="text-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">建立新帳號</h3>
                        <p className="text-xs text-gray-500">填寫基本資料以開始使用</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">姓名</label>
                            <input 
                                type="text" 
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white focus:outline-none transition-all text-gray-900"
                                placeholder="稱呼"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">電話</label>
                            <input 
                                type="tel" 
                                value={regPhone}
                                onChange={(e) => setRegPhone(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white focus:outline-none transition-all text-gray-900"
                                placeholder="手機號碼"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (帳號)</label>
                        <input 
                            type="email" 
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white focus:outline-none transition-all text-gray-900"
                            placeholder="name@example.com"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">設定密碼</label>
                            <input 
                                type="password" 
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white focus:outline-none transition-all text-gray-900 font-mono text-sm"
                                placeholder="至少6碼"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">確認密碼</label>
                            <input 
                                type="password" 
                                value={regConfirmPassword}
                                onChange={(e) => setRegConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white focus:outline-none transition-all text-gray-900 font-mono text-sm"
                                placeholder="再次輸入"
                                required
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isProcessing}
                        className="w-full bg-zen-700 text-white font-bold py-3.5 rounded-xl hover:bg-zen-800 shadow-lg shadow-zen-200 transition-all mt-4 active:scale-95 disabled:opacity-50 touch-manipulation flex items-center justify-center gap-2"
                    >
                        {isProcessing ? '註冊中...' : '註冊並登入'}
                    </button>
                </form>
            )}
          </>
      );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in duration-200 my-auto">
        
        <button 
            onClick={onClose} 
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors z-10 p-2"
        >
            <X size={24} />
        </button>

        <div className="px-8 pb-8 pt-4">
            {renderContent()}
        </div>
      </div>
    </div>
  );
};

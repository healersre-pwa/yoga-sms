
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, LogIn, User, Lock, AlertCircle, CheckCircle, Download, UserPlus, Phone, Mail, Chrome, Globe, KeyRound, ArrowLeft } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

type ModalMode = 'LOGIN' | 'REGISTER' | 'GOOGLE_PHONE' | 'FORGOT_PASSWORD';

export const LoginModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { login, registerStudent, loginWithGoogle, registerGoogleUser, forgotPassword, logout } = useApp();
  const [mode, setMode] = useState<ModalMode>('LOGIN');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [googlePhone, setGooglePhone] = useState('');
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  const isLineBrowser = /Line\//i.test(navigator.userAgent);

  useEffect(() => {
    if (isOpen) {
        setMode('LOGIN');
        setEmail('');
        setPassword('');
        setError('');
        setSuccess('');
        setIsProcessing(false);
        if (deferredPrompt) setShowInstallBtn(true);
    }
  }, [isOpen]);

  const handleClose = () => {
      if (mode === 'GOOGLE_PHONE') logout();
      onClose();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    const successResult = await login(email, password);
    setIsProcessing(false);
    if (successResult) onClose();
    else setError('登入失敗：Email 或密碼錯誤');
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) { setError('請輸入 Email'); return; }
      setIsProcessing(true);
      const res = await forgotPassword(email);
      setIsProcessing(false);
      if (res.success) {
          setSuccess('密碼重設郵件已發送，請檢查您的信箱。');
          setError('');
      } else {
          setError('發送失敗：' + (res.message || '請確認 Email 是否正確'));
          setSuccess('');
      }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (regPassword !== regConfirmPassword) { setError('確認密碼不相符'); return; }
      if (regPassword.length < 6) { setError('密碼長度至少需 6 碼'); return; }
      setIsProcessing(true);
      const result = await registerStudent({ name: regName, phoneNumber: regPhone, email: regEmail, password: regPassword });
      setIsProcessing(false);
      if (result.success) onClose();
      else setError(result.message || '註冊失敗');
  };

  const handleGoogleLogin = async () => {
      setIsProcessing(true);
      setError('');
      const result = await loginWithGoogle();
      setIsProcessing(false);
      if (result.status === 'SUCCESS') onClose();
      else if (result.status === 'NEEDS_PHONE') setMode('GOOGLE_PHONE');
      else setError(result.message || 'Google 登入失敗');
  };

  const handleGooglePhoneSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      const result = await registerGoogleUser(googlePhone);
      setIsProcessing(false);
      if (result.success) onClose();
      else setError(result.message || '註冊失敗');
  };

  const GoogleBtn = ({ text }: { text: string }) => (
      <button type="button" onClick={handleGoogleLogin} disabled={isProcessing} className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-sm">
          <div className="w-5 h-5">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          </div>
          {text}
      </button>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in duration-200 my-auto">
        <button onClick={handleClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors z-10 p-2"><X size={24} /></button>

        <div className="px-8 pb-8 pt-4">
            {mode === 'FORGOT_PASSWORD' ? (
                <div className="animate-in slide-in-from-right duration-300">
                    <button onClick={() => {setMode('LOGIN'); setError(''); setSuccess('');}} className="mb-4 text-zen-600 flex items-center gap-1 text-sm font-bold hover:underline">
                        <ArrowLeft size={16} /> 返回登入
                    </button>
                    <div className="text-center mb-6">
                        <KeyRound size={48} className="mx-auto text-zen-600 mb-3" />
                        <h3 className="text-xl font-bold text-gray-800">忘記密碼？</h3>
                        <p className="text-sm text-gray-500">輸入您的 Email，我們將發送密碼重設信件給您</p>
                    </div>
                    {success && <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2 text-sm text-green-700 font-bold"><CheckCircle size={16} /> {success}</div>}
                    {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600 font-bold"><AlertCircle size={16} /> {error}</div>}
                    
                    <form onSubmit={handleForgotSubmit} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white outline-none" placeholder="請輸入註冊的 Email" required />
                        </div>
                        <button type="submit" disabled={isProcessing} className="w-full bg-zen-600 text-white font-bold py-3.5 rounded-xl hover:bg-zen-700 shadow-lg shadow-zen-200 disabled:opacity-70 transition-all flex items-center justify-center gap-2">
                            {isProcessing ? '發送中...' : '發送重設郵件'}
                        </button>
                    </form>
                </div>
            ) : mode === 'GOOGLE_PHONE' ? (
                <form onSubmit={handleGooglePhoneSubmit} className="space-y-4 animate-in slide-in-from-right duration-300">
                    <div className="text-center mb-6"><h3 className="text-xl font-bold text-gray-800">只差一步！</h3><p className="text-sm text-gray-500">請補填您的電話號碼以完成註冊</p></div>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="tel" value={googlePhone} onChange={e => setGooglePhone(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none text-gray-900" placeholder="09xx..." autoFocus required />
                    </div>
                    {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600 font-bold"><AlertCircle size={16} /> {error}</div>}
                    <button type="submit" disabled={isProcessing} className="w-full bg-zen-600 text-white font-bold py-3.5 rounded-xl hover:bg-zen-700 shadow-lg shadow-zen-200 transition-all mt-4 disabled:opacity-70 flex items-center justify-center gap-2">{isProcessing ? '處理中...' : '完成註冊'}</button>
                </form>
            ) : (
                <>
                    <div className="flex border-b border-gray-200 mb-6">
                        <button onClick={() => { setMode('LOGIN'); setError(''); }} className={`flex-1 py-3 text-center font-bold text-sm relative transition-colors ${mode === 'LOGIN' ? 'text-zen-600' : 'text-gray-400 hover:text-gray-600'}`}>登入{mode === 'LOGIN' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zen-600" />}</button>
                        <button onClick={() => { setMode('REGISTER'); setError(''); }} className={`flex-1 py-3 text-center font-bold text-sm relative transition-colors bg-blue-50/50 ${mode === 'REGISTER' ? 'text-zen-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>註冊帳號{mode === 'REGISTER' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zen-600" /><div className="absolute top-0 right-0 p-1"><UserPlus size={10} className="text-zen-600 opacity-50"/></div></button>
                    </div>

                    {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600 font-bold"><AlertCircle size={16} /> {error}</div>}

                    {mode === 'LOGIN' ? (
                        <form onSubmit={handleLoginSubmit} className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white outline-none transition-all text-gray-900" placeholder="請輸入 Email" autoFocus required />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:bg-white outline-none transition-all text-gray-900 font-mono text-sm" placeholder="請輸入密碼" required />
                            </div>
                            <div className="text-right">
                                <button type="button" onClick={() => setMode('FORGOT_PASSWORD')} className="text-xs font-bold text-zen-600 hover:underline">忘記密碼？</button>
                            </div>
                            <button type="submit" disabled={isProcessing} className="w-full bg-zen-600 text-white font-bold py-3.5 rounded-xl hover:bg-zen-700 shadow-lg shadow-zen-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70">{isProcessing ? '登入中...' : '登入'}</button>
                            <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500 font-medium">或</span></div></div>
                            {isLineBrowser ? (
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center space-y-3"><div className="flex items-center justify-center gap-2 text-gray-500 text-xs font-bold"><Globe size={14} /><span>Google 登入不支援 LINE 瀏覽器</span></div><p className="text-xs text-gray-400 leading-relaxed">為確保帳號安全，請點擊下方按鈕，切換至預設瀏覽器以繼續。</p><button type="button" onClick={() => window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'openExternalBrowser=1'} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"><Chrome size={16} />切換至系統瀏覽器開啟</button></div>
                            ) : (
                                <GoogleBtn text="使用 Google 登入" />
                            )}
                        </button>
                    ) : (
                        <form onSubmit={handleRegisterSubmit} className="space-y-4">
                            <div className="text-center mb-4"><h3 className="text-xl font-bold text-gray-800">建立新帳號</h3><p className="text-xs text-gray-500">填寫基本資料以開始使用</p></div>
                            <div className="grid grid-cols-2 gap-3">
                                <input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none" placeholder="姓名" required />
                                <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none" placeholder="手機" />
                            </div>
                            <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none" placeholder="Email (帳號)" required />
                            <div className="grid grid-cols-2 gap-3">
                                <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none font-mono text-sm" placeholder="密碼(6碼)" required />
                                <input type="password" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none font-mono text-sm" placeholder="確認密碼" required />
                            </div>
                            <button type="submit" disabled={isProcessing} className="w-full bg-zen-700 text-white font-bold py-3.5 rounded-xl hover:bg-zen-800 shadow-lg shadow-zen-200 transition-all mt-4 disabled:opacity-50 flex items-center justify-center gap-2">{isProcessing ? '註冊中...' : '註冊並登入'}</button>
                            <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500 font-medium">或使用 Google 帳號</span></div></div>
                            {isLineBrowser ? <div className="mb-4 text-center text-xs text-gray-400">LINE 內建瀏覽器暫不支援 Google 註冊</div> : <GoogleBtn text="使用 Google 快速註冊" />}
                        </form>
                    )}
                </>
            )}
        </div>
      </div>
    </div>
  );
};


import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { UserRole } from '../types';
import { LogOut, LogIn, ChevronDown, CalendarDays, UserCircle, Camera, Loader2, User as UserIcon, UserCog, CreditCard, Smartphone } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { StudentProfileModal } from './StudentProfileModal';
import { TopUpModal } from './TopUpModal';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout, isLoginModalOpen, setLoginModalOpen, appLogo, appBackgroundImage, updateAppLogo } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); 
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (!isPWA) {
      const timer = setTimeout(() => setShowInstallPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) { setIsMenuOpen(false); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => { logout(); setIsMenuOpen(false); };
  const handleLoginClick = () => { setLoginModalOpen(true); setIsMenuOpen(false); };
  const handleProfileClick = () => { setIsProfileOpen(true); setIsMenuOpen(false); }
  const handleTopUpClick = () => { setIsTopUpOpen(true); setIsMenuOpen(false); }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploadingLogo(true);
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const SIZE = 256;
              canvas.width = SIZE;
              canvas.height = SIZE;
              const minSide = Math.min(img.width, img.height);
              const sx = (img.width - minSide) / 2;
              const sy = (img.height - minSide) / 2;
              if (ctx) {
                  ctx.clearRect(0, 0, SIZE, SIZE);
                  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, SIZE, SIZE);
              }
              updateAppLogo(canvas.toDataURL('image/png')).then(() => setIsUploadingLogo(false));
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="relative bg-gray-50">
      <div className="fixed inset-0 h-full z-0 bg-no-repeat bg-cover bg-top" style={{ backgroundImage: appBackgroundImage ? `url('${appBackgroundImage}')` : undefined }} />
      <div className="relative z-10 flex flex-col h-[100dvh] overflow-hidden">
        
        {showInstallPrompt && (
          <div className="shrink-0 bg-zen-800 text-white px-4 py-2 flex items-center justify-between text-xs animate-in slide-in-from-top duration-500 z-50">
             <div className="flex items-center gap-2">
                <Smartphone size={14} className="text-zen-300" />
                <span className="font-medium">安裝 ZenFlow App 到手機桌面，預約更快速！</span>
             </div>
             <button onClick={() => { alert("請點選瀏覽器選單中的「加入主畫面」或「安裝應用程式」"); setShowInstallPrompt(false); }} className="bg-white text-zen-800 px-3 py-1 rounded-full font-bold shadow-sm active:scale-95">如何安裝？</button>
          </div>
        )}

        <nav className="shrink-0 bg-white/50 backdrop-blur-md border-b border-white/30 shadow-sm z-40">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
                <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shadow-md overflow-hidden relative group transition-all ${currentUser.role === UserRole.ADMIN ? 'cursor-pointer hover:ring-2 hover:ring-zen-300' : ''} ${appLogo ? 'bg-white/80' : 'bg-zen-600 text-white shadow-zen-200'}`} onClick={() => currentUser.role === UserRole.ADMIN && logoInputRef.current?.click()}>
                    {isUploadingLogo && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20"><Loader2 size={16} className="text-white animate-spin"/></div>}
                    {appLogo ? <img src={appLogo} alt="Logo" className="w-full h-full object-cover" /> : "Z"}
                    {currentUser.role === UserRole.ADMIN && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"><Camera size={16} className="text-white"/></div>}
                    <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>
                <span className="text-xl font-bold tracking-tight text-gray-800">ZenFlow</span>
                </div>
                <div className="flex items-center gap-4">
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-white/40 transition-colors focus:outline-none">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold text-gray-800 leading-tight">{currentUser.name}</div>
                            <div className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">{currentUser.role === UserRole.GUEST ? '訪客' : (currentUser.role === UserRole.ADMIN ? '管理員' : '學生')}</div>
                        </div>
                        <div className="relative">
                            <div className={`w-9 h-9 rounded-full overflow-hidden shadow-sm flex items-center justify-center bg-white/50 ring-1 ring-black/5`}>
                                {currentUser.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                                ) : (
                                    <div className="text-gray-500">{currentUser.role === UserRole.ADMIN ? <UserCog size={16} /> : <UserIcon size={16} />}</div>
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-white rounded-full p-0.5 shadow-sm border border-gray-100"><ChevronDown size={10} className="text-gray-500" /></div>
                        </div>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                            <div className="px-4 py-3 border-b border-gray-100 sm:hidden"><p className="text-sm font-bold text-gray-900">{currentUser.name}</p><p className="text-xs text-gray-500">{currentUser.role}</p></div>
                            {currentUser.role === UserRole.GUEST ? (
                                <button onClick={handleLoginClick} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-zen-50 hover:text-zen-600 flex items-center gap-2 font-medium"><LogIn size={16} />登入帳號</button>
                            ) : (
                                <>
                                    <div className="px-4 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wider">帳號管理</div>
                                    <button onClick={handleProfileClick} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-zen-50 hover:text-zen-600 flex items-center gap-2 font-medium border-b border-gray-100">{currentUser.role === UserRole.STUDENT ? <CalendarDays size={16} /> : <UserCircle size={16} />}管理 / 查看</button>
                                    {currentUser.role === UserRole.STUDENT && <button onClick={handleTopUpClick} className="w-full text-left px-4 py-2.5 text-sm text-zen-700 hover:bg-zen-50 flex items-center gap-2 font-bold border-b border-gray-100 bg-zen-50/50"><CreditCard size={16} />前往儲值</button>}
                                    <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"><LogOut size={16} />登出</button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                </div>
            </div>
            </div>
        </nav>
        <main className="flex-1 w-full overflow-y-auto scroll-smooth">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">{children}<div className="h-12 sm:h-0"></div></div>
        </main>
      </div>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} />
      {isProfileOpen && <StudentProfileModal onClose={() => setIsProfileOpen(false)} />}
      {isTopUpOpen && <TopUpModal onClose={() => setIsTopUpOpen(false)} />}
    </div>
  );
};

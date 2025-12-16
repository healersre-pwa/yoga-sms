
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { UserRole } from '../types';
import { LogOut, LogIn, ChevronDown, CalendarDays, UserCircle, Camera, Loader2, User as UserIcon, UserCog, CreditCard } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { StudentProfileModal } from './StudentProfileModal';
import { TopUpModal } from './TopUpModal';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout, isLoginModalOpen, setLoginModalOpen, appLogo, appBackgroundImage, updateAppLogo } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); 
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Logo Upload State
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  const handleLoginClick = () => {
    setLoginModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleProfileClick = () => {
    setIsProfileOpen(true);
    setIsMenuOpen(false);
  }

  const handleTopUpClick = () => {
      setIsTopUpOpen(true);
      setIsMenuOpen(false);
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert("Logo 大小請小於 2MB"); return; }
      
      setIsUploadingLogo(true);
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX_SIZE = 200; // Small size for logo
              let width = img.width;
              let height = img.height;
              
              if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
              else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
              
              canvas.width = width;
              canvas.height = height;
              ctx?.drawImage(img, 0, 0, width, height);
              
              const dataUrl = canvas.toDataURL('image/png'); // Use PNG for transparency if needed
              updateAppLogo(dataUrl).then(() => setIsUploadingLogo(false));
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

  const isAdmin = currentUser.role === UserRole.ADMIN;

  // Modified: Remove default Unsplash image to prevent flash on reload
  const currentBg = appBackgroundImage; 

  return (
    <div className="relative bg-gray-50">
      {/* 
          FIXED BACKGROUND LAYER 
      */}
      <div 
        className="fixed inset-0 h-full z-0 bg-no-repeat bg-cover bg-top"
        style={{ 
            backgroundImage: currentBg ? `url('${currentBg}')` : undefined,
        }} 
      />

      {/* 
          APP SHELL WRAPPER
          h-[100dvh]: Force height to match dynamic viewport (ignoring toolbar calc)
          overflow-hidden: Prevents BODY scroll, which stops mobile url bar resizing
      */}
      <div className="relative z-10 flex flex-col h-[100dvh] overflow-hidden">
        
        {/* NAVBAR - Flex Item (Static height) */}
        <nav className="shrink-0 bg-white/50 backdrop-blur-md border-b border-white/30 shadow-sm z-40">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
                
                <div className="flex items-center gap-2">
                <div 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shadow-md overflow-hidden relative group transition-all ${isAdmin ? 'cursor-pointer hover:ring-2 hover:ring-zen-300' : ''} ${appLogo ? 'bg-white/80' : 'bg-zen-600 text-white shadow-zen-200'}`}
                    onClick={() => isAdmin && logoInputRef.current?.click()}
                    title={isAdmin ? "點擊更換 Logo" : "ZenFlow"}
                >
                    {isUploadingLogo && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                            <Loader2 size={16} className="text-white animate-spin"/>
                        </div>
                    )}

                    {appLogo ? (
                        <img src={appLogo} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                        "Z"
                    )}

                    {isAdmin && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Camera size={16} className="text-white"/>
                        </div>
                    )}
                    <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>
                <span className="text-xl font-bold tracking-tight text-gray-800 drop-shadow-sm">ZenFlow</span>
                </div>
                
                <div className="flex items-center gap-4">
                
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-white/40 transition-colors focus:outline-none"
                    >
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold text-gray-800 leading-tight">{currentUser.name}</div>
                            <div className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">
                                {currentUser.role === UserRole.GUEST ? '訪客' : (currentUser.role === UserRole.ADMIN ? '管理員' : '學生')}
                            </div>
                        </div>
                        <div className="relative">
                            {currentUser.avatarUrl ? (
                                <img 
                                    src={currentUser.avatarUrl} 
                                    className={`w-9 h-9 rounded-full border-2 ${currentUser.role === UserRole.ADMIN ? 'border-zen-600' : 'border-white/80'} shadow-sm object-cover`} 
                                    alt="avatar" 
                                />
                            ) : (
                                <div className={`w-9 h-9 rounded-full border-2 ${currentUser.role === UserRole.ADMIN ? 'border-zen-600' : 'border-white/80'} shadow-sm bg-white/50 text-gray-500 flex items-center justify-center`}>
                                    {isAdmin ? <UserCog size={16} /> : <UserIcon size={16} />}
                                </div>
                            )}
                            <div className="absolute bottom-0 right-0 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
                                <ChevronDown size={10} className="text-gray-500" />
                            </div>
                        </div>
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                            <div className="px-4 py-3 border-b border-gray-100 sm:hidden">
                                <p className="text-sm font-bold text-gray-900">{currentUser.name}</p>
                                <p className="text-xs text-gray-500">{currentUser.role}</p>
                            </div>
                            
                            {currentUser.role === UserRole.GUEST ? (
                                <button 
                                    onClick={handleLoginClick}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-zen-50 hover:text-zen-600 flex items-center gap-2 font-medium"
                                >
                                    <LogIn size={16} />
                                    登入帳號
                                </button>
                            ) : (
                                <>
                                    <div className="px-4 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wider">
                                        帳號管理
                                    </div>
                                    
                                    <button 
                                        onClick={handleProfileClick}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-zen-50 hover:text-zen-600 flex items-center gap-2 font-medium border-b border-gray-100"
                                    >
                                        {currentUser.role === UserRole.STUDENT ? <CalendarDays size={16} /> : <UserCircle size={16} />}
                                        管理 / 查看
                                    </button>

                                    {/* STUDENT TOP UP BUTTON */}
                                    {currentUser.role === UserRole.STUDENT && (
                                        <button 
                                            onClick={handleTopUpClick}
                                            className="w-full text-left px-4 py-2.5 text-sm text-zen-700 hover:bg-zen-50 flex items-center gap-2 font-bold border-b border-gray-100 bg-zen-50/50"
                                        >
                                            <CreditCard size={16} />
                                            前往儲值
                                        </button>
                                    )}

                                    <button 
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                                    >
                                        <LogOut size={16} />
                                        登出
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                </div>
            </div>
            </div>
        </nav>

        {/* 
            MAIN SCROLL CONTAINER
            flex-1: Takes remaining height
            overflow-y-auto: Only this area scrolls
        */}
        <main className="flex-1 w-full overflow-y-auto scroll-smooth">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                {children}
                {/* Extra spacer to ensure bottom content isn't covered by mobile nav bars */}
                <div className="h-12 sm:h-0"></div>
            </div>
        </main>
      </div>

      {/* Modals placed at the bottom for better z-index stacking */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} />
      {isProfileOpen && <StudentProfileModal onClose={() => setIsProfileOpen(false)} />}
      {isTopUpOpen && <TopUpModal onClose={() => setIsTopUpOpen(false)} />}
    </div>
  );
};

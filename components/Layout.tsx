
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { UserRole } from '../types';
import { LogOut, LogIn, ChevronDown, CalendarDays, UserCircle, Camera, Loader2 } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { StudentProfileModal } from './StudentProfileModal';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout, isLoginModalOpen, setLoginModalOpen, appLogo, updateAppLogo } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); 
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

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7f6]">
      <nav className="bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            <div className="flex items-center gap-2">
              <div 
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shadow-md overflow-hidden relative group transition-all ${isAdmin ? 'cursor-pointer hover:ring-2 hover:ring-zen-300' : ''} ${appLogo ? 'bg-white' : 'bg-zen-600 text-white shadow-zen-200'}`}
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
              <span className="text-xl font-bold tracking-tight text-gray-800">ZenFlow</span>
            </div>
            
            <div className="flex items-center gap-4">
               
               <div className="relative" ref={menuRef}>
                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
                  >
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-gray-800 leading-tight">{currentUser.name}</div>
                        <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                            {currentUser.role === UserRole.GUEST ? '訪客' : (currentUser.role === UserRole.ADMIN ? '管理員' : '學生')}
                        </div>
                    </div>
                    <div className="relative">
                        <img 
                            src={currentUser.avatarUrl} 
                            className={`w-9 h-9 rounded-full border-2 ${currentUser.role === UserRole.ADMIN ? 'border-zen-600' : 'border-white'} shadow-sm object-cover`} 
                            alt="avatar" 
                        />
                        <div className="absolute bottom-0 right-0 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
                             <ChevronDown size={10} className="text-gray-500" />
                        </div>
                    </div>
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                        <div className="px-4 py-3 border-b border-gray-50 sm:hidden">
                            <p className="text-sm font-bold text-gray-900">{currentUser.name}</p>
                            <p className="text-xs text-gray-500">{currentUser.role}</p>
                        </div>
                        
                        {currentUser.role === UserRole.GUEST ? (
                            <button 
                                onClick={handleLoginClick}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-zen-600 flex items-center gap-2 font-medium"
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
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-zen-600 flex items-center gap-2 font-medium border-b border-gray-50"
                                >
                                    {currentUser.role === UserRole.STUDENT ? <CalendarDays size={16} /> : <UserCircle size={16} />}
                                    管理 / 查看
                                </button>

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

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Modals placed at the bottom for better z-index stacking */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} />
      {isProfileOpen && <StudentProfileModal onClose={() => setIsProfileOpen(false)} />}
    </div>
  );
};

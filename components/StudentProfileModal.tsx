
import React, { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, User as UserIcon, CreditCard, Calendar, Trash2, MapPin, Camera, Edit2, Save, Loader2, Calculator, ChevronRight, Coins, Infinity, Phone, History, Clock, UserCog } from 'lucide-react';
import { UserRole } from '../types';
import { SalaryCalculatorModal } from './SalaryCalculatorModal';

interface Props {
  onClose: () => void;
}

export const StudentProfileModal: React.FC<Props> = ({ onClose }) => {
  const { currentUser, classes, cancelClass, students, updateUser } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(currentUser.name);
  const [newPhone, setNewPhone] = useState(currentUser.phoneNumber || '');
  const [isUploading, setIsUploading] = useState(false);
  const [showSalaryCalc, setShowSalaryCalc] = useState(false); // State for Salary Modal

  // Get live student data to check payment status
  const liveStudentData = students.find(s => s.id === currentUser.id) || currentUser;
  const isStudent = currentUser.role === UserRole.STUDENT;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  
  const membershipType = liveStudentData.membershipType || 'CREDIT';
  const credits = liveStudentData.credits || 0;
  const expiry = liveStudentData.unlimitedExpiry;

  // Flatten Bookings: Find all specific dates this user has booked
  // Create an array of objects: { id, title, startTime, location, dateObject }
  const allBookings = classes.flatMap(cls => {
      if (!cls.bookings) return [];
      const bookings = cls.bookings as Record<string, string[]>;
      
      const bookedDates = Object.entries(bookings)
          .filter(([dateKey, userIds]) => userIds.includes(currentUser.id))
          .map(([dateKey]) => {
              const [y, m, d] = dateKey.split('-').map(Number);
              const dateObj = new Date(y, m - 1, d);
              return {
                  id: cls.id,
                  title: cls.title,
                  location: cls.location,
                  startTime: cls.startTimeStr,
                  dayOfWeek: cls.dayOfWeek,
                  dateObj: dateObj,
                  dateKey: dateKey
              };
          });
      return bookedDates;
  });

  // Split into Upcoming and History
  const now = new Date();
  
  const upcomingBookings = allBookings.filter(b => {
      const [h, m] = b.startTime.split(':').map(Number);
      const classStart = new Date(b.dateObj);
      classStart.setHours(h, m, 0, 0);
      return classStart >= now;
  }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  const historyBookings = allBookings.filter(b => {
      const [h, m] = b.startTime.split(':').map(Number);
      const classStart = new Date(b.dateObj);
      classStart.setHours(h, m, 0, 0);
      return classStart < now;
  }).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime()); // Reverse sort for history

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert("圖片大小請小於 2MB");
        return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Convert to Base64
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            updateUser(currentUser.id, { avatarUrl: dataUrl })
                .then(() => setIsUploading(false))
                .catch(() => {
                    alert("上傳失敗");
                    setIsUploading(false);
                });
        };
        img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
      if(!newName.trim()) return;
      await updateUser(currentUser.id, { name: newName, phoneNumber: newPhone });
      setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-zen-600 p-6 text-white relative transition-all shrink-0">
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors z-10"
            >
                <X size={20} />
            </button>
            
            <div className="flex items-center gap-4">
                {/* Avatar with Upload */}
                <div className="relative group shrink-0">
                    <div className="w-20 h-20 rounded-full border-4 border-white/30 shadow-lg overflow-hidden bg-white relative flex items-center justify-center">
                        {isUploading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                                <Loader2 className="animate-spin text-white" />
                            </div>
                        ) : (
                            currentUser.avatarUrl ? (
                                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover"/>
                            ) : (
                                isAdmin ? <UserCog size={32} className="text-gray-300" /> : <UserIcon size={32} className="text-gray-300" />
                            )
                        )}
                    </div>
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 bg-white text-zen-600 p-1.5 rounded-full shadow-md hover:bg-gray-100 transition-colors z-20"
                        title="更換照片"
                    >
                        <Camera size={14} />
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                    />
                </div>

                <div className="flex-1 min-w-0 pr-14">
                    {isEditing ? (
                        <div className="space-y-2">
                            <input 
                                type="text" 
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full px-2 py-1 text-gray-900 rounded text-lg font-bold outline-none border border-white/50 focus:ring-2 focus:ring-white/50 bg-white/90"
                                placeholder="姓名"
                                autoFocus
                            />
                            <div className="flex items-center bg-white/20 rounded px-2 py-1">
                                <Phone size={14} className="text-white/70 mr-2" />
                                <input 
                                    type="tel"
                                    value={newPhone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                    className="w-full bg-transparent text-sm text-white placeholder-white/50 outline-none"
                                    placeholder="電話號碼"
                                />
                            </div>
                            <button onClick={handleSaveProfile} className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 mt-1 font-bold">
                                <Save size={12} /> 儲存
                            </button>
                        </div>
                    ) : (
                        <div className="group">
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-2xl font-bold truncate">{currentUser.name}</h2>
                                <button onClick={() => setIsEditing(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded shrink-0">
                                    <Edit2 size={14} />
                                </button>
                            </div>
                            
                            <p className="text-zen-100 text-sm font-medium">@{currentUser.username}</p>
                            {liveStudentData.phoneNumber && (
                                <p className="text-zen-100 text-xs mt-1 flex items-center gap-1">
                                    <Phone size={12}/> {liveStudentData.phoneNumber}
                                </p>
                            )}
                        </div>
                    )}
                    
                    {!isEditing && isStudent && (
                        <div className={`inline-flex items-start sm:items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl text-xs font-bold ${membershipType === 'UNLIMITED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                            <div className="mt-0.5 sm:mt-0 shrink-0">
                                {membershipType === 'UNLIMITED' ? <Infinity size={14} /> : <Coins size={14} />}
                            </div>
                            
                            {membershipType === 'UNLIMITED' ? (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1 leading-tight">
                                    <span className="whitespace-nowrap">課程自由</span>
                                    <span className="text-[11px] sm:text-xs font-medium opacity-80 whitespace-nowrap">
                                        至 {expiry || '未設定'}
                                    </span>
                                </div>
                            ) : (
                                <span>剩餘點數: {credits} 點</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="p-0 overflow-y-auto flex-1 bg-gray-50">
            
            {isAdmin ? (
                // --- ADMIN VIEW: Salary Calculator & Quick Links ---
                <div className="p-6">
                    <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
                        <UserCog className="text-zen-600" size={20} />
                        管理員功能
                    </h3>
                    
                    <button 
                        onClick={() => setShowSalaryCalc(true)}
                        className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-zen-300 hover:shadow-md transition-all group text-left flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-zen-50 rounded-full flex items-center justify-center text-zen-600 group-hover:bg-zen-600 group-hover:text-white transition-colors">
                                <Calculator size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-lg group-hover:text-zen-700">薪資計算中心</h4>
                                <p className="text-gray-500 text-sm">統計講師時數與計算月薪</p>
                            </div>
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-zen-500" />
                    </button>

                    <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-800">
                        <p className="font-bold mb-1">💡 提示</p>
                        <p>您可以在這裡快速查看本月的師資成本。請點擊上方按鈕進入詳細報表。</p>
                    </div>
                </div>
            ) : (
                // --- STUDENT VIEW: My Classes ---
                <div className="p-6 space-y-8">
                    
                    {/* UPCOMING SECTION */}
                    <div>
                        <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
                            <Calendar className="text-zen-600" size={20} />
                            即將開始 ({upcomingBookings.length})
                        </h3>

                        {upcomingBookings.length === 0 ? (
                            <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
                                <p className="text-gray-400 text-sm mb-2">目前沒有預約未來課程</p>
                                <button onClick={onClose} className="text-zen-600 font-bold text-sm hover:underline">
                                    去逛逛課表
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {upcomingBookings.map((booking, idx) => {
                                    const dayName = ['週日','週一','週二','週三','週四','週五','週六'][booking.dayOfWeek === 7 ? 0 : booking.dayOfWeek];
                                    
                                    return (
                                        <div key={`${booking.id}-${booking.dateKey}-${idx}`} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-zen-300 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zen-100 text-zen-700">
                                                            {dayName} {booking.startTime}
                                                        </span>
                                                        <span className="text-gray-400 text-xs">
                                                            {booking.dateObj.toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'})}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-lg text-gray-800">{booking.title}</h4>
                                                    <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                                                        <MapPin size={12}/> {booking.location}
                                                    </p>
                                                </div>
                                                
                                                <button 
                                                    onClick={() => cancelClass(booking.id, undefined, booking.dateObj)}
                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                    title="取消預約"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* HISTORY SECTION (IF ANY) */}
                    {historyBookings.length > 0 && (
                        <div>
                            <h3 className="text-gray-500 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <History className="text-gray-400" size={18} />
                                歷史紀錄
                            </h3>
                            
                            <div className="space-y-2 opacity-80">
                                {historyBookings.map((booking, idx) => {
                                    const dayName = ['週日','週一','週二','週三','週四','週五','週六'][booking.dayOfWeek === 7 ? 0 : booking.dayOfWeek];
                                    
                                    return (
                                        <div key={`hist-${booking.id}-${booking.dateKey}-${idx}`} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-xs font-bold text-gray-500">
                                                        {booking.dateObj.toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'})}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {dayName} {booking.startTime}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-sm text-gray-600">{booking.title}</h4>
                                            </div>
                                            <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-1 rounded">
                                                已結束
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
      </div>

      {/* Nested Modal for Salary */}
      {showSalaryCalc && <SalaryCalculatorModal onClose={() => setShowSalaryCalc(false)} />}
    </div>
  );
};

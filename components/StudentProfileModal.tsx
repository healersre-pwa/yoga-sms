
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, User as UserIcon, CreditCard, Calendar, Trash2, MapPin, Camera, Edit2, Save, Loader2, Calculator, ChevronRight, Coins, Infinity, Phone, History, Clock, UserCog, KeyRound, Mail, ChevronDown } from 'lucide-react';
import { UserRole } from '../types';
import { SalaryCalculatorModal } from './SalaryCalculatorModal';

interface Props {
  onClose: () => void;
}

export const StudentProfileModal: React.FC<Props> = ({ onClose }) => {
  const { currentUser, classes, allClassesHistory, cancelClass, students, updateUser, resetStudentPassword } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(currentUser.name);
  const [newPhone, setNewPhone] = useState(currentUser.phoneNumber || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showSalaryCalc, setShowSalaryCalc] = useState(false);

  // 摺疊狀態
  const [expandUpcoming, setExpandUpcoming] = useState(true);

  const liveStudentData = students.find(s => s.id === currentUser.id) || currentUser;
  const isStudent = currentUser.role === UserRole.STUDENT;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  
  const membershipType = liveStudentData.membershipType || 'CREDIT';
  const credits = liveStudentData.credits || 0;
  const expiry = liveStudentData.unlimitedExpiry;

  // 取得該學生的未來預約紀錄
  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return allClassesHistory.flatMap(cls => {
      if (!cls.bookings) return [];
      const bookings = cls.bookings as Record<string, string[]>;
      return Object.entries(bookings)
          .filter(([dateKey, userIds]) => userIds.includes(currentUser.id))
          .map(([dateKey]) => {
              const [y, m, d] = dateKey.split('-').map(Number);
              const [h, min] = cls.startTimeStr.split(':').map(Number);
              const classStart = new Date(y, m - 1, d, h, min);
              
              if (classStart < now) return null; // 排除過去的紀錄

              return { 
                  id: cls.id, 
                  title: cls.title, 
                  location: cls.location, 
                  startTime: cls.startTimeStr, 
                  dayOfWeek: cls.dayOfWeek, 
                  dateObj: new Date(y, m - 1, d), 
                  dateKey,
                  pointsCost: cls.pointsCost ?? 1
              };
          }).filter(Boolean) as any[];
    }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [allClassesHistory, currentUser.id]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 500; canvas.height = 500;
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2; const sy = (img.height - minSide) / 2;
            if (ctx) { ctx.clearRect(0, 0, 500, 500); ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 500, 500); }
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            updateUser(currentUser.id, { avatarUrl: dataUrl }).then(() => setIsUploading(false));
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

  const handleSendResetEmail = async () => {
      setIsSendingReset(true);
      await resetStudentPassword(currentUser.id);
      setIsSendingReset(false);
      alert("密碼重設郵件已發送至您的信箱，請檢查收件匣。");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-zen-600 p-6 text-white relative shrink-0">
            <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors z-10"><X size={20} /></button>
            <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                    <div className="w-20 h-20 rounded-full shadow-xl overflow-hidden bg-white/20 relative flex items-center justify-center ring-1 ring-white/30">{isUploading ? (<div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20"><Loader2 className="animate-spin text-white" /></div>) : (currentUser.avatarUrl ? (<img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover"/>) : (isAdmin ? <UserCog size={32} className="text-white/50" /> : <UserIcon size={32} className="text-white/50" />))}<div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera size={16} /></div></div>
                    <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-white text-zen-600 p-1.5 rounded-full shadow-md hover:bg-gray-100 transition-colors z-20"><Camera size={14} /></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>
                <div className="flex-1 min-w-0 pr-10">
                    {isEditing ? (
                        <div className="space-y-2"><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-2 py-1 text-gray-900 rounded text-lg font-bold outline-none border border-white/50 focus:ring-2 focus:ring-white/50 bg-white/90" placeholder="姓名" autoFocus /><div className="flex items-center bg-white/20 rounded px-2 py-1"><Phone size={14} className="text-white/70 mr-2" /><input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="w-full bg-transparent text-sm text-white placeholder-white/50 outline-none" placeholder="電話號碼" /></div><button onClick={handleSaveProfile} className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 mt-1 font-bold"><Save size={12} /> 儲存</button></div>
                    ) : (
                        <div className="group"><div className="flex items-center gap-2 mb-1"><h2 className="text-2xl font-bold truncate">{currentUser.name}</h2><button onClick={() => setIsEditing(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded shrink-0"><Edit2 size={14} /></button></div><p className="text-zen-100 text-sm font-medium">@{currentUser.username}</p>{liveStudentData.phoneNumber && <p className="text-zen-100 text-xs mt-1 flex items-center gap-1"><Phone size={12}/> {liveStudentData.phoneNumber}</p>}</div>
                    )}
                    {!isEditing && isStudent && (<div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl text-xs font-bold ${membershipType === 'UNLIMITED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{membershipType === 'UNLIMITED' ? <Infinity size={14} /> : <Coins size={14} />}{membershipType === 'UNLIMITED' ? (<div className="flex flex-col leading-tight"><span className="whitespace-nowrap">課程自由</span><span className="text-[10px] opacity-80 font-medium">至 {expiry || '未設定'}</span></div>) : (<span>剩餘點數: {credits} 點</span>)}</div>)}
                </div>
            </div>
        </div>
        <div className="p-0 overflow-y-auto flex-1 bg-gray-50">
            {isAdmin ? (
                <div className="p-6">
                    <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2"><UserCog className="text-zen-600" size={20} />管理員功能</h3>
                    <button onClick={() => setShowSalaryCalc(true)} className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-zen-300 transition-all group text-left flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-zen-50 rounded-full flex items-center justify-center text-zen-600 group-hover:bg-zen-600 group-hover:text-white transition-colors"><Calculator size={24} /></div><div><h4 className="font-bold text-gray-800 text-lg group-hover:text-zen-700">薪資計算中心</h4><p className="text-gray-500 text-sm">統計講師時數與計算月薪</p></div></div><ChevronRight className="text-gray-300 group-hover:text-zen-500" /></button>
                </div>
            ) : (
                <div className="p-6 space-y-4">
                    {/* 即將開始 - 摺疊式 */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <button 
                            onClick={() => setExpandUpcoming(!expandUpcoming)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-2 text-gray-800 font-bold">
                                <Calendar className="text-zen-600" size={18} />
                                您的預約 ({upcomingBookings.length})
                            </div>
                            <ChevronDown size={18} className={`text-gray-400 transition-transform ${expandUpcoming ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {expandUpcoming && (
                            <div className="p-4 pt-0 space-y-3">
                                {upcomingBookings.length === 0 ? (
                                    <p className="text-center py-4 text-gray-400 text-xs italic">尚無即將開始的預約</p>
                                ) : (
                                    upcomingBookings.map((booking, idx) => {
                                        const dayName = ['週日','週一','週二','週三','週四','週五','週六'][booking.dayOfWeek === 7 ? 0 : booking.dayOfWeek];
                                        return (
                                            <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zen-500 text-white">{dayName} {booking.startTime}</span>
                                                        <span className="text-gray-400 text-[10px]">{booking.dateKey}</span>
                                                    </div>
                                                    <h4 className="font-bold text-sm text-gray-800">{booking.title}</h4>
                                                </div>
                                                <button onClick={() => cancelClass(booking.id, undefined, booking.dateObj)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* Security Section */}
                    <div>
                        <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2"><KeyRound className="text-zen-600" size={20} />帳號安全</h3>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                            <button 
                                onClick={handleSendResetEmail}
                                disabled={isSendingReset}
                                className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                            >
                                {isSendingReset ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                                寄送密碼重設信件
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
      {showSalaryCalc && <SalaryCalculatorModal onClose={() => setShowSalaryCalc(false)} />}
    </div>
  );
};

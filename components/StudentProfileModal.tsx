
import React, { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, User as UserIcon, CreditCard, Calendar, Trash2, MapPin, Camera, Edit2, Save, Loader2, Calculator, ChevronRight, Coins, Infinity, Phone, History, Clock, UserCog, KeyRound, Mail } from 'lucide-react';
import { UserRole } from '../types';
import { SalaryCalculatorModal } from './SalaryCalculatorModal';

interface Props {
  onClose: () => void;
}

export const StudentProfileModal: React.FC<Props> = ({ onClose }) => {
  const { currentUser, classes, cancelClass, students, updateUser, resetStudentPassword } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(currentUser.name);
  const [newPhone, setNewPhone] = useState(currentUser.phoneNumber || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showSalaryCalc, setShowSalaryCalc] = useState(false);

  const liveStudentData = students.find(s => s.id === currentUser.id) || currentUser;
  const isStudent = currentUser.role === UserRole.STUDENT;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  
  const membershipType = liveStudentData.membershipType || 'CREDIT';
  const credits = liveStudentData.credits || 0;
  const expiry = liveStudentData.unlimitedExpiry;

  const allBookings = classes.flatMap(cls => {
      if (!cls.bookings) return [];
      const bookings = cls.bookings as Record<string, string[]>;
      return Object.entries(bookings)
          .filter(([dateKey, userIds]) => userIds.includes(currentUser.id))
          .map(([dateKey]) => {
              const [y, m, d] = dateKey.split('-').map(Number);
              return { id: cls.id, title: cls.title, location: cls.location, startTime: cls.startTimeStr, dayOfWeek: cls.dayOfWeek, dateObj: new Date(y, m - 1, d), dateKey };
          });
  });

  const now = new Date();
  const upcomingBookings = allBookings.filter(b => {
      const [h, m] = b.startTime.split(':').map(Number);
      const classStart = new Date(b.dateObj);
      classStart.setHours(h, m, 0, 0);
      return classStart >= now;
  }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
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
                <div className="p-6 space-y-8">
                    {/* Security Section */}
                    <div>
                        <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2"><KeyRound className="text-zen-600" size={20} />帳號安全</h3>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                            <p className="text-xs text-gray-500">若您想要更改密碼，可以點擊下方按鈕獲取重設連結。</p>
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

                    <div><h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2"><Calendar className="text-zen-600" size={20} />即將開始 ({upcomingBookings.length})</h3>
                        {upcomingBookings.length === 0 ? (
                            <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-300"><p className="text-gray-400 text-sm mb-2">目前沒有預約未來課程</p><button onClick={onClose} className="text-zen-600 font-bold text-sm hover:underline">去逛逛課表</button></div>
                        ) : (
                            <div className="space-y-3">
                                {upcomingBookings.map((booking, idx) => {
                                    const dayName = ['週日','週一','週二','週三','週四','週五','週六'][booking.dayOfWeek === 7 ? 0 : booking.dayOfWeek];
                                    return (
                                        <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-zen-300 transition-colors"><div className="flex justify-between items-start"><div><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zen-100 text-zen-700">{dayName} {booking.startTime}</span><span className="text-gray-400 text-xs">{booking.dateObj.toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'})}</span></div><h4 className="font-bold text-lg text-gray-800">{booking.title}</h4><p className="text-gray-500 text-xs flex items-center gap-1 mt-1"><MapPin size={12}/> {booking.location}</p></div><button onClick={() => cancelClass(booking.id, undefined, booking.dateObj)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18} /></button></div></div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>
      {showSalaryCalc && <SalaryCalculatorModal onClose={() => setShowSalaryCalc(false)} />}
    </div>
  );
};

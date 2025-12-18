
import React, { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { User, ClassSession, MembershipType } from '../types';
import { X, Search, UserPlus, CreditCard, Lock, Trash2, AlertTriangle, User as UserIcon, Save, Calendar, Clock, MapPin, Camera, Loader2, ChevronLeft, KeyRound, Check, Coins, Infinity, Phone, History, ChevronDown, ChevronUp, Mail } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const StudentDirectoryModal: React.FC<Props> = ({ onClose }) => {
  const { students, classes, addStudent, updateStudent, deleteStudent, cancelClass, resetStudentPassword, adminCreateStudent } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [creditsInput, setCreditsInput] = useState('');
  
  const [formData, setFormData] = useState<Partial<User>>({
    name: '', username: '', email: '', password: '', phoneNumber: '', hasPaid: false, avatarUrl: '', membershipType: 'CREDIT', credits: 0, unlimitedExpiry: ''
  });

  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    return ( s.name.toLowerCase().includes(term) || s.username?.toLowerCase().includes(term) || s.email?.toLowerCase().includes(term) || s.id.toLowerCase().includes(term) || s.phoneNumber?.includes(term) );
  });

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const isEditing = selectedStudentId || isCreating;
  
  const allBookings = selectedStudentId 
    ? classes.flatMap(c => {
        const bookings = (c.bookings || {}) as Record<string, string[]>;
        return Object.entries(bookings)
            .filter(([date, userIds]) => userIds.includes(selectedStudentId))
            .map(([date]) => {
                const [y, m, d] = date.split('-').map(Number);
                const [h, min] = c.startTimeStr.split(':').map(Number);
                return { classId: c.id, title: c.title, startTime: c.startTimeStr, dayOfWeek: c.dayOfWeek, dateKey: date, dateObj: new Date(y, m - 1, d), fullDate: new Date(y, m - 1, d, h, min) };
            });
    }) : [];

  const now = new Date();
  const upcomingBookings = allBookings.filter(b => b.fullDate >= now).sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
  const historyBookings = allBookings.filter(b => b.fullDate < now).sort((a, b) => b.fullDate.getTime() - a.fullDate.getTime());

  const handleSelectStudent = (student: User) => {
    setSelectedStudentId(student.id); setIsCreating(false); setShowDeleteConfirm(false); setShowResetConfirm(false); setShowHistory(false); setShowSuccess(false);
    setCreditsInput((student.credits || 0).toString());
    setFormData({
        name: student.name, username: student.username, email: student.email || '', password: student.password, phoneNumber: student.phoneNumber || '', hasPaid: student.hasPaid, avatarUrl: student.avatarUrl, membershipType: student.membershipType || 'CREDIT', credits: student.credits || 0, unlimitedExpiry: student.unlimitedExpiry || ''
    });
  };

  const handleBackToList = () => { setSelectedStudentId(null); setIsCreating(false); setShowResetConfirm(false); setShowSuccess(false); };
  const handleCreateNew = () => {
    setSelectedStudentId(null); setIsCreating(true); setShowDeleteConfirm(false); setShowResetConfirm(false); setShowSuccess(false); setCreditsInput('0');
    setFormData({ name: '', username: '', email: '', password: '', phoneNumber: '', hasPaid: false, avatarUrl: '', membershipType: 'CREDIT', credits: 0, unlimitedExpiry: '' });
  };

  const handleSave = async () => {
    if (!formData.name) return;
    setIsSaving(true); setShowSuccess(false);
    try {
        const finalCredits = creditsInput === '' ? 0 : parseFloat(creditsInput);
        const dataToSave = { ...formData, credits: finalCredits };
        if (isCreating) {
            if (formData.email) {
                const tempPassword = formData.password || Math.random().toString(36).slice(-8);
                const result = await adminCreateStudent(formData.email, tempPassword, dataToSave);
                if (result.success) { alert(`✅ 建立成功！已發送密碼重置信至 ${formData.email}。`); handleBackToList(); }
                else alert(`建立失敗：${result.message}`);
            } else { const newId = addStudent(dataToSave); if (newId) { setSelectedStudentId(newId); setIsCreating(false); } }
        } else if (selectedStudentId) { await updateStudent(selectedStudentId, dataToSave); }
        setShowSuccess(true); setTimeout(() => setShowSuccess(false), 2000);
    } finally { setIsSaving(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("圖片大小請小於 2MB"); return; }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 500; canvas.height = 500;
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2; const sy = (img.height - minSide) / 2;
            ctx?.drawImage(img, sx, sy, minSide, minSide, 0, 0, 500, 500);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setFormData(prev => ({ ...prev, avatarUrl: dataUrl }));
            setIsUploading(false);
            if (selectedStudentId) updateStudent(selectedStudentId, { avatarUrl: dataUrl });
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-100 sm:bg-black/50 sm:backdrop-blur-sm sm:p-4">
      <div className="bg-white w-full h-full sm:rounded-2xl sm:shadow-2xl sm:max-w-5xl sm:h-[85vh] flex overflow-hidden relative">
        <div className={`w-full md:w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col ${isEditing ? 'hidden md:flex' : 'flex h-full'}`}>
            <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 flex justify-between items-center"><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><UserIcon size={24} className="text-zen-600"/>學生名錄</h2><button onClick={onClose} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full"><X size={28} /></button></div>
            <div className="p-4 border-b border-gray-200 bg-gray-50"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} /><input type="text" placeholder="搜尋學生 (姓名/Email/電話)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zen-500 text-gray-900 bg-white" /></div></div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 pb-20">
                <button onClick={handleCreateNew} className="w-full flex items-center gap-4 p-4 rounded-xl text-left text-zen-700 bg-zen-50 hover:bg-zen-100 border border-zen-200 transition-colors mb-2"><div className="w-10 h-10 rounded-full bg-zen-200 flex items-center justify-center"><UserPlus size={20} /></div><span className="font-bold text-base">新增學生 (手動建檔)</span></button>
                {filteredStudents.map(student => (
                    <button key={student.id} onClick={() => handleSelectStudent(student)} className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors ${selectedStudentId === student.id ? 'bg-white shadow-md ring-1 ring-gray-200 border-l-4 border-l-zen-600' : 'hover:bg-gray-100 bg-white border border-gray-100'}`}>
                        <div className={`w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-gray-200 ring-1 ring-black/5`}>
                            {student.avatarUrl ? <img src={student.avatarUrl} alt={student.name} className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-gray-400" />}
                        </div>
                        <div className="overflow-hidden flex-1"><p className="font-bold text-lg text-gray-900 truncate">{student.name}</p><p className="text-sm text-gray-500 truncate">{student.email || student.username}</p></div>
                    </button>
                ))}
            </div>
        </div>
        <div className={`flex-1 bg-white flex flex-col w-full h-full ${isEditing ? 'flex fixed inset-0 sm:static z-20' : 'hidden md:flex'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white z-30 sticky top-0"><button onClick={handleBackToList} className="md:hidden flex items-center gap-1 text-gray-600 font-medium px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"><ChevronLeft size={20} />返回列表</button><div className="flex-1"></div><button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"><X size={28} /></button></div>
            {isEditing ? (
                <div className="flex-1 overflow-y-auto px-6 pb-32 sm:px-12 sm:pb-12 bg-white">
                    <div className="flex items-center gap-6 mb-8 mt-6">
                         <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden relative group cursor-pointer shadow-lg ring-1 ring-black/5 shrink-0" onClick={() => fileInputRef.current?.click()}>
                             {isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10"><Loader2 className="animate-spin text-white" size={32} /></div>}
                             {formData.avatarUrl ? <img src={formData.avatarUrl} alt="avatar" className="w-full h-full object-cover"/> : <UserIcon size={48} className="text-gray-300"/>}
                             <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={24} className="text-white" /></div>
                         </div>
                         <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                         <div><h1 className="text-2xl font-bold text-gray-800">{formData.name || (isCreating ? '新學生' : '未命名')}</h1><p className="text-gray-500">{isCreating ? '建立新帳號' : `ID: ${selectedStudentId}`}</p></div>
                    </div>
                    <div className="space-y-8 max-w-lg mx-auto sm:mx-0">
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
                            <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2"><CreditCard size={20} />會員資格設定</h3>
                            <div className="flex bg-white rounded-xl p-1.5 border border-gray-200 mb-6">
                                <button onClick={() => setFormData({...formData, membershipType: 'CREDIT'})} className={`flex-1 py-3 text-sm font-bold rounded-lg ${formData.membershipType === 'CREDIT' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>扣點制</button>
                                <button onClick={() => setFormData({...formData, membershipType: 'UNLIMITED'})} className={`flex-1 py-3 text-sm font-bold rounded-lg ${formData.membershipType === 'UNLIMITED' ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}>課程自由</button>
                            </div>
                            {formData.membershipType === 'UNLIMITED' ? (
                                <input type="date" value={formData.unlimitedExpiry || ''} onChange={(e) => setFormData({...formData, unlimitedExpiry: e.target.value})} className="w-full p-4 bg-white border border-gray-200 rounded-xl" />
                            ) : (
                                <div className="flex items-center gap-4"><input type="text" value={creditsInput} onChange={(e) => setCreditsInput(e.target.value)} className="flex-1 p-3 bg-white border border-gray-200 rounded-xl text-center font-bold text-2xl" /></div>
                            )}
                        </div>
                        <div className="space-y-4">
                            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 border rounded-xl" placeholder="姓名" />
                            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-4 border rounded-xl" placeholder="Email" />
                            <input type="tel" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} className="w-full p-4 border rounded-xl" placeholder="電話" />
                        </div>
                        <div className="pt-6 flex justify-end pb-10"><button onClick={handleSave} className="bg-zen-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg">儲存變更</button></div>
                    </div>
                </div>
            ) : ( <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8 text-center"><UserIcon size={80} className="mb-6 text-gray-200" /><p className="text-xl font-medium text-gray-400">請選擇學生以檢視詳情</p></div> )}
        </div>
      </div>
    </div>
  );
};

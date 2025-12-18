
import React, { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { User, UserRole, MembershipType } from '../types';
import { X, Search, UserPlus, CreditCard, User as UserIcon, Save, Camera, Loader2, ChevronLeft, Check, Coins } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const StudentDirectoryModal: React.FC<Props> = ({ onClose }) => {
  const { students, addStudent, updateStudent, adminCreateStudent } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [creditsInput, setCreditsInput] = useState('');
  
  const [formData, setFormData] = useState<Partial<User>>({
    name: '', username: '', email: '', password: '', phoneNumber: '', hasPaid: false, avatarUrl: '', membershipType: 'CREDIT', credits: 0, unlimitedExpiry: ''
  });

  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    return ( 
        s.name.toLowerCase().includes(term) || 
        (s.username || '').toLowerCase().includes(term) || 
        (s.email || '').toLowerCase().includes(term) || 
        s.id.toLowerCase().includes(term) || 
        (s.phoneNumber || '').includes(term) 
    );
  });

  // FIX: Define isEditing to check if a student is being edited or created
  const isEditing = !!selectedStudentId || isCreating;

  const handleSelectStudent = (student: User) => {
    setSelectedStudentId(student.id); 
    setIsCreating(false); 
    setShowSuccess(false);
    setCreditsInput((student.credits || 0).toString());
    setFormData({
        name: student.name, 
        username: student.username || '', 
        email: student.email || '', 
        phoneNumber: student.phoneNumber || '', 
        hasPaid: !!student.hasPaid, 
        avatarUrl: student.avatarUrl || '', 
        membershipType: student.membershipType || 'CREDIT', 
        credits: student.credits || 0, 
        unlimitedExpiry: student.unlimitedExpiry || ''
    });
  };

  const handleBackToList = () => { setSelectedStudentId(null); setIsCreating(false); setShowSuccess(false); };
  
  const handleCreateNew = () => {
    setSelectedStudentId(null); 
    setIsCreating(true); 
    setShowSuccess(false); 
    setCreditsInput('0');
    setFormData({ 
        name: '', username: '', email: '', password: '', phoneNumber: '', 
        hasPaid: false, avatarUrl: '', membershipType: 'CREDIT', credits: 0, unlimitedExpiry: '' 
    });
  };

  const handleSave = async () => {
    if (!formData.name) { alert("請輸入姓名"); return; }
    setIsSaving(true);
    
    try {
        const finalCredits = creditsInput === '' ? 0 : parseFloat(creditsInput);
        
        // 資料清理：移除不合法的欄位以防 Firestore 報錯
        const { password, id, ...cleanData } = formData;
        const dataToSave = { 
            ...cleanData, 
            credits: isNaN(finalCredits) ? 0 : finalCredits,
            membershipType: formData.membershipType || 'CREDIT'
        };

        // 移除所有 undefined 的屬性
        Object.keys(dataToSave).forEach(key => {
            if ((dataToSave as any)[key] === undefined) delete (dataToSave as any)[key];
        });
        
        if (isCreating) {
            if (formData.email) {
                const tempPassword = formData.password || Math.random().toString(36).slice(-8);
                const result = await adminCreateStudent(formData.email, tempPassword, dataToSave);
                if (result.success) { 
                    alert(`✅ 建立成功！已發送密碼重置信至 ${formData.email}。`); 
                    handleBackToList(); 
                } else {
                    alert(`建立失敗：${result.message}`);
                }
            } else { 
                const newId = await addStudent(dataToSave); 
                if (newId) { setSelectedStudentId(newId); setIsCreating(false); } 
            }
        } else if (selectedStudentId) { 
            await updateStudent(selectedStudentId, dataToSave); 
        }
        
        setShowSuccess(true); 
        setTimeout(() => setShowSuccess(false), 2000);
    } catch (e: any) {
        console.error("Save Error:", e);
        alert(`儲存失敗: ${e.message || '請檢查網路連線'}`);
    } finally { 
        setIsSaving(false); 
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
        {/* 左側列表 */}
        <div className={`w-full md:w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col ${isEditing ? 'hidden md:flex' : 'flex h-full'}`}>
            <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <UserIcon size={24} className="text-zen-600"/>學生名錄
                </h2>
                <button onClick={onClose} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full"><X size={28} /></button>
            </div>
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input type="text" placeholder="搜尋學生 (姓名/Email/電話)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zen-500 text-gray-900 bg-white" />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 pb-20">
                <button onClick={handleCreateNew} className="w-full flex items-center gap-4 p-4 rounded-xl text-left text-zen-700 bg-zen-50 hover:bg-zen-100 border border-zen-200 transition-colors mb-2">
                    <div className="w-10 h-10 rounded-full bg-zen-200 flex items-center justify-center"><UserPlus size={20} /></div>
                    <span className="font-bold text-base">新增學生 (手動建檔)</span>
                </button>
                {filteredStudents.map(student => {
                    const isUnlimited = student.membershipType === 'UNLIMITED';
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOutOfCredits = !isUnlimited && (student.credits || 0) <= 0;
                    const isExpired = isUnlimited && (!student.unlimitedExpiry || student.unlimitedExpiry < todayStr);
                    
                    let statusStyle = "border-blue-100 bg-blue-50/30"; // 預設藍色 (扣點)
                    if (isUnlimited) {
                        statusStyle = isExpired ? "border-red-100 bg-red-50/30" : "border-green-100 bg-green-50/30";
                    } else if (isOutOfCredits) {
                        statusStyle = "border-red-100 bg-red-50/30";
                    }

                    return (
                        <button 
                            key={student.id} 
                            onClick={() => handleSelectStudent(student)} 
                            className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all border ${statusStyle} ${selectedStudentId === student.id ? 'shadow-md ring-2 ring-zen-500/20 !border-zen-500 z-10' : 'hover:shadow-sm'}`}
                        >
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-gray-200 ring-1 ring-black/5">
                                {student.avatarUrl ? <img src={student.avatarUrl} alt={student.name} className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-gray-400" />}
                            </div>
                            <div className="overflow-hidden flex-1">
                                <p className="font-bold text-lg text-gray-900 truncate">{student.name}</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-gray-500 truncate">{student.email || student.username}</p>
                                    <span className={`text-[10px] font-bold px-1.5 rounded-full ${isUnlimited ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {isUnlimited ? '自由' : `${student.credits || 0}點`}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* 右側編輯區 */}
        <div className={`flex-1 bg-white flex flex-col w-full h-full ${isEditing ? 'flex fixed inset-0 sm:static z-20' : 'hidden md:flex'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white z-30 sticky top-0">
                <button onClick={handleBackToList} className="md:hidden flex items-center gap-1 text-gray-600 font-medium px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"><ChevronLeft size={20} />返回列表</button>
                <div className="flex-1"></div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"><X size={28} /></button>
            </div>
            {isEditing ? (
                <div className="flex-1 overflow-y-auto px-6 pb-32 sm:px-12 sm:pb-12 bg-white">
                    <div className="flex items-center gap-6 mb-8 mt-6">
                         <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden relative group cursor-pointer shadow-lg ring-1 ring-black/5 shrink-0" onClick={() => fileInputRef.current?.click()}>
                             {isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10"><Loader2 className="animate-spin text-white" size={32} /></div>}
                             {formData.avatarUrl ? <img src={formData.avatarUrl} alt="avatar" className="w-full h-full object-cover"/> : <UserIcon size={48} className="text-gray-300"/>}
                             <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={24} className="text-white" /></div>
                         </div>
                         <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                         <div className="min-w-0 flex-1">
                             <h1 className="text-2xl font-bold text-gray-800 truncate">{formData.name || (isCreating ? '新學生' : '未命名')}</h1>
                             <div className="mt-1">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">ID:</p>
                                <p className="text-[13px] text-gray-500 font-mono break-all leading-tight">{selectedStudentId || '系統自動產生'}</p>
                             </div>
                         </div>
                    </div>
                    <div className="space-y-8 max-w-lg mx-auto sm:mx-0">
                        <div className="p-4 sm:p-6 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                            <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2"><CreditCard size={20} />會員資格設定</h3>
                            <div className="flex bg-white rounded-xl p-1 border border-gray-200 mb-6">
                                <button onClick={() => setFormData({...formData, membershipType: 'CREDIT'})} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${formData.membershipType === 'CREDIT' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-400'}`}>扣點制</button>
                                <button onClick={() => setFormData({...formData, membershipType: 'UNLIMITED'})} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${formData.membershipType === 'UNLIMITED' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-400'}`}>課程自由</button>
                            </div>
                            {formData.membershipType === 'UNLIMITED' ? (
                                <div className="w-full space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase">會籍到期日</label>
                                    <input type="date" value={formData.unlimitedExpiry || ''} onChange={(e) => setFormData({...formData, unlimitedExpiry: e.target.value})} className="w-full p-4 bg-white border-2 border-gray-300 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-zen-500 outline-none" />
                                </div>
                            ) : (
                                <div className="w-full">
                                    <input 
                                        type="number" 
                                        inputMode="decimal"
                                        step="any"
                                        value={creditsInput} 
                                        onChange={(e) => setCreditsInput(e.target.value)} 
                                        className="w-full p-5 bg-white border-2 border-gray-300 rounded-2xl text-center font-black text-4xl text-gray-900 shadow-inner focus:border-zen-500 focus:ring-4 focus:ring-zen-500/10 outline-none transition-all box-border" 
                                        style={{ colorScheme: 'light' }}
                                    />
                                    <p className="text-center text-xs text-gray-400 mt-2 font-medium">請輸入剩餘點數</p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
                            <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none text-gray-900 font-medium" placeholder="姓名" />
                            <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none text-gray-900 font-medium" placeholder="Email" />
                            <input type="tel" value={formData.phoneNumber || ''} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none text-gray-900 font-medium" placeholder="電話" />
                        </div>
                        <div className="pt-6 flex justify-end pb-10">
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="w-full sm:w-auto bg-zen-600 text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-zen-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                {isSaving ? '處理中...' : '儲存變更'}
                                {showSuccess && <Check className="text-white ml-1" size={18} />}
                            </button>
                        </div>
                    </div>
                </div>
            ) : ( <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8 text-center"><UserIcon size={80} className="mb-6 text-gray-200" /><p className="text-xl font-medium text-gray-400">請選擇學生以檢視詳情</p></div> )}
        </div>
      </div>
    </div>
  );
};

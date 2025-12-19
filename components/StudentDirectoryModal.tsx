
import React, { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { User, UserRole, MembershipType } from '../types';
import { X, Search, UserPlus, CreditCard, User as UserIcon, Save, Camera, Loader2, ChevronLeft, Check, Coins, Trash2, Mail, AlertTriangle, KeyRound } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const StudentDirectoryModal: React.FC<Props> = ({ onClose }) => {
  const { students, addStudent, updateStudent, adminCreateStudent, deleteStudent, resetStudentPassword } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [creditsInput, setCreditsInput] = useState('');
  
  const [formData, setFormData] = useState<Partial<User>>({
    name: '', username: '', email: '', password: '123123', phoneNumber: '', hasPaid: false, avatarUrl: '', membershipType: 'CREDIT', credits: 0, unlimitedExpiry: ''
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

  const isEditing = !!selectedStudentId || isCreating;

  const handleSelectStudent = (student: User) => {
    setSelectedStudentId(student.id); 
    setIsCreating(false); 
    setShowSuccess(false);
    setShowDeleteConfirm(false);
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

  const handleBackToList = () => { 
      setSelectedStudentId(null); 
      setIsCreating(false); 
      setShowSuccess(false); 
      setShowDeleteConfirm(false); 
  };
  
  const handleCreateNew = () => {
    setSelectedStudentId(null); 
    setIsCreating(true); 
    setShowSuccess(false); 
    setShowDeleteConfirm(false);
    setCreditsInput('0');
    setSendEmail(false);
    setFormData({ 
        name: '', username: '', email: '', password: '123123', phoneNumber: '', 
        hasPaid: false, avatarUrl: '', membershipType: 'CREDIT', credits: 0, unlimitedExpiry: '' 
    });
  };

  const handleSendReset = async () => {
      if (!selectedStudentId) return;
      setIsSendingReset(true);
      await resetStudentPassword(selectedStudentId);
      setIsSendingReset(false);
      alert("密碼重設郵件已發送至該學生信箱。");
  };

  const handleSave = async () => {
    if (!formData.name) { alert("請輸入姓名"); return; }
    setIsSaving(true);
    try {
        const finalCredits = creditsInput === '' ? 0 : parseFloat(creditsInput);
        const { password, id, ...cleanData } = formData;
        const dataToSave = { ...cleanData, credits: isNaN(finalCredits) ? 0 : finalCredits, membershipType: formData.membershipType || 'CREDIT' };
        if (isCreating) {
            if (formData.email) {
                const result = await adminCreateStudent(formData.email, formData.password || "123123", dataToSave, sendEmail);
                if (result.success) { alert(sendEmail ? `✅ 建立成功！已發信通知學生。` : `✅ 建立成功！預設密碼為 123123。`); handleBackToList(); }
                else alert(`建立失敗：${result.message}`);
            } else { 
                const newId = await addStudent(dataToSave); 
                if (newId) { setSelectedStudentId(newId); setIsCreating(false); } 
            }
        } else if (selectedStudentId) { 
            await updateStudent(selectedStudentId, dataToSave); 
        }
        setShowSuccess(true); 
        setTimeout(() => setShowSuccess(false), 2000);
    } catch (e: any) { alert(`儲存失敗: ${e.message}`); } finally { setIsSaving(false); }
  };

  const handleExecuteDelete = async () => {
      if (!selectedStudentId) return;
      setIsSaving(true);
      try {
          const res = await deleteStudent(selectedStudentId);
          if (res.success) handleBackToList();
          else alert(res.message || "刪除失敗");
      } catch (err) { alert("發生錯誤，無法刪除。"); } finally { setIsSaving(false); }
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
            <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 flex justify-between items-center"><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><UserIcon size={24} className="text-zen-600"/>學生名錄</h2><button onClick={onClose} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full"><X size={28} /></button></div>
            <div className="p-4 border-b border-gray-200 bg-gray-50"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} /><input type="text" placeholder="搜尋學生 (姓名/Email/電話)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zen-500 text-gray-900 bg-white" /></div></div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 pb-20">
                <button onClick={handleCreateNew} className="w-full flex items-center gap-4 p-4 rounded-xl text-left text-zen-700 bg-zen-50 hover:bg-zen-100 border border-zen-200 transition-colors mb-2"><div className="w-10 h-10 rounded-full bg-zen-200 flex items-center justify-center"><UserPlus size={20} /></div><span className="font-bold text-base">新增學生 (手動建檔)</span></button>
                {filteredStudents.map(student => {
                    const isUnlimited = student.membershipType === 'UNLIMITED';
                    const isOutOfCredits = !isUnlimited && (student.credits || 0) <= 0;
                    let statusStyle = isUnlimited ? "border-green-100 bg-green-50/30" : (isOutOfCredits ? "border-red-100 bg-red-50/30" : "border-blue-100 bg-blue-50/30");
                    return (
                        <button key={student.id} onClick={() => handleSelectStudent(student)} className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all border ${statusStyle} ${selectedStudentId === student.id ? 'shadow-md ring-2 ring-zen-500/20 !border-zen-500 z-10' : 'hover:shadow-sm'}`}>
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-gray-200 ring-1 ring-black/5">{student.avatarUrl ? <img src={student.avatarUrl} alt={student.name} className="w-full h-full object-cover" /> : <UserIcon size={20} className="text-gray-400" />}</div>
                            <div className="overflow-hidden flex-1"><p className="font-bold text-lg text-gray-900 truncate">{student.name}</p><div className="flex items-center gap-2"><p className="text-xs text-gray-500 truncate">{student.email || student.username}</p><span className={`text-[10px] font-bold px-1.5 rounded-full ${isUnlimited ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{isUnlimited ? '自由' : `${student.credits || 0}點`}</span></div></div>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* 右側編輯區 */}
        <div className={`flex-1 bg-white flex flex-col w-full h-full ${isEditing ? 'flex fixed inset-0 sm:static z-20' : 'hidden md:flex'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white z-30 sticky top-0"><button onClick={handleBackToList} className="md:hidden flex items-center gap-1 text-gray-600 font-medium px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"><ChevronLeft size={20} />返回列表</button><div className="flex-1"></div><button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"><X size={28} /></button></div>
            {isEditing ? (
                <div className="flex-1 overflow-y-auto px-6 pb-32 sm:px-12 sm:pb-12 bg-white">
                    <div className="flex items-center gap-6 mb-8 mt-6">
                         <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden relative group cursor-pointer shadow-lg ring-1 ring-black/5 shrink-0" onClick={() => fileInputRef.current?.click()}>{isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10"><Loader2 className="animate-spin text-white" size={32} /></div>}{formData.avatarUrl ? <img src={formData.avatarUrl} alt="avatar" className="w-full h-full object-cover"/> : <UserIcon size={48} className="text-gray-300"/>}<div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={24} className="text-white" /></div></div>
                         <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                         <div className="min-w-0 flex-1"><h1 className="text-2xl font-bold text-gray-800 truncate">{formData.name || (isCreating ? '新學生' : '未命名')}</h1><div className="mt-1"><p className="text-xs text-gray-400 font-bold uppercase tracking-widest">ID:</p><p className="text-[13px] text-gray-500 font-mono break-all leading-tight">{selectedStudentId || '系統自動產生'}</p></div></div>
                    </div>
                    <div className="space-y-8 max-w-lg mx-auto sm:mx-0">
                        {isCreating && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3"><h4 className="text-sm font-bold text-blue-800 flex items-center gap-2"><Mail size={16}/> 帳號建立設定</h4><p className="text-xs text-blue-600">手動建立學生帳號，預設密碼將為 <span className="font-bold underline">123123</span>。</p><label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors"><input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-5 h-5 accent-blue-600"/><span className="text-sm font-bold text-blue-700">發送密碼重設郵件通知學生</span></label></div>
                        )}

                        <div className="p-4 sm:p-6 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden"><h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2"><CreditCard size={20} />會員資格設定</h3><div className="flex bg-white rounded-xl p-1 border border-gray-200 mb-6"><button onClick={() => setFormData({...formData, membershipType: 'CREDIT'})} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${formData.membershipType === 'CREDIT' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-400'}`}>扣點制</button><button onClick={() => setFormData({...formData, membershipType: 'UNLIMITED'})} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${formData.membershipType === 'UNLIMITED' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-400'}`}>課程自由</button></div>{formData.membershipType === 'UNLIMITED' ? (<div className="w-full space-y-2"><label className="text-xs font-bold text-gray-400 uppercase">會籍到期日</label><input type="date" value={formData.unlimitedExpiry || ''} onChange={(e) => setFormData({...formData, unlimitedExpiry: e.target.value})} className="w-full p-4 bg-white border-2 border-gray-300 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-zen-500 outline-none" /></div>) : (<div className="w-full"><input type="number" inputMode="decimal" step="any" value={creditsInput} onChange={(e) => setCreditsInput(e.target.value)} className="w-full p-5 bg-white border-2 border-gray-300 rounded-2xl text-center font-black text-4xl text-gray-900 shadow-inner focus:border-zen-500 focus:ring-4 focus:ring-zen-500/10 outline-none transition-all box-border" style={{ colorScheme: 'light' }}/><p className="text-center text-xs text-gray-400 mt-2 font-medium">請輸入剩餘點數</p></div>)}</div>
                        <div className="space-y-4"><input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none text-gray-900 font-medium" placeholder="姓名" /><input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none text-gray-900 font-medium" placeholder="Email (登入帳號)" /><input type="tel" value={formData.phoneNumber || ''} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 outline-none text-gray-900 font-medium" placeholder="電話" /></div>
                        
                        {!isCreating && (
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-3"><KeyRound size={16}/> 安全性與密碼</h4>
                                <button onClick={handleSendReset} disabled={isSendingReset} className="w-full bg-white border border-amber-200 text-amber-700 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-amber-100 flex items-center justify-center gap-2">
                                    {isSendingReset ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                                    發送密碼重設郵件 (至學生信箱)
                                </button>
                                <p className="text-[10px] text-amber-600 mt-2">若學生遺忘密碼，可點此發送連結讓學生自行重設。預設為安全性最高的郵件重設流程。</p>
                            </div>
                        )}

                        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 pb-20">
                            {selectedStudentId && (
                                <div className="w-full sm:w-auto">{showDeleteConfirm ? (<div className="flex gap-2 animate-in slide-in-from-left-2 duration-200"><button type="button" onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold">取消</button><button type="button" onClick={handleExecuteDelete} disabled={isSaving} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-red-100">{isSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}確定刪除</button></div>) : (<button type="button" onClick={() => setShowDeleteConfirm(true)} className="w-full sm:w-auto text-red-500 hover:text-red-700 font-bold flex items-center justify-center gap-1.5 p-3 sm:p-0"><Trash2 size={18}/> 刪除此帳號</button>)}</div>
                            )}
                            <div className="flex-1 sm:hidden"></div>
                            <button type="button" onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto bg-zen-600 text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-zen-200 active:scale-95 transition-all flex items-center justify-center gap-2">{isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}{isSaving ? '處理中...' : '儲存變更'}{showSuccess && <Check className="text-white ml-1" size={18} />}</button>
                        </div>
                    </div>
                </div>
            ) : ( <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8 text-center"><UserIcon size={80} className="mb-6 text-gray-200" /><p className="text-xl font-medium text-gray-400">請選擇學生以檢視詳情</p></div> )}
        </div>
      </div>
    </div>
  );
};

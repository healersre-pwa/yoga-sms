
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
  const [showHistory, setShowHistory] = useState(false); // Toggle for history
  
  // Feedback States
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset Password UI State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Image Upload Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form State - creditsInput string handles the "empty input" case comfortably
  const [creditsInput, setCreditsInput] = useState('');
  
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    username: '',
    email: '',
    password: '',
    phoneNumber: '',
    hasPaid: false,
    avatarUrl: '',
    membershipType: 'CREDIT',
    credits: 0,
    unlimitedExpiry: ''
  });

  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    return (
        s.name.toLowerCase().includes(term) || 
        s.username?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) || 
        s.phoneNumber?.includes(term)
    );
  });

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const isEditing = selectedStudentId || isCreating;
  
  // Get classes the selected student has booked
  const allBookings = selectedStudentId 
    ? classes.flatMap(c => {
        const bookings = (c.bookings || {}) as Record<string, string[]>;
        return Object.entries(bookings)
            .filter(([date, userIds]) => userIds.includes(selectedStudentId))
            .map(([date]) => {
                const [y, m, d] = date.split('-').map(Number);
                const [h, min] = c.startTimeStr.split(':').map(Number);
                const dateObj = new Date(y, m - 1, d);
                // Create a precise date object for sorting including time
                const fullDate = new Date(y, m - 1, d, h, min);
                
                return {
                    classId: c.id,
                    title: c.title,
                    startTime: c.startTimeStr,
                    dayOfWeek: c.dayOfWeek,
                    dateKey: date,
                    dateObj: dateObj,
                    fullDate: fullDate
                };
            });
    })
    : [];

  // Split into Upcoming and History
  const now = new Date();
  const upcomingBookings = allBookings
    .filter(b => b.fullDate >= now)
    .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime()); // Ascending for upcoming

  const historyBookings = allBookings
    .filter(b => b.fullDate < now)
    .sort((a, b) => b.fullDate.getTime() - a.fullDate.getTime()); // Descending for history

  const handleSelectStudent = (student: User) => {
    setSelectedStudentId(student.id);
    setIsCreating(false);
    setShowDeleteConfirm(false); 
    setShowResetConfirm(false);
    setShowHistory(false); // Reset history toggle
    setShowSuccess(false);
    
    // Convert credits to string for input handling
    const safeCredits = student.credits || 0;
    setCreditsInput(safeCredits.toString());

    setFormData({
        name: student.name,
        username: student.username,
        email: student.email || '',
        password: student.password,
        phoneNumber: student.phoneNumber || '',
        hasPaid: student.hasPaid,
        avatarUrl: student.avatarUrl,
        membershipType: student.membershipType || 'CREDIT',
        credits: safeCredits,
        unlimitedExpiry: student.unlimitedExpiry || ''
    });
  };

  const handleBackToList = () => {
      setSelectedStudentId(null);
      setIsCreating(false);
      setShowResetConfirm(false);
      setShowSuccess(false);
  };

  const handleCreateNew = () => {
    setSelectedStudentId(null);
    setIsCreating(true);
    setShowDeleteConfirm(false);
    setShowResetConfirm(false);
    setShowSuccess(false);
    setCreditsInput('0');
    setFormData({
        name: '',
        username: '',
        email: '',
        password: '',
        phoneNumber: '',
        hasPaid: false,
        avatarUrl: '',
        membershipType: 'CREDIT',
        credits: 0,
        unlimitedExpiry: ''
    });
  };

  const handleSave = async () => {
    if (!formData.name) return;
    setIsSaving(true);
    setShowSuccess(false);

    try {
        // Sync credits input back to number
        const finalCredits = creditsInput === '' ? 0 : parseFloat(creditsInput);
        
        // Create raw data object
        const rawData = { ...formData, credits: finalCredits };
        
        // Sanitize: Remove undefined values to prevent Firestore error "Unsupported field value: undefined"
        const dataToSave = Object.entries(rawData).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key] = value;
            }
            return acc;
        }, {} as any);

        if (isCreating) {
            // New Logic: Check if Email is present for real Auth creation
            if (formData.email) {
                const tempPassword = formData.password || Math.random().toString(36).slice(-8); // Generate random if not provided (though input is usually hidden)
                
                const result = await adminCreateStudent(formData.email, tempPassword, dataToSave);
                
                if (result.success) {
                    alert(`✅ 建立成功！\n\n已發送密碼重置信至 ${formData.email}。\n請學生收信並設定新密碼。`);
                    handleBackToList(); // Return to list to refresh
                } else {
                    alert(`建立失敗：${result.message}`);
                }
            } else {
                // Legacy: Ghost user (No Auth)
                const newId = addStudent(dataToSave);
                if (newId) {
                    setSelectedStudentId(newId);
                    setIsCreating(false);
                }
            }
        } else if (selectedStudentId) {
            await updateStudent(selectedStudentId, dataToSave);
        }
        
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
    } catch (e) {
        console.error("Save Error:", e);
        alert("儲存失敗");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStudentId) return;
    
    setIsDeleting(true);
    try {
        const result = await deleteStudent(selectedStudentId);
        
        if (!result.success) {
            alert(result.message || "刪除失敗");
        } else {
            if (result.message) {
                // Warning message about Partial delete (Auth still exists)
                alert(result.message);
            }
            handleBackToList();
            setFormData({ name: '', username: '', email: '', password: '', phoneNumber: '', hasPaid: false, avatarUrl: '' });
        }
    } catch (e) {
        console.error(e);
        alert("系統錯誤");
    } finally {
        setIsDeleting(false);
    }
  };
  
  const handleResetPassword = async () => {
      if (!selectedStudentId) return;
      await resetStudentPassword(selectedStudentId);
      setShowResetConfirm(false);
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
            ctx?.drawImage(img, 0, 0, 500, 500);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setFormData(prev => ({ ...prev, avatarUrl: dataUrl }));
            setIsUploading(false);
            if (selectedStudentId) updateStudent(selectedStudentId, { avatarUrl: dataUrl });
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Membership Logic
  const changeMembership = (type: MembershipType) => {
      setFormData(prev => ({ ...prev, membershipType: type }));
  };
  
  // Credits Change Handler for Input
  const handleCreditsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Allow empty string or numbers
      if (val === '' || /^\d*\.?\d*$/.test(val)) {
          setCreditsInput(val);
          // Also update form data roughly to keep sync, but handleSave uses creditsInput
          setFormData(prev => ({ ...prev, credits: val === '' ? 0 : parseFloat(val) }));
      }
  };
  
  // +/- Button Handlers
  const adjustCredits = (delta: number) => {
      const current = creditsInput === '' ? 0 : parseFloat(creditsInput);
      const newVal = Math.max(0, current + delta);
      setCreditsInput(newVal.toString());
      setFormData(prev => ({ ...prev, credits: newVal }));
  };

  const renderBookingItem = (bk: any) => {
      const dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
      const dayStr = bk.dayOfWeek === 7 ? '週日' : dayMap[bk.dayOfWeek];
      
      return (
          <div key={`${bk.classId}-${bk.dateKey}`} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-zen-300 transition-colors shadow-sm">
              <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-bold text-zen-700 bg-zen-50 px-2.5 py-1 rounded-full">
                          {dayStr} {bk.startTime}
                      </span>
                      <span className="text-sm text-gray-400 flex items-center gap-1">
                          {bk.dateObj.toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'})}
                      </span>
                  </div>
                  <p className="text-base font-bold text-gray-800">{bk.title}</p>
              </div>
              <button 
                  onClick={() => cancelClass(bk.classId, selectedStudentId, bk.dateObj)}
                  className="text-red-500 hover:bg-red-50 p-3 rounded-xl transition-colors bg-white border border-red-100"
                  title="取消此預約"
              >
                  <Trash2 size={20} />
              </button>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-100 sm:bg-black/50 sm:backdrop-blur-sm sm:p-4">
      <div className="bg-white w-full h-full sm:rounded-2xl sm:shadow-2xl sm:max-w-5xl sm:h-[85vh] flex overflow-hidden relative">
        
        {/* --- LEFT SIDEBAR (LIST) --- */}
        <div className={`w-full md:w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col ${isEditing ? 'hidden md:flex' : 'flex h-full'}`}>
            <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <UserIcon size={24} className="text-zen-600"/>
                        學生名錄
                    </h2>
                </div>
                <button onClick={onClose} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                    <X size={28} />
                </button>
            </div>
            
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="搜尋學生 (姓名/Email/電話)..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zen-500 text-gray-900 bg-white"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 pb-20">
                <button 
                    onClick={handleCreateNew}
                    className="w-full flex items-center gap-4 p-4 rounded-xl text-left text-zen-700 bg-zen-50 hover:bg-zen-100 border border-zen-200 transition-colors mb-2"
                >
                    <div className="w-10 h-10 rounded-full bg-zen-200 flex items-center justify-center">
                        <UserPlus size={20} />
                    </div>
                    <span className="font-bold text-base">新增學生 (手動建檔)</span>
                </button>

                {filteredStudents.map(student => {
                    // Count total future bookings roughly
                    const bookingCount = classes.reduce((sum, cls) => {
                        const bookings = (cls.bookings || {}) as Record<string, string[]>;
                        return sum + Object.values(bookings).filter(ids => ids.includes(student.id)).length;
                    }, 0);

                    const isUnlimited = student.membershipType === 'UNLIMITED';
                    return (
                        <button
                            key={student.id}
                            onClick={() => handleSelectStudent(student)}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors ${
                                selectedStudentId === student.id 
                                ? 'bg-white shadow-md ring-1 ring-gray-200 z-10 border-l-4 border-l-zen-600' 
                                : 'hover:bg-gray-100 bg-white border border-gray-100'
                            }`}
                        >
                            <div className="relative">
                                {student.avatarUrl ? (
                                    <img src={student.avatarUrl} alt={student.name} className="w-12 h-12 rounded-full bg-gray-200 object-cover" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                                        <UserIcon size={20} />
                                    </div>
                                )}
                                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isUnlimited ? 'bg-green-500' : 'bg-blue-500'}`} title={isUnlimited ? 'Unlimited' : 'Credit'}></div>
                            </div>
                            <div className="overflow-hidden flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="font-bold text-lg text-gray-900 truncate">{student.name}</p>
                                    {bookingCount > 0 && (
                                        <span className="bg-zen-100 text-zen-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                            {bookingCount} 堂
                                        </span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-sm text-gray-500">
                                    <span className="truncate">{student.email || student.username}</span>
                                    {student.phoneNumber && <span className="text-xs font-mono">{student.phoneNumber}</span>}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* --- RIGHT CONTENT (DETAILS) --- */}
        <div className={`flex-1 bg-white flex flex-col w-full h-full ${isEditing ? 'flex fixed inset-0 sm:static z-20' : 'hidden md:flex'}`}>
            
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white shadow-sm sm:shadow-none z-30 sticky top-0">
                <button 
                    onClick={handleBackToList}
                    className="md:hidden flex items-center gap-1 text-gray-600 font-medium px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                    <ChevronLeft size={20} />
                    返回列表
                </button>
                <div className="flex-1"></div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100">
                    <X size={28} />
                </button>
            </div>

            {(selectedStudentId || isCreating) ? (
                <div className="flex-1 overflow-y-auto px-6 pb-32 sm:px-12 sm:pb-12 bg-white">
                    <div className="flex items-center gap-6 mb-8 mt-6">
                         <div 
                             className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-3xl font-bold text-gray-400 overflow-hidden relative group cursor-pointer border-4 border-white shadow-sm shrink-0"
                             onClick={() => fileInputRef.current?.click()}
                         >
                             {isUploading ? (
                                 <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                                     <Loader2 className="animate-spin text-white" size={32} />
                                 </div>
                             ) : null}

                             {formData.avatarUrl ? (
                                <img src={formData.avatarUrl} alt="avatar" className="w-full h-full object-cover"/>
                             ) : (
                                <UserIcon size={48} className="text-gray-300"/>
                             )}
                             
                             <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera size={24} className="text-white" />
                             </div>
                         </div>
                         <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />

                         <div>
                             <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-all line-clamp-2">
                                {formData.name || (isCreating ? '新學生' : '未命名')}
                             </h1>
                             <p className="text-gray-500 text-base">
                                {isCreating ? '建立新帳號' : `ID: ${selectedStudentId}`}
                             </p>
                             {formData.phoneNumber && (
                                 <p className="text-zen-600 text-base font-medium flex items-center gap-1 mt-1">
                                     <Phone size={16}/> {formData.phoneNumber}
                                 </p>
                             )}
                         </div>
                    </div>

                    <div className="space-y-8 max-w-lg mx-auto sm:mx-0">
                        
                        {/* MEMBERSHIP CONFIGURATION */}
                        <div className="p-4 sm:p-6 bg-gray-50 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <CreditCard size={20} />
                                會員資格設定
                            </h3>
                            
                            <div className="flex bg-white rounded-xl p-1.5 border border-gray-200 mb-6">
                                <button 
                                    onClick={() => changeMembership('CREDIT')}
                                    className={`flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${formData.membershipType === 'CREDIT' ? 'bg-blue-100 text-blue-700 shadow-sm ring-2 ring-blue-500/20' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <Coins size={18} />
                                    點數扣點制
                                </button>
                                <button 
                                    onClick={() => changeMembership('UNLIMITED')}
                                    className={`flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${formData.membershipType === 'UNLIMITED' ? 'bg-green-100 text-green-700 shadow-sm ring-2 ring-green-500/20' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <Infinity size={18} />
                                    課程自由
                                </button>
                            </div>

                            {formData.membershipType === 'UNLIMITED' ? (
                                <div className="animate-in fade-in slide-in-from-bottom-2">
                                    <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">會籍到期日</label>
                                    <input 
                                        type="date" 
                                        value={formData.unlimitedExpiry || ''}
                                        onChange={(e) => setFormData({...formData, unlimitedExpiry: e.target.value})}
                                        className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 text-lg cursor-pointer"
                                    />
                                    <p className="text-xs text-gray-400 mt-2">在此日期前，學生可免費預約所有課程。</p>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-bottom-2">
                                    <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">剩餘點數</label>
                                    <div className="flex items-center gap-2 sm:gap-4">
                                        <button 
                                            onClick={() => adjustCredits(-1)} 
                                            className="w-12 h-12 rounded-xl border bg-white hover:bg-gray-50 text-gray-600 text-xl font-bold flex items-center justify-center active:scale-95 transition-transform"
                                        >
                                            -
                                        </button>
                                        <input 
                                            type="text" 
                                            inputMode="decimal"
                                            value={creditsInput}
                                            onChange={handleCreditsChange}
                                            className="flex-1 min-w-0 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-center font-bold text-2xl"
                                        />
                                        <button 
                                            onClick={() => adjustCredits(1)} 
                                            className="w-12 h-12 rounded-xl border bg-white hover:bg-gray-50 text-gray-600 text-xl font-bold flex items-center justify-center active:scale-95 transition-transform"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">預約課程時將自動扣除相應點數。</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">姓名</label>
                                <input 
                                    type="text" 
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:outline-none font-medium text-gray-900 text-lg"
                                    placeholder="例如：王小明"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between">
                                        Email (必填)
                                        {isCreating && !formData.email && <span className="text-red-500 text-[10px] self-end">建立帳號需 Email</span>}
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input 
                                            type="email" 
                                            value={formData.email || ''}
                                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                                            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:outline-none text-gray-900 text-base"
                                            placeholder="手動建檔"
                                        />
                                    </div>
                                    {isCreating && formData.email && (
                                        <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                                            <Check size={10} /> 將自動發送密碼重置信
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">電話</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input 
                                            type="tel" 
                                            value={formData.phoneNumber || ''}
                                            onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                                            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:outline-none text-gray-900 text-base"
                                            placeholder="09xx..."
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            {isCreating && (
                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 leading-relaxed">
                                    💡 填入 <b>Email</b> 後按下儲存，系統將自動建立帳號並發送「密碼重置信」給學生。學生點擊信中連結即可設定自己的密碼。
                                </div>
                            )}

                            {!isCreating && (
                                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                    <label className="block text-sm font-bold text-yellow-700 uppercase tracking-wider mb-3">密碼管理</label>
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-yellow-800">
                                            <p>學生忘記密碼？</p>
                                            <p className="text-xs mt-1 opacity-80">請學生使用「忘記密碼」功能</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={handleResetPassword}
                                            className="flex items-center gap-2 bg-white border border-yellow-300 text-yellow-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-100 shadow-sm transition-colors"
                                        >
                                            <KeyRound size={16}/>
                                            發送重置信
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isCreating && selectedStudentId && (
                            <div className="pt-8 mt-8 border-t border-gray-100">
                                <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <Calendar size={20} />
                                    預約管理
                                </h3>
                                
                                {(upcomingBookings.length === 0 && historyBookings.length === 0) ? (
                                    <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 text-center">
                                        尚無預約。
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Upcoming Bookings */}
                                        {upcomingBookings.length > 0 && (
                                            <div className="space-y-3">
                                                <h4 className="text-sm font-bold text-zen-600 uppercase tracking-wider flex items-center gap-2">
                                                    <Clock size={14} /> 即將開始 ({upcomingBookings.length})
                                                </h4>
                                                {upcomingBookings.map((bk, idx) => renderBookingItem(bk))}
                                            </div>
                                        )}
                                        
                                        {/* History Toggle */}
                                        {historyBookings.length > 0 && (
                                            <div className="pt-2">
                                                <button 
                                                    onClick={() => setShowHistory(!showHistory)}
                                                    className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-700 w-full p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors justify-center border border-gray-200"
                                                >
                                                    <History size={16} />
                                                    {showHistory ? '隱藏歷史紀錄' : `查看歷史紀錄 (${historyBookings.length})`}
                                                    {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                                
                                                {showHistory && (
                                                    <div className="space-y-3 mt-3 animate-in slide-in-from-top-2 fade-in">
                                                         {historyBookings.map((bk, idx) => (
                                                             <div key={`${bk.classId}-${bk.dateKey}-hist`} className="opacity-75 hover:opacity-100 transition-opacity">
                                                                {renderBookingItem(bk)}
                                                             </div>
                                                         ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="pt-6 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 mt-8 pb-10">
                            {!isCreating && (
                                showDeleteConfirm ? (
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={() => setShowDeleteConfirm(false)}
                                            disabled={isDeleting}
                                            className="flex-1 px-4 py-3 rounded-xl text-gray-600 bg-gray-100 text-base font-medium hover:bg-gray-200"
                                        >
                                            取消
                                        </button>
                                        <button 
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="flex-1 px-4 py-3 rounded-xl text-white bg-red-600 text-base font-medium hover:bg-red-700 flex items-center justify-center gap-2 shadow-md"
                                        >
                                            {isDeleting ? <Loader2 size={20} className="animate-spin" /> : "確認刪除"}
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => setShowDeleteConfirm(true)}
                                        disabled={isDeleting}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 px-5 py-3 rounded-xl text-base font-medium flex items-center gap-2 transition-colors w-full sm:w-auto justify-center sm:justify-start border border-red-100 sm:border-none"
                                    >
                                        <Trash2 size={20} />
                                        刪除學生
                                    </button>
                                )
                            )}
                            <div className="flex gap-3 w-full sm:w-auto ml-auto">
                                <button 
                                    onClick={handleSave}
                                    disabled={!formData.name || isSaving || isDeleting}
                                    className={`flex-1 px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-zen-200 flex items-center justify-center gap-2 text-base transition-all
                                        ${showSuccess 
                                            ? 'bg-green-600 text-white hover:bg-green-700' 
                                            : 'bg-zen-600 text-white hover:bg-zen-700 disabled:opacity-50 disabled:cursor-not-allowed'
                                        }`}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin"/>
                                            儲存中...
                                        </>
                                    ) : showSuccess ? (
                                        <>
                                            <Check size={20} />
                                            儲存成功
                                        </>
                                    ) : (
                                        <>
                                            <Save size={20} />
                                            {isCreating ? '建立 & 發送重置信' : '儲存'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8 text-center">
                    <UserIcon size={80} className="mb-6 text-gray-200" />
                    <p className="text-xl font-medium text-gray-400">請從左側列表選擇學生<br/>以檢視詳情或編輯</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

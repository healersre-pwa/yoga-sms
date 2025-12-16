
import React, { useState, useRef, useEffect } from 'react';
import { ClassSession, Instructor, User } from '../types';
import { useApp } from '../contexts/AppContext';
import { X, Check, Trash2, Plus, Users, UserCog, Camera, Loader2, Calendar, ArrowRight, User as UserIcon, Coins, AlertCircle, Wrench, MessageSquare, BellOff, Search } from 'lucide-react';
import { SMSNotificationModal } from './SMSNotificationModal';

interface Props {
  session: ClassSession;
  instructor: Instructor;
  targetDate: Date; // The specific date we are managing
  onClose: () => void;
}

type Tab = 'INSTRUCTOR' | 'STUDENTS';
type SelectionTarget = 'BASE' | 'SUBSTITUTE';

export const AdminManageModal: React.FC<Props> = ({ session, instructor, targetDate, onClose }) => {
  const { instructors, students, classes, updateClass, addInstructor, updateInstructor, deleteInstructor, bookClass, cancelClass, formatDateKey, checkInstructorConflict } = useApp();
  
  const currentSession = classes.find(c => c.id === session.id) || session;
  const [activeTab, setActiveTab] = useState<Tab>('INSTRUCTOR');
  
  // --- DATE & INSTRUCTOR LOGIC ---
  const targetDateStr = formatDateKey(targetDate);
  
  // Check Map for Sub
  const mapSubId = currentSession.substitutions?.[targetDateStr];
  const isSubForThisDate = !!mapSubId;
  
  // Initial IDs
  const initialBaseId = currentSession.instructorId; 
  const initialSubId = mapSubId || null;

  // Working State
  const [newBaseId, setNewBaseId] = useState(initialBaseId);
  const [newSubId, setNewSubId] = useState<string | null>(initialSubId);
  
  // Selection Mode (Default to Base if no sub, otherwise Sub)
  const [selectionTarget, setSelectionTarget] = useState<SelectionTarget>(isSubForThisDate ? 'SUBSTITUTE' : 'BASE');

  // Resolved Objects for UI
  const baseInstructor = instructors.find(i => i.id === newBaseId) || { id: 'unknown', name: '未知', bio: '', imageUrl: '' };
  const subInstructor = instructors.find(i => i.id === newSubId); 
  
  // Create Modal States
  const [isAddingInstructor, setIsAddingInstructor] = useState(false);
  const [newInstName, setNewInstName] = useState('');
  const [newInstBio, setNewInstBio] = useState('');
  const [uploadingInstructorId, setUploadingInstructorId] = useState<string | null>(null);

  // Student Add Search State
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<User | null>(null);
  const [isSearchingStudent, setIsSearchingStudent] = useState(false);

  // SMS Modal State
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [finalSMSMessage, setFinalSMSMessage] = useState('');
  const [smsTitle, setSmsTitle] = useState('代課通知');

  // FILTER STUDENTS BY DAILY BOOKINGS
  const dailyBookings = currentSession.bookings?.[targetDateStr] || [];
  const enrolledStudents = students.filter(s => dailyBookings.includes(s.id));
  const availableStudents = students.filter(s => !dailyBookings.includes(s.id));

  // Ghost detection irrelevant in drop-in mode unless ID not found in DB
  const ghostStudentCount = dailyBookings.length - enrolledStudents.length;
  const hasGhostStudents = ghostStudentCount > 0;

  // Filter available students based on search term (Name, ID, Phone)
  const filteredAvailableStudents = availableStudents.filter(s => {
      const term = studentSearchTerm.toLowerCase();
      if (!term) return false;
      return (
          s.name.toLowerCase().includes(term) ||
          s.id.toLowerCase().includes(term) ||
          s.username?.toLowerCase().includes(term) ||
          s.phoneNumber?.includes(term)
      );
  });

  const handleSave = async () => {
    // 1. Validation: Check Base Instructor Conflict (if changed)
    if (newBaseId !== initialBaseId) {
        const conflict = checkInstructorConflict(
            newBaseId, 
            currentSession.dayOfWeek, 
            currentSession.startTimeStr, 
            currentSession.durationMinutes, 
            currentSession.id // Exclude self
        );
        if (conflict.conflict) {
            alert(`❌ 無法設定正課老師：師資衝突！\n\n${baseInstructor.name} 在該時段已有課程：\n「${conflict.className}」 (${conflict.time})`);
            return;
        }
    }

    // 2. Validation: Check Substitute Conflict (if set)
    if (newSubId && newSubId !== newBaseId) {
        const conflict = checkInstructorConflict(
            newSubId,
            currentSession.dayOfWeek,
            currentSession.startTimeStr, 
            currentSession.durationMinutes, 
            currentSession.id,
            targetDate // Check specific date for subs
        );
        if (conflict.conflict) {
            alert(`❌ 無法設定代課：師資衝突！\n\n${subInstructor?.name} 在 ${targetDateStr} 當天該時段已有課程：\n「${conflict.className}」 (${conflict.time})`);
            return;
        }
    }

    // Construct updates
    const updates: any = {};

    // Update Base Instructor (Permanent)
    if (newBaseId !== initialBaseId) {
        updates.instructorId = newBaseId;
    }

    // Update Substitution Map
    const newSubstitutions = { ...(currentSession.substitutions || {}) };
    
    let isSubChanged = false;
    if (newSubId && newSubId !== newBaseId) {
        if (newSubId !== initialSubId) isSubChanged = true;
        newSubstitutions[targetDateStr] = newSubId;
    } else {
        if (initialSubId) isSubChanged = true; // Sub was removed
        delete newSubstitutions[targetDateStr];
    }
    
    updates.substitutions = newSubstitutions;

    // Write to Firestore
    await updateClass(currentSession.id, updates);

    // SMS Trigger Logic
    // If there was a sub change, AND we have enrolled students
    if (isSubChanged && newSubId && enrolledStudents.length > 0) {
        const dateStr = targetDate.toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'});
        const dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        const dayName = dayMap[targetDate.getDay()];
        const fullTimeStr = `${dateStr} (${dayName}) ${currentSession.startTimeStr}`;
        
        const oldTeacherName = instructors.find(i => i.id === initialBaseId)?.name || '原老師';
        const newTeacherName = subInstructor?.name || '代課老師';
        
        // Static Template (Replaced AI)
        const msg = `同學好，通知您：${fullTimeStr} 的「${currentSession.title}」課程，老師 ${oldTeacherName} 因故請假，將由 ${newTeacherName} 老師代課。造成不便敬請見諒。`;
        
        setSmsTitle('代課通知');
        setFinalSMSMessage(msg);
        setShowSMSModal(true);
    } else {
        onClose();
    }
  };

  const handleInstructorSelect = (id: string) => {
      if (selectionTarget === 'BASE') {
          setNewBaseId(id);
          // Auto-clear substitute if user sets Base = Substitute
          if (newSubId === id) {
              setNewSubId(null);
          }
      } else {
          // If selecting sub, and it's same as base, it means "Cancel Sub"
          if (id === newBaseId) {
              setNewSubId(null);
          } else {
              setNewSubId(id);
          }
      }
  };

  const handleCreateInstructor = () => {
    if (newInstName && newInstBio) {
        const newId = addInstructor({ name: newInstName, bio: newInstBio });
        handleInstructorSelect(newId);
        setIsAddingInstructor(false);
        setNewInstName('');
        setNewInstBio('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, instructorId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("圖片大小請小於 2MB"); return; }
    setUploadingInstructorId(instructorId);
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width;
            canvas.height = height;
            ctx?.drawImage(img, 0, 0, width, height);
            updateInstructor(instructorId, { imageUrl: canvas.toDataURL('image/jpeg', 0.8) });
            setUploadingInstructorId(null);
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const triggerFileUpload = (id: string) => {
      document.getElementById(`file-upload-${id}`)?.click();
  };

  const handleFixGhostStudents = async () => {
      if(window.confirm(`系統偵測到 ${ghostStudentCount} 筆異常的報名資料(學生可能已被刪除)。\n\n是否執行自動修復？`)) {
          // Only keep valid students
          const validIds = enrolledStudents.map(s => s.id);
          await updateClass(currentSession.id, { 
              [`bookings.${targetDateStr}`]: validIds 
          });
      }
  };

  // --- Notification Actions ---
  const handleSendStopClass = () => {
    const dateStr = targetDate.toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'});
    const dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const dayName = dayMap[targetDate.getDay()];
    const msg = `同學好，很遺憾通知您，原定 ${dateStr} (${dayName}) ${currentSession.startTimeStr} 的「${currentSession.title}」課程暫停一次。造成不便敬請見諒。`;
    
    setSmsTitle('停課通知');
    setFinalSMSMessage(msg);
    setShowSMSModal(true);
  };

  const handleSendGeneral = () => {
     const dateStr = targetDate.toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'});
     const dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
     const dayName = dayMap[targetDate.getDay()];

     setSmsTitle('一般公告');
     setFinalSMSMessage(`同學好，關於 ${dateStr} (${dayName}) 的「${currentSession.title}」課程...`);
     setShowSMSModal(true);
  };

  if (showSMSModal) {
      return (
          <SMSNotificationModal 
              isOpen={true} 
              onClose={onClose}
              students={enrolledStudents}
              defaultMessage={finalSMSMessage}
              title={smsTitle}
          />
      );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-gray-500"/>
                <span className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                    {targetDate.toLocaleDateString('zh-TW', {year:'numeric', month:'numeric', day:'numeric'})}
                </span>
                <span className="text-xs font-bold text-zen-600 bg-zen-50 border border-zen-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Coins size={10} />
                    {currentSession.pointsCost ?? 1} 點
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-800">{currentSession.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
            <button 
                onClick={() => setActiveTab('INSTRUCTOR')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'INSTRUCTOR' ? 'text-zen-600 border-b-2 border-zen-600 bg-white' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'}`}
            >
                <UserCog size={18} />
                管理師資
            </button>
            <button 
                onClick={() => setActiveTab('STUDENTS')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'STUDENTS' ? 'text-zen-600 border-b-2 border-zen-600 bg-white' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'}`}
            >
                <Users size={18} />
                管理學生 ({enrolledStudents.length})
                {hasGhostStudents && <AlertCircle size={16} className="text-red-500 animate-pulse" />}
            </button>
        </div>

        <div className="p-0 overflow-y-auto flex-1 bg-white">
          
          {activeTab === 'INSTRUCTOR' && (
            <div className="p-6 space-y-6">
                
                {/* Visual Selection Area */}
                <div className="flex items-center gap-4">
                    
                    {/* LEFT: Base Instructor */}
                    <div 
                        onClick={() => setSelectionTarget('BASE')}
                        className={`flex-1 relative p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 group ${
                            selectionTarget === 'BASE' 
                            ? 'border-green-500 bg-green-50/50 shadow-md ring-2 ring-green-100' 
                            : 'border-gray-200 hover:border-green-300 bg-white'
                        }`}
                    >
                        <div className={`absolute top-0 left-0 px-2 py-1 text-[10px] font-bold rounded-br-lg ${
                            selectionTarget === 'BASE' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                            正課老師
                        </div>
                        {baseInstructor.imageUrl ? (
                            <img src={baseInstructor.imageUrl} className="w-14 h-14 rounded-full border-2 border-white shadow-sm mt-2 object-cover" />
                        ) : (
                            <div className="w-14 h-14 rounded-full border-2 border-white shadow-sm mt-2 bg-gray-200 flex items-center justify-center text-gray-400">
                                <UserCog size={24} />
                            </div>
                        )}
                        <span className={`font-bold text-sm ${selectionTarget === 'BASE' ? 'text-green-800' : 'text-gray-700'}`}>
                            {baseInstructor.name}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium group-hover:text-green-600 transition-colors">
                            點擊修改每週固定排程
                        </span>
                    </div>

                    <ArrowRight className="text-gray-300" size={20} />

                    {/* RIGHT: Substitute Instructor */}
                    <div 
                        onClick={() => setSelectionTarget('SUBSTITUTE')}
                        className={`flex-1 relative p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 ${
                            selectionTarget === 'SUBSTITUTE'
                            ? 'border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-100'
                            : 'border-gray-200 hover:border-amber-300 bg-white'
                        }`}
                    >
                        <div className={`absolute top-0 right-0 px-2 py-1 text-[10px] font-bold rounded-bl-lg ${
                            selectionTarget === 'SUBSTITUTE' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                            當日代課
                        </div>
                        {newSubId && subInstructor ? (
                            <>
                                {subInstructor.imageUrl ? (
                                    <img src={subInstructor.imageUrl} className="w-14 h-14 rounded-full border-2 border-white shadow-sm mt-2 object-cover" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full border-2 border-white shadow-sm mt-2 bg-gray-200 flex items-center justify-center text-gray-400">
                                        <UserCog size={24} />
                                    </div>
                                )}
                                <span className={`font-bold text-sm ${selectionTarget === 'SUBSTITUTE' ? 'text-amber-800' : 'text-gray-700'}`}>
                                    {subInstructor.name}
                                </span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setNewSubId(null); }}
                                    className="absolute top-2 left-2 p-1 text-gray-400 hover:text-red-500"
                                    title="清除代課"
                                >
                                    <X size={14} />
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[88px] text-gray-400">
                                <UserCog size={32} className="mb-1 opacity-20" />
                                <span className="text-xs">無代課</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* List Header & Add Button */}
                <div className="flex justify-between items-center pt-2">
                    <label className={`text-sm font-bold ${selectionTarget === 'BASE' ? 'text-green-700' : 'text-amber-700'}`}>
                        {selectionTarget === 'BASE' ? '選擇正課老師' : '選擇代課老師'}
                    </label>
                    {!isAddingInstructor && (
                        <button onClick={() => setIsAddingInstructor(true)} className="text-xs flex items-center gap-1 text-zen-600 font-medium hover:underline">
                            <Plus size={14} /> 新增師資
                        </button>
                    )}
                </div>
                
                {/* Add Instructor Form */}
                {isAddingInstructor && (
                     <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="flex gap-2 mb-2">
                            <input type="text" placeholder="姓名" value={newInstName} onChange={e => setNewInstName(e.target.value)} className="text-sm border rounded px-2 py-1 flex-1 text-gray-900 bg-white"/>
                            <input type="text" placeholder="簡介" value={newInstBio} onChange={e => setNewInstBio(e.target.value)} className="text-sm border rounded px-2 py-1 flex-1 text-gray-900 bg-white"/>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAddingInstructor(false)} className="text-xs text-gray-500">取消</button>
                            <button onClick={handleCreateInstructor} className="text-xs bg-zen-600 text-white px-3 py-1 rounded">建立</button>
                        </div>
                    </div>
                )}

                {/* The List */}
                <div className="space-y-2 pb-6">
                    {instructors.map(inst => {
                        // Check if this instructor is currently selected in the ACTIVE target box
                        const isSelected = selectionTarget === 'BASE' ? (inst.id === newBaseId) : (inst.id === newSubId);
                        const activeColor = selectionTarget === 'BASE' ? 'green' : 'amber';
                        const ringClass = isSelected ? `ring-1 ring-${activeColor}-500 border-${activeColor}-500 bg-${activeColor}-50` : 'border-gray-200 hover:bg-gray-50';

                        return (
                            <div 
                                key={inst.id}
                                onClick={() => handleInstructorSelect(inst.id)}
                                className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${ringClass}`}
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="relative group/avatar" onClick={(e) => { e.stopPropagation(); triggerFileUpload(inst.id); }}>
                                        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 relative flex items-center justify-center">
                                            {uploadingInstructorId === inst.id ? (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                                                    <Loader2 size={12} className="animate-spin text-white"/>
                                                </div>
                                            ) : (
                                                inst.imageUrl ? (
                                                    <img src={inst.imageUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                                                        <UserCog size={16} />
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity z-20">
                                            <Camera size={14} className="text-white" />
                                        </div>
                                        <input id={`file-upload-${inst.id}`} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, inst.id)} onClick={(e) => e.stopPropagation()} />
                                    </div>
                                    <span className={`text-sm ${isSelected ? `font-bold text-${activeColor}-900` : 'text-gray-700'}`}>{inst.name}</span>
                                </div>
                                {isSelected && <Check size={16} className={`text-${activeColor}-600`}/>}
                                {!isSelected && (
                                    <button onClick={(e) => { e.stopPropagation(); deleteInstructor(inst.id); }} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
          )}

          {activeTab === 'STUDENTS' && (
             <div className="p-6">
                
                {/* Notification Toolbar */}
                <div className="mb-6 grid grid-cols-2 gap-3">
                    <button 
                        onClick={handleSendStopClass}
                        className="flex items-center justify-center gap-2 p-3 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-200 transition-all font-bold text-sm shadow-sm"
                    >
                        <BellOff size={18} />
                        發送停課通知
                    </button>
                    <button 
                        onClick={handleSendGeneral}
                        className="flex items-center justify-center gap-2 p-3 rounded-xl border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-200 transition-all font-bold text-sm shadow-sm"
                    >
                        <MessageSquare size={18} />
                        發送一般公告
                    </button>
                </div>

                {/* Add Student Section */}
                <div className="mb-4 flex gap-2 relative">
                    <div className="flex-1 relative">
                        <div className="flex items-center border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-zen-500 overflow-hidden">
                            <Search size={16} className="ml-3 text-gray-400 shrink-0"/>
                            <input 
                                type="text"
                                placeholder={selectedStudentToAdd ? selectedStudentToAdd.name : "搜尋學生 (姓名/ID/電話)..."}
                                value={studentSearchTerm}
                                onChange={(e) => {
                                    setStudentSearchTerm(e.target.value);
                                    setIsSearchingStudent(true);
                                    if(selectedStudentToAdd) setSelectedStudentToAdd(null);
                                }}
                                onFocus={() => setIsSearchingStudent(true)}
                                className="w-full p-2 text-sm outline-none text-gray-900 bg-transparent"
                            />
                            {selectedStudentToAdd && (
                                <button onClick={() => { setSelectedStudentToAdd(null); setStudentSearchTerm(''); }} className="p-2 text-gray-400 hover:text-red-500">
                                    <X size={16}/>
                                </button>
                            )}
                        </div>

                        {/* Search Dropdown */}
                        {isSearchingStudent && studentSearchTerm && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                {filteredAvailableStudents.length > 0 ? (
                                    filteredAvailableStudents.map(s => (
                                        <div 
                                            key={s.id}
                                            onClick={() => {
                                                setSelectedStudentToAdd(s);
                                                setStudentSearchTerm(''); 
                                                setIsSearchingStudent(false);
                                            }}
                                            className="p-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-800">{s.name}</span>
                                                <span className="text-xs text-gray-400">@{s.username || s.id}</span>
                                            </div>
                                            {s.phoneNumber && <span className="text-xs text-gray-400 font-mono">{s.phoneNumber}</span>}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-xs text-gray-400 text-center">找不到符合的學生</div>
                                )}
                            </div>
                        )}
                        {/* Backdrop to close search */}
                        {isSearchingStudent && (
                            <div className="fixed inset-0 z-40" onClick={() => setIsSearchingStudent(false)}></div>
                        )}
                    </div>

                    <button 
                        disabled={!selectedStudentToAdd} 
                        onClick={async () => { 
                            if(selectedStudentToAdd) { 
                                const result = await bookClass(currentSession.id, selectedStudentToAdd.id, targetDate); 
                                if (result.success) {
                                    setSelectedStudentToAdd(null);
                                    setStudentSearchTerm('');
                                } else if (result.message) {
                                    alert(result.message);
                                }
                            }
                        }} 
                        className="bg-zen-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                    >
                        加入
                    </button>
                </div>

                {hasGhostStudents && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between animate-in slide-in-from-top-2 shadow-sm">
                         <div className="text-xs text-red-700">
                             <div className="font-bold flex items-center gap-1 mb-1"><AlertCircle size={14}/> 資料異常偵測</div>
                             <div>發現 <b>{ghostStudentCount}</b> 筆無效的報名紀錄(學生可能已被刪除)。</div>
                         </div>
                         <button 
                            onClick={handleFixGhostStudents}
                            className="bg-white text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 shadow-sm flex items-center gap-1"
                         >
                             <Wrench size={12} />
                             一鍵修復
                         </button>
                    </div>
                )}
                
                <div className="space-y-2">
                    {enrolledStudents.map(s => (
                        <div key={s.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-white">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                {s.avatarUrl ? (
                                    <img src={s.avatarUrl} className="w-8 h-8 rounded-full bg-gray-200 object-cover shrink-0"/>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 text-gray-400">
                                        <UserIcon size={16} />
                                    </div>
                                )}
                                <div className="text-sm font-bold text-black" style={{ color: 'black' }}>{s.name}</div>
                            </div>
                            <button onClick={() => cancelClass(currentSession.id, s.id, targetDate)} className="text-red-500 text-xs font-bold hover:bg-red-50 px-3 py-1.5 rounded border border-red-100 shrink-0">移除</button>
                        </div>
                    ))}
                    {enrolledStudents.length === 0 && <p className="text-center text-gray-400 text-sm py-4">尚無學生報名</p>}
                </div>
             </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 text-sm font-medium">取消</button>
            {activeTab === 'INSTRUCTOR' && (
                <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-zen-600 text-white text-sm font-bold hover:bg-zen-700 shadow-md">儲存設定</button>
            )}
        </div>
      </div>
    </div>
  );
};

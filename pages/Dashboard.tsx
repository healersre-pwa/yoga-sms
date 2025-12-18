
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { UserRole, ClassSession } from '../types';
import { ClassCard } from '../components/ClassCard';
import { AdminManageModal } from '../components/AdminManageModal';
import { StudentDirectoryModal } from '../components/StudentDirectoryModal';
import { ClassEditorModal } from '../components/ClassEditorModal';
import { InstructorDirectoryModal } from '../components/InstructorDirectoryModal';
import { DataExportModal } from '../components/DataExportModal';
import { Users, PlusCircle, Calendar, LayoutGrid, List, WifiOff, ChevronLeft, ChevronRight, RotateCcw, Plus, UserCog, Download, History, Loader2, Image as ImageIcon } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { classes, instructors, currentUser, bookClass, cancelClass, dataSource, formatDateKey, allClassesHistory, fetchArchivedClasses, updateAppBackgroundImage } = useApp();
  
  const [managingClassSession, setManagingClassSession] = useState<ClassSession | null>(null);
  const [managingDate, setManagingDate] = useState<Date | null>(null);
  
  const [isClassEditorOpen, setIsClassEditorOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [newClassDay, setNewClassDay] = useState<number>(1); 
  
  const [showStudentDirectory, setShowStudentDirectory] = useState(false);
  const [showInstructorDirectory, setShowInstructorDirectory] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'normal' | 'compact'>('compact');

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    return now;
  });

  const daysContainerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const prevWidthRef = useRef(0);

  const dateList = useMemo(() => {
      const dates: Date[] = [];
      const center = new Date(); 
      center.setHours(0,0,0,0);
      const RANGE = 120;
      for (let i = -RANGE; i <= RANGE; i++) {
          const d = new Date(center);
          d.setDate(center.getDate() + i);
          dates.push(d);
      }
      return dates;
  }, []);

  useLayoutEffect(() => {
      const container = daysContainerRef.current;
      if (!container) return;
      const dateKey = formatDateKey(selectedDate);
      const targetEl = document.getElementById(`date-btn-${dateKey}`);
      if (targetEl) {
          const scrollPos = targetEl.offsetLeft - (container.clientWidth / 2) + (targetEl.clientWidth / 2);
          if (!isReady) {
              container.scrollLeft = scrollPos;
              prevWidthRef.current = container.clientWidth;
              setTimeout(() => { setIsReady(true); }, 50);
          } else {
              container.scrollTo({ left: scrollPos, behavior: 'smooth' });
          }
      }
  }, [selectedDate, isReady, formatDateKey]);

  useEffect(() => {
      const container = daysContainerRef.current;
      if (!container) return;
      const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
              const width = entry.contentRect.width;
              if (Math.abs(width - prevWidthRef.current) > 2) {
                  prevWidthRef.current = width;
                  const dateKey = formatDateKey(selectedDate);
                  const targetEl = document.getElementById(`date-btn-${dateKey}`);
                  if (targetEl) {
                       const scrollPos = targetEl.offsetLeft - (width / 2) + (targetEl.clientWidth / 2);
                       container.scrollLeft = scrollPos;
                  }
              }
          }
      });
      observer.observe(container);
      return () => observer.disconnect();
  }, [selectedDate, formatDateKey]);

  const changeWeek = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (offset * 7));
    setSelectedDate(newDate);
  };

  const resetToToday = () => {
    const now = new Date();
    now.setHours(0,0,0,0);
    setSelectedDate(now);
  };

  const getWeekRangeLabel = () => {
    const current = new Date(selectedDate);
    const day = current.getDay() || 7; 
    const start = new Date(current);
    start.setDate(current.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const format = (d: Date) => `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
    return `${format(start)} - ${format(end)}`;
  };

  const handleClassAction = async (session: ClassSession, targetDate: Date) => {
    const dateKey = formatDateKey(targetDate);
    const dailyBookings = session.bookings?.[dateKey] || [];
    const isBooked = dailyBookings.includes(currentUser.id);
    if (currentUser.role === UserRole.ADMIN) {
      setManagingClassSession(session);
      setManagingDate(targetDate);
    } else {
      if (isBooked) { await cancelClass(session.id, undefined, targetDate); } 
      else { const result = await bookClass(session.id, undefined, targetDate); if (!result.success && result.message) alert(result.message); }
    }
  };

  const handleEditClass = (sessionId: string) => { setEditingClassId(sessionId); setIsClassEditorOpen(true); };
  const handleCreateClass = (dayId?: number) => { setEditingClassId(null); const todayDay = new Date().getDay() || 7; setNewClassDay(dayId || todayDay); setIsClassEditorOpen(true); };

  const handleLoadHistory = async () => {
      setIsLoadingHistory(true);
      await fetchArchivedClasses();
      setIsLoadingHistory(false);
      alert("歷史資料載入完成！");
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploadingBg(true);
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX_WIDTH = 1280; const MAX_HEIGHT = 1280;
              let width = img.width; let height = img.height;
              if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
              else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
              canvas.width = width; canvas.height = height;
              ctx?.drawImage(img, 0, 0, width, height);
              updateAppBackgroundImage(canvas.toDataURL('image/jpeg', 0.6)).then(() => setIsUploadingBg(false));
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

  const dayNamesRaw = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const targetDateStr = formatDateKey(selectedDate);
  const selectedDayOfWeek = selectedDate.getDay() || 7;
  const isSelectedToday = new Date().toDateString() === selectedDate.toDateString();
  const selectedDayName = dayNamesRaw[selectedDayOfWeek - 1];

  const visibleClasses = allClassesHistory
    .filter(c => {
        if (Number(c.dayOfWeek) !== selectedDayOfWeek) return false;
        if (c.createdAt && c.createdAt > targetDateStr) return false;
        if (c.archived && c.archivedAt && c.archivedAt <= targetDateStr) return false;
        return true;
    })
    .sort((a, b) => a.startTimeStr.localeCompare(b.startTimeStr));

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  return (
    <div className="space-y-4 pb-32">
      <header className="mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="w-full lg:w-auto lg:flex-1 min-w-0">
            <div className="bg-white/40 backdrop-blur-md p-3 pl-4 rounded-xl shadow-sm border border-white/40 w-full flex justify-between items-center gap-3">
                <div className="min-w-0 flex-1 overflow-hidden">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <span>{currentUser.role === UserRole.ADMIN ? '教室管理' : '課程預約'}</span>
                        {dataSource === 'local' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full border border-red-200 flex items-center gap-1 font-mono"> <WifiOff size={10} /> 離線</span>}
                    </h1>
                    <p className="text-gray-700 mt-1 flex items-center gap-2 text-sm font-medium"> <Calendar size={16} className="text-zen-700 shrink-0"/> <span> {currentUser.role === UserRole.ADMIN ? '管理每週固定課程。' : ' (兩日前 09:00 開放預約)。'} </span> </p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-1 rounded-xl border border-gray-200 flex shrink-0 shadow-sm">
                    <button onClick={() => setViewMode('normal')} className={`p-2 rounded-lg transition-all ${viewMode === 'normal' ? 'bg-zen-500/15 text-zen-700' : 'text-gray-400'}`}> <LayoutGrid size={18} /> </button>
                    <button onClick={() => setViewMode('compact')} className={`p-2 rounded-lg transition-all ml-0.5 ${viewMode === 'compact' ? 'bg-zen-500/15 text-zen-700' : 'text-gray-400'}`}> <List size={18} /> </button>
                </div>
            </div>
          </div>
          
          <div className="w-full lg:w-auto flex justify-center shrink-0">
            <div className="flex items-center bg-white/40 backdrop-blur-md p-1 rounded-xl border border-white/40 shadow-sm w-full lg:w-auto justify-between lg:justify-center overflow-hidden">
                <button onClick={() => changeWeek(-1)} className="p-2 sm:p-3 hover:bg-white/50 rounded-lg text-gray-700 flex-shrink-0 transition-all active:scale-90"><ChevronLeft size={20} /></button>
                <div className="px-1 sm:px-2 font-bold text-[13px] sm:text-base text-gray-800 text-center font-mono tracking-tighter sm:tracking-tight whitespace-nowrap overflow-hidden">
                    {getWeekRangeLabel()}
                </div>
                <button onClick={() => changeWeek(1)} className="p-2 sm:p-3 hover:bg-white/50 rounded-lg text-gray-700 flex-shrink-0 transition-all active:scale-90"><ChevronRight size={20} /></button>
                <div className="w-px h-6 bg-gray-400/30 mx-0.5 sm:mx-1 shrink-0"></div>
                <button onClick={resetToToday} className="p-2 sm:p-3 hover:bg-white/50 rounded-lg text-gray-700 flex-shrink-0 transition-all active:scale-90"><RotateCcw size={18} /></button>
            </div>
          </div>

          <div className="w-full lg:w-auto lg:flex-1 flex flex-row items-center gap-2 overflow-x-auto hide-scrollbar">
             {currentUser.role === UserRole.ADMIN && (
                <div className="flex gap-2 shrink-0 lg:ml-auto">
                    <button onClick={() => handleCreateClass()} className="flex items-center justify-center gap-2 bg-zen-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-zen-700 shadow-lg shadow-zen-200 text-sm whitespace-nowrap"> <PlusCircle size={20} /> <span className="hidden xl:inline">新增</span> </button>
                    <button onClick={() => setShowInstructorDirectory(true)} className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white transition-all text-sm"> <UserCog size={20} className="text-zen-700" /> </button>
                    <button onClick={() => setShowStudentDirectory(true)} className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white transition-all text-sm"> <Users size={20} className="text-zen-700" /> </button>
                    <button onClick={() => setShowExportModal(true)} className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white transition-all text-sm"> <Download size={20} className="text-zen-700" /> </button>
                    <button onClick={() => bgInputRef.current?.click()} disabled={isUploadingBg} className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white transition-all text-sm"> {isUploadingBg ? <Loader2 size={20} className="animate-spin text-zen-700" /> : <ImageIcon size={20} className="text-zen-700" />} <input ref={bgInputRef} type="file" className="hidden" accept="image/*" onChange={handleBgUpload} /> </button>
                    <button onClick={handleLoadHistory} disabled={isLoadingHistory} className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white transition-all text-sm"> {isLoadingHistory ? <Loader2 size={20} className="animate-spin text-zen-700" /> : <History size={20} className="text-zen-700" />} </button>
                </div>
             )}
          </div>
        </div>
      </header>

      <div ref={daysContainerRef} className={`relative flex overflow-x-auto pb-2 px-0 mb-2 snap-x snap-mandatory hide-scrollbar transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
          {dateList.map((date) => {
              const dateKey = formatDateKey(date);
              const dateCheck = new Date(date); dateCheck.setHours(0,0,0,0);
              const isPast = dateCheck < todayStart;
              const isSelected = selectedDate.toDateString() === date.toDateString();
              const dayOfWeek = date.getDay() || 7; const dayName = dayNamesRaw[dayOfWeek - 1]; const isToday = dateCheck.getTime() === todayStart.getTime();
              let containerClass = isSelected ? "bg-zen-600 border-zen-600 shadow-md" : (isPast ? "bg-transparent border-transparent opacity-60" : "bg-white/80 border-white/50 shadow-sm");
              let textClass = isSelected ? "text-white" : (isPast ? "text-gray-500" : "text-gray-800");
              return (
                <div id={`date-btn-${dateKey}`} key={dateKey} className="flex-shrink-0 snap-center px-1 w-[20%] lg:w-[14.285%]">
                    <button onClick={() => setSelectedDate(date)} className={`w-full h-[4.5rem] rounded-2xl border flex flex-col items-center justify-center transition-all ${containerClass}`}>
                        <span className={`text-sm font-bold mb-0.5 ${textClass}`}>{dayName}</span>
                        <span className={`text-lg font-black font-mono leading-none ${isSelected ? 'text-white/90' : (isPast ? 'text-gray-400' : 'text-gray-900')}`}>{date.getDate()}</span>
                        {isToday && <div className={`mt-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-zen-500'}`}></div>}
                    </button>
                </div>
              );
          })}
      </div>

      <div className="grid grid-cols-1 gap-4 items-start">
        <div id={`day-column-${targetDateStr}`} className={`flex flex-col min-h-[100px] rounded-2xl border shadow-sm relative transition-colors ${isSelectedToday ? 'bg-zen-50/80 border-zen-200' : 'bg-gray-50/70 border-gray-100'}`}>
            <div className={`p-3 border-b flex flex-col items-center justify-center sticky top-0 z-10 rounded-t-2xl shadow-sm h-16 ${isSelectedToday ? 'bg-zen-100/90 border-zen-200' : 'bg-white/90 border-gray-100'}`}>
                <span className={`font-black text-lg ${isSelectedToday ? 'text-zen-800' : 'text-gray-800'}`}>{selectedDayName}</span>
                <span className={`text-sm font-mono ${isSelectedToday ? 'text-zen-700 font-bold' : 'text-gray-500'}`}>{selectedDate.toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'})}</span>
                {currentUser.role === UserRole.ADMIN && <button onClick={() => handleCreateClass(selectedDayOfWeek)} className="absolute top-2 right-2 text-zen-600 hover:bg-zen-50 p-2 rounded-full"><Plus size={18} /></button>}
            </div>
            <div className={`p-3 flex-1 ${viewMode === 'compact' ? 'space-y-2' : 'space-y-4'}`}>
                {visibleClasses.length > 0 ? visibleClasses.map(session => {
                        const subId = session.substitutions?.[targetDateStr];
                        const isSubForThisDate = !!subId;
                        const displayInstId = isSubForThisDate ? subId : session.instructorId;
                        const instructor = instructors.find(i => i.id === displayInstId) || { id: 'unknown', name: 'Unknown', bio: '', imageUrl: '' };
                        return ( <ClassCard key={session.id} session={session} instructor={instructor} targetDate={selectedDate} onAction={() => handleClassAction(session, selectedDate)} onEdit={() => handleEditClass(session.id)} isCompact={viewMode === 'compact'} displayAsSubstitute={isSubForThisDate} /> );
                    }) : <div className="flex flex-col items-center justify-center py-8 text-gray-500 text-sm italic"><span>無課程</span></div>}
            </div>
        </div>
      </div>

      {managingClassSession && instructors.length > 0 && managingDate && ( <AdminManageModal session={managingClassSession} targetDate={managingDate} instructor={instructors.find(i => i.id === managingClassSession.instructorId)!} onClose={() => { setManagingClassSession(null); setManagingDate(null); }} /> )}
      {isClassEditorOpen && ( <ClassEditorModal key={`editor-${isClassEditorOpen}`} classId={editingClassId} initialDayOfWeek={newClassDay} onClose={() => setIsClassEditorOpen(false)} /> )}
      {showStudentDirectory && ( <StudentDirectoryModal onClose={() => setShowStudentDirectory(false)} /> )}
      {showInstructorDirectory && ( <InstructorDirectoryModal onClose={() => setShowInstructorDirectory(false)} /> )}
      {showExportModal && ( <DataExportModal onClose={() => setShowExportModal(false)} /> )}
    </div>
  );
};

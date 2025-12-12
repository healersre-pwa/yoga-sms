
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

  // --- DATE LOGIC CORE ---
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    return now;
  });

  const daysContainerRef = useRef<HTMLDivElement>(null);
  
  // Controls visibility: Keep transparent until initial scroll is DONE.
  const [isReady, setIsReady] = useState(false);
  
  // Track previous width for ResizeObserver
  const prevWidthRef = useRef(0);

  // Generate a long list of dates
  const dateList = useMemo(() => {
      const dates: Date[] = [];
      const center = new Date(); 
      center.setHours(0,0,0,0);
      
      const RANGE = 120; // Extended range
      
      for (let i = -RANGE; i <= RANGE; i++) {
          const d = new Date(center);
          d.setDate(center.getDate() + i);
          dates.push(d);
      }
      return dates;
  }, []);

  // 1. Position Logic (Manual Calculation for absolute control on selection change)
  useLayoutEffect(() => {
      const container = daysContainerRef.current;
      if (!container) return;

      const dateKey = formatDateKey(selectedDate);
      const targetEl = document.getElementById(`date-btn-${dateKey}`);
      
      if (targetEl) {
          // Manual calculation: Element Left - Half Container + Half Element
          const scrollPos = targetEl.offsetLeft - (container.clientWidth / 2) + (targetEl.clientWidth / 2);

          if (!isReady) {
              // INITIAL LOAD: Instant Jump
              container.scrollLeft = scrollPos;
              
              // Record initial width so observer doesn't double-fire unnecessarily
              prevWidthRef.current = container.clientWidth;

              // Slight delay to ensure paint happens BEFORE we show the list
              setTimeout(() => {
                  setIsReady(true);
              }, 50);
          } else {
              // NAVIGATION: Smooth Scroll
              container.scrollTo({
                  left: scrollPos,
                  behavior: 'smooth'
              });
          }
      }
  }, [selectedDate, isReady, formatDateKey]);

  // 2. Handle Resize via ResizeObserver (Only trigger if WIDTH changes)
  useEffect(() => {
      const container = daysContainerRef.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
              const width = entry.contentRect.width;
              // Ignore height-only changes (mobile toolbar) or tiny differences
              if (Math.abs(width - prevWidthRef.current) > 2) {
                  prevWidthRef.current = width;

                  // Re-center on the current selected date
                  const dateKey = formatDateKey(selectedDate);
                  const targetEl = document.getElementById(`date-btn-${dateKey}`);
                  if (targetEl) {
                       const scrollPos = targetEl.offsetLeft - (width / 2) + (targetEl.clientWidth / 2);
                       container.scrollLeft = scrollPos; // Instant adjustment
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
    
    const format = (d: Date) => {
        return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
    };

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
      if (isBooked) {
        await cancelClass(session.id, undefined, targetDate);
      } else {
        const result = await bookClass(session.id, undefined, targetDate);
        if (!result.success && result.message) {
            alert(result.message);
        }
      }
    }
  };

  const handleEditClass = (sessionId: string) => {
    setEditingClassId(sessionId);
    setIsClassEditorOpen(true);
  };

  const handleCreateClass = (dayId?: number) => {
    setEditingClassId(null);
    const todayDay = new Date().getDay() || 7;
    setNewClassDay(dayId || todayDay);
    setIsClassEditorOpen(true);
  };

  const handleLoadHistory = async () => {
      setIsLoadingHistory(true);
      await fetchArchivedClasses();
      setIsLoadingHistory(false);
      alert("歷史資料載入完成！您現在可以查看過往的課程紀錄。");
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { alert("圖片過大 (建議 < 5MB)"); return; }

      setIsUploadingBg(true);
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              const MAX_WIDTH = 1280; 
              const MAX_HEIGHT = 1280;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                  if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
              } else {
                  if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
              }

              canvas.width = width;
              canvas.height = height;
              ctx?.drawImage(img, 0, 0, width, height);
              
              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              
              updateAppBackgroundImage(dataUrl).then(() => {
                  setIsUploadingBg(false);
                  alert("背景圖片已更新！");
              });
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

  const dayNamesRaw = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const isStudent = currentUser.role === UserRole.STUDENT;

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
        {/* Responsive Header Layout: 
            - Use lg:flex-row to allow tablets (1024px+) to see single row.
        */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          
          {/* 1. Left: Title + View Toggle (Merged) */}
          <div className="w-full lg:w-auto lg:flex-1 min-w-0">
            <div className="bg-white/40 backdrop-blur-md p-3 pl-4 rounded-xl shadow-sm border border-white/40 w-full flex justify-between items-center gap-3">
                <div className="min-w-0 flex-1 overflow-hidden">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="whitespace-nowrap">
                            {currentUser.role === UserRole.ADMIN ? '教室管理' : '課程預約'}
                        </span>
                        {dataSource === 'local' && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full border border-red-200 flex items-center gap-1 font-mono align-middle whitespace-nowrap">
                                <WifiOff size={10} /> 離線
                            </span>
                        )}
                    </h1>
                    {/* Description: Visible on ALL screens, single line, scrollable if overflow */}
                    <p className="text-gray-700 mt-1 flex items-center gap-2 text-sm font-medium whitespace-nowrap overflow-x-auto hide-scrollbar pr-2">
                        <Calendar size={16} className="text-zen-700 shrink-0"/>
                        <span>
                            {currentUser.role === UserRole.ADMIN 
                                ? '管理每週固定課程。' 
                                : ' (兩日前 09:00 開放預約)。'}
                        </span>
                    </p>
                </div>

                {/* View Toggles - Always visible */}
                <div className="bg-white/60 p-1 rounded-lg border border-white/50 flex shrink-0 shadow-sm self-start sm:self-center">
                    <button 
                        onClick={() => setViewMode('normal')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'normal' ? 'bg-zen-100/80 text-zen-800 shadow-sm' : 'text-gray-600 hover:text-gray-800 hover:bg-white/40'}`}
                        title="標準檢視"
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button 
                        onClick={() => setViewMode('compact')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'compact' ? 'bg-zen-100/80 text-zen-800 shadow-sm' : 'text-gray-600 hover:text-gray-800 hover:bg-white/40'}`}
                        title="精簡檢視"
                    >
                        <List size={18} />
                    </button>
                </div>
            </div>
          </div>
          
          {/* 2. Center: Date Navigation */}
          {/* Use w-auto and shrink-0 to allow it to take natural width without forcing 1/3 */}
          <div className="w-full lg:w-auto flex justify-center shrink-0">
            <div className="flex items-center bg-white/40 backdrop-blur-md p-1 rounded-xl border border-white/40 shadow-sm w-full lg:w-auto max-w-md justify-between lg:justify-center">
                <button onClick={() => changeWeek(-1)} className="p-3 hover:bg-white/50 rounded-lg text-gray-700 shrink-0">
                    <ChevronLeft size={20} />
                </button>
                <div className="px-2 font-bold text-base text-gray-800 text-center font-mono tracking-tight whitespace-nowrap flex-1">
                    {getWeekRangeLabel()}
                </div>
                <button onClick={() => changeWeek(1)} className="p-3 hover:bg-white/50 rounded-lg text-gray-700 shrink-0">
                    <ChevronRight size={20} />
                </button>
                <div className="w-px h-6 bg-gray-400/30 mx-1 shrink-0"></div>
                <button onClick={resetToToday} className="p-3 hover:bg-white/50 rounded-lg text-gray-700 shrink-0" title="回到今天">
                    <RotateCcw size={18} />
                </button>
            </div>
          </div>

          {/* 3. Right: Action Buttons (Toggle removed from here) */}
          {/* Explicit flex-row and hide-scrollbar for smooth mobile scrolling */}
          <div className="w-full lg:w-auto lg:flex-1 flex flex-row items-center gap-2 overflow-x-auto hide-scrollbar">
             
             {currentUser.role === UserRole.ADMIN && (
                // Added lg:ml-auto to push buttons to right when space permits
                <div className="flex gap-2 shrink-0 lg:ml-auto">
                    <button 
                        onClick={() => handleCreateClass()} 
                        className="flex items-center justify-center gap-2 bg-zen-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-zen-700 shadow-lg shadow-zen-200 transition-all text-sm whitespace-nowrap"
                        title="新增課程"
                    >
                        <PlusCircle size={20} />
                        <span className="hidden xl:inline">新增</span>
                    </button>
                    
                    <button 
                        onClick={() => setShowInstructorDirectory(true)}
                        className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 shadow-sm text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white hover:border-white transition-all text-sm whitespace-nowrap"
                        title="師資管理"
                    >
                        <UserCog size={20} className="text-zen-700" />
                    </button>

                    <button 
                        onClick={() => setShowStudentDirectory(true)}
                        className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 shadow-sm text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white hover:border-white transition-all text-sm whitespace-nowrap"
                        title="學生名錄"
                    >
                        <Users size={20} className="text-zen-700" />
                    </button>

                    <button 
                        onClick={() => setShowExportModal(true)}
                        className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 shadow-sm text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white hover:border-white transition-all text-sm whitespace-nowrap"
                        title="匯出資料與維護"
                    >
                        <Download size={20} className="text-zen-700" />
                    </button>

                    <button 
                        onClick={() => bgInputRef.current?.click()}
                        disabled={isUploadingBg}
                        className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 shadow-sm text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white hover:border-white transition-all text-sm whitespace-nowrap"
                        title="更換背景"
                    >
                        {isUploadingBg ? <Loader2 size={20} className="animate-spin text-zen-700" /> : <ImageIcon size={20} className="text-zen-700" />}
                        <input ref={bgInputRef} type="file" className="hidden" accept="image/*" onChange={handleBgUpload} />
                    </button>

                    <button 
                        onClick={handleLoadHistory}
                        disabled={isLoadingHistory}
                        className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 shadow-sm text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-white hover:border-white transition-all text-sm whitespace-nowrap"
                        title="載入歷史資料"
                    >
                        {isLoadingHistory ? <Loader2 size={20} className="animate-spin text-zen-700" /> : <History size={20} className="text-zen-700" />}
                    </button>
                </div>
             )}
          </div>
        </div>
      </header>

      {/* 
          INFINITE DATE SCROLLER 
          - Reverted to 'relative' (not sticky)
      */}
      <div 
        ref={daysContainerRef}
        className={`relative flex overflow-x-auto pb-2 px-0 mb-2 snap-x snap-mandatory hide-scrollbar transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      >
          {dateList.map((date) => {
              const dateKey = formatDateKey(date);
              
              const dateCheck = new Date(date);
              dateCheck.setHours(0,0,0,0);
              
              const isPast = dateCheck < todayStart;
              const isSelected = selectedDate.toDateString() === date.toDateString();
              const dayOfWeek = date.getDay() || 7;
              const dayName = dayNamesRaw[dayOfWeek - 1];
              const isToday = dateCheck.getTime() === todayStart.getTime();

              let containerClass = "";
              let textClass = "";
              
              if (isSelected) {
                  containerClass = "bg-zen-600 border-zen-600 shadow-md scale-100 z-10";
                  textClass = "text-white";
              } else if (isPast) {
                  containerClass = "bg-transparent border-transparent opacity-60 hover:bg-white/20";
                  textClass = "text-gray-500 font-medium";
              } else {
                  containerClass = "bg-white/80 backdrop-blur-md border-white/50 shadow-sm hover:bg-white";
                  textClass = "text-gray-800";
              }

              return (
                <div 
                    id={`date-btn-${dateKey}`}
                    key={dateKey} 
                    className="flex-shrink-0 snap-center px-1 w-[20%] lg:w-[14.285%]" 
                >
                    <button 
                        onClick={() => setSelectedDate(date)}
                        className={`w-full h-[4.5rem] rounded-2xl border flex flex-col items-center justify-center transition-all duration-200 active:scale-95 ${containerClass}`}
                    >
                        <span className={`text-sm font-bold mb-0.5 ${textClass}`}>
                            {dayName}
                        </span>
                        <span className={`text-lg font-black font-mono leading-none ${isSelected ? 'text-white/90' : (isPast ? 'text-gray-400' : 'text-gray-900')}`}>
                            {date.getDate()}
                        </span>
                        {isToday && (
                            <div className={`mt-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-zen-500'}`}></div>
                        )}
                    </button>
                </div>
              );
          })}
      </div>

      <div className="grid grid-cols-1 gap-4 items-start">
        {/* 
            DAY COLUMN CONTAINER
            - Restored the card style container with inner sticky header
        */}
        <div id={`day-column-${targetDateStr}`} className={`flex flex-col min-h-[100px] rounded-2xl border shadow-sm relative transition-colors ${isSelectedToday ? 'bg-zen-50/80 border-zen-200 backdrop-blur-sm' : 'bg-gray-50/70 border-gray-100 backdrop-blur-sm'}`}>
            <div className={`p-3 border-b flex flex-col items-center justify-center sticky top-0 z-10 rounded-t-2xl shadow-sm h-16 ${isSelectedToday ? 'bg-zen-100/90 border-zen-200' : 'bg-white/90 border-gray-100'}`}>
                <span className={`font-black text-lg ${isSelectedToday ? 'text-zen-800' : 'text-gray-800'}`}>{selectedDayName}</span>
                <span className={`text-sm font-mono ${isSelectedToday ? 'text-zen-700 font-bold' : 'text-gray-500'}`}>
                    {selectedDate.toLocaleDateString('zh-TW', {month:'numeric', day:'numeric'})}
                </span>
                
                {currentUser.role === UserRole.ADMIN && (
                    <button 
                        onClick={() => handleCreateClass(selectedDayOfWeek)}
                        className="absolute top-2 right-2 text-zen-600 hover:bg-zen-50 p-2 rounded-full transition-colors"
                        title={`新增${selectedDayName}課程`}
                    >
                        <Plus size={18} />
                    </button>
                )}
            </div>
            
            <div className={`p-3 flex-1 ${viewMode === 'compact' ? 'space-y-2' : 'space-y-4'}`}>
                {visibleClasses.length > 0 ? (
                    visibleClasses.map(session => {
                        const subId = session.substitutions?.[targetDateStr];
                        const isSubForThisDate = !!subId;
                        
                        const displayInstId = isSubForThisDate ? subId : session.instructorId;
                        
                        const instructor = instructors.find(i => i.id === displayInstId) || {
                            id: 'unknown',
                            name: 'Unknown',
                            bio: '',
                            imageUrl: 'https://via.placeholder.com/100'
                        };

                        return (
                            <ClassCard 
                                key={session.id} 
                                session={session} 
                                instructor={instructor}
                                targetDate={selectedDate} 
                                onAction={() => handleClassAction(session, selectedDate)}
                                onEdit={() => handleEditClass(session.id)}
                                isCompact={viewMode === 'compact'}
                                displayAsSubstitute={isSubForThisDate} 
                            />
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 text-sm italic space-y-1">
                        <span>{isStudent ? '無' : '無課程'}</span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {managingClassSession && instructors.length > 0 && managingDate && (
        <AdminManageModal 
            session={managingClassSession}
            targetDate={managingDate}
            instructor={instructors.find(i => i.id === managingClassSession.instructorId)!}
            onClose={() => { setManagingClassSession(null); setManagingDate(null); }}
        />
      )}

      {isClassEditorOpen && (
        <ClassEditorModal 
            key={`editor-${isClassEditorOpen ? 'open' : 'closed'}-${editingClassId || 'new'}-${newClassDay}`}
            classId={editingClassId}
            initialDayOfWeek={newClassDay}
            onClose={() => setIsClassEditorOpen(false)}
        />
      )}

      {showStudentDirectory && (
        <StudentDirectoryModal onClose={() => setShowStudentDirectory(false)} />
      )}

      {showInstructorDirectory && (
        <InstructorDirectoryModal onClose={() => setShowInstructorDirectory(false)} />
      )}

      {showExportModal && (
        <DataExportModal onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
};

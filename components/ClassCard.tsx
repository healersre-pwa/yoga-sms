
import React, { useState, useEffect } from 'react';
import { ClassSession, Instructor, UserRole } from '../types';
import { AlertCircle, X, Pencil, Clock, LogIn, CreditCard, MapPin, Loader2, Coins, Save, Users, User, Settings, UserCog, ExternalLink } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface ClassCardProps {
  session: ClassSession;
  instructor: Instructor;
  targetDate: Date; // The specific date this card represents in the grid
  onAction: () => Promise<void> | void; // Allow async
  onEdit?: () => void;
  isCompact?: boolean;
  displayAsSubstitute?: boolean; // Explicit override for visual rendering
}

export const ClassCard: React.FC<ClassCardProps> = ({ 
    session, 
    instructor, 
    targetDate, 
    onAction, 
    onEdit, 
    isCompact = false,
    displayAsSubstitute
}) => {
  const { currentUser, students, setLoginModalOpen, setTopUpModalOpen, formatDateKey, updateClass } = useApp();
  const [isLoading, setIsLoading] = useState(false);

  // Description Editing State
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(session.description || '');

  useEffect(() => {
      setDescValue(session.description || '');
  }, [session.description]);

  const handleDescSave = async () => {
      if (descValue !== session.description) {
          await updateClass(session.id, { description: descValue });
      }
      setIsEditingDesc(false);
  };

  // BOOKING LOGIC: Check 'bookings' map for this specific date
  const dateKey = formatDateKey(targetDate);
  const dailyBookings = session.bookings?.[dateKey] || [];
  
  const isBooked = dailyBookings.includes(currentUser.id);
  
  // Calculate valid students only (exclude ghosts) from the daily list
  const validEnrolledCount = students.length > 0 
      ? dailyBookings.filter(id => students.some(s => s.id === id)).length
      : dailyBookings.length;
  
  const isFull = validEnrolledCount >= session.capacity;
  
  // Roles
  const isGuest = currentUser.role === UserRole.GUEST;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isStudent = currentUser.role === UserRole.STUDENT;
  
  // Membership Check (LIVE DATA)
  const liveStudent = currentUser.role === UserRole.STUDENT 
    ? students.find(s => s.id === currentUser.id) 
    : null;
    
  // Membership Status
  const membershipType = liveStudent?.membershipType || 'CREDIT';
  const credits = liveStudent?.credits || 0;
  const expiry = liveStudent?.unlimitedExpiry;
  const todayStr = formatDateKey(new Date());
  
  // LOGIC FIX: Check if expiry covers the CLASS DATE, not just today
  const isExpiredForClass = membershipType === 'UNLIMITED' && (!expiry || expiry < dateKey);
  
  const pointsCost = session.pointsCost ?? 1;
  const isInsufficient = membershipType === 'CREDIT' && credits < pointsCost;
  
  // Use the Target Date passed from Dashboard
  const [startH, startM] = session.startTimeStr.split(':').map(Number);
  const specificClassDate = new Date(targetDate);
  specificClassDate.setHours(startH, startM, 0, 0);

  // Calculate End Time
  const totalMins = startH * 60 + startM + session.durationMinutes;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  
  const formatTime = (h: number, m: number) => {
      const displayH = String(h).padStart(2, '0');
      const displayM = String(m).padStart(2, '0');
      return `${displayH}:${displayM}`; 
  };

  const startTimeDisplay = formatTime(startH, startM);
  const endTimeDisplay = formatTime(endH, endM);

  // Check if class is in the past
  const now = new Date();
  const isPast = specificClassDate < now;

  // Check if class is OPEN for booking (9:00 AM two days before DATE)
  const openTime = new Date(targetDate);
  openTime.setHours(9, 0, 0, 0);
  openTime.setDate(openTime.getDate() - 2);
  
  const isTooEarly = now < openTime;

  const handleActionClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isGuest) {
          setLoginModalOpen(true);
          return;
      }

      // 特殊邏輯：如果是點數不足，則開啟購課視窗
      if (isStudent && isInsufficient && !isBooked && !isPast && !isTooEarly && !isFull && !isExpiredForClass) {
          setTopUpModalOpen(true);
          return;
      }

      if (isPast && !isAdmin) return;

      setIsLoading(true);
      await onAction();
      setIsLoading(false);
  };

  const difficultyColor = {
      'Beginner': 'bg-green-100 text-green-700',
      'Intermediate': 'bg-yellow-100 text-yellow-700',
      'Advanced': 'bg-red-100 text-red-700'
  }[session.difficulty] || 'bg-gray-100 text-gray-700';

  const difficultyLabel = {
      'Beginner': '初學',
      'Intermediate': '中級',
      'Advanced': '進階'
  }[session.difficulty];

  // --- RENDER HELPERS ---
  const ActionButton = () => {
      // 1. Admin Override: Always show "Manage"
      if (isAdmin) {
          return (
              <button 
                  onClick={handleActionClick}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl font-bold text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-zen-600 hover:border-zen-300 shadow-sm transition-all"
              >
                  {isLoading ? <Loader2 className="animate-spin mx-auto" size={16}/> : '管理'}
              </button>
          );
      }

      // 2. Guest/Student Logic
      if (isPast && !isBooked) return null;
      if (isPast && isBooked) return <span className="text-gray-400 text-xs font-bold bg-gray-100 px-2 py-1 rounded-lg whitespace-nowrap">已結束</span>;

      if (isBooked) {
          return (
              <button 
                  onClick={handleActionClick} 
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm border bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
              >
                  {isLoading ? <Loader2 className="animate-spin mx-auto" size={16}/> : '取消'}
              </button>
          );
      }
      
      if (isFull) {
           return (
              <div className="w-full py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-400 text-center border border-gray-200">
                  額滿
              </div>
           );
      }

      // Render Booking Button
      let disabled = false;
      let label = '預約';
      let subLabel = '';
      let isTopUpStyle = false;
      
      if (isStudent) {
           if (isTooEarly) {
               disabled = true;
               label = '未開放';
               subLabel = ''; 
           } else if (isExpiredForClass) {
               disabled = true;
               label = '會籍過期';
           } else if (isInsufficient) {
               // 改為引導購課
               disabled = false;
               label = '購課';
               subLabel = ''; // 移除點數不足提示
               isTopUpStyle = true;
           }
      }

      return (
          <button 
              onClick={handleActionClick}
              disabled={isLoading || disabled}
              className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex flex-col items-center justify-center leading-none gap-1
                  ${disabled 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none' 
                      : isTopUpStyle 
                        ? 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 shadow-amber-100'
                        : 'bg-zen-600 text-white hover:bg-zen-700 active:scale-95 shadow-zen-200'
                  }`}
          >
              {isLoading ? (
                  <Loader2 className="animate-spin" size={16}/>
              ) : (
                  <>
                      <span className="flex items-center gap-1">
                        {label} {isTopUpStyle && <ExternalLink size={12}/>}
                      </span>
                      {subLabel && <span className="text-[10px] opacity-80 font-medium">{subLabel}</span>}
                  </>
              )}
          </button>
      );
  };

  // ----------------------------------------------------------------------
  // COMPACT VIEW
  // ----------------------------------------------------------------------
  if (isCompact) {
      let containerClass = "bg-white border-gray-200"; 
      let timeBgClass = "bg-gray-50 border-gray-100";
      
      if (displayAsSubstitute) {
          containerClass = "bg-[#fffdf5] border-amber-400 shadow-sm"; 
          timeBgClass = "bg-amber-100/50 border-amber-200";
          if (isBooked && !isAdmin) containerClass += " ring-2 ring-zen-500 border-transparent";
          else containerClass += " ring-1 ring-amber-200";
      } else if (isBooked && !isAdmin) {
          containerClass = "border-zen-500 ring-1 ring-zen-500 bg-zen-50/30";
      }

      return (
        <div 
            onClick={isAdmin ? onAction : undefined}
            className={`relative flex items-stretch rounded-xl border transition-all overflow-hidden
                ${isPast ? 'opacity-60 grayscale' : 'hover:border-zen-300 shadow-sm'}
                ${containerClass}
            `}
        >
             {isAdmin && onEdit && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="absolute top-1 right-1 p-1.5 text-gray-400 hover:text-zen-600 hover:bg-white/50 rounded-lg transition-colors z-20"
                    title="編輯課程設定"
                >
                    <Settings size={16} />
                </button>
            )}

            <div className={`w-[85px] flex flex-col items-center justify-center border-r px-2 py-3 shrink-0 ${timeBgClass}`}>
                <span className="text-xl font-black text-gray-800 leading-none">{startTimeDisplay}</span>
                <span className="text-xs font-medium text-gray-400 my-1">-</span>
                <span className="text-lg font-bold text-gray-500 leading-none">{endTimeDisplay}</span>
            </div>

            <div className="flex-1 p-3 min-w-0 flex flex-col justify-center">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-lg text-gray-900 leading-tight break-words">
                        {session.title}
                    </h3>
                    <div className="shrink-0 flex gap-1">
                        {displayAsSubstitute && (
                            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                                <AlertCircle size={10} className="stroke-[3]"/> 代
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                     <span className="font-bold text-zen-700 text-sm mr-1">
                        {instructor.name}
                     </span>
                     <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${difficultyColor}`}>
                        {difficultyLabel}
                     </span>
                     <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                        <Coins size={10} /> {pointsCost}
                     </span>
                     <span className="text-xs text-gray-400 font-medium">
                        ({validEnrolledCount}/{session.capacity}人)
                     </span>
                </div>
            </div>

            <div className="w-[80px] p-2 flex items-center justify-center border-l border-gray-100 bg-white/50">
                <ActionButton />
            </div>
        </div>
      );
  }

  // ----------------------------------------------------------------------
  // NORMAL VIEW
  // ----------------------------------------------------------------------
  let normalContainerClass = "bg-white border-gray-200"; 
  if (displayAsSubstitute) {
      normalContainerClass = "bg-[#fffdf5] border-amber-400";
      if (isBooked && !isAdmin) normalContainerClass += " ring-2 ring-zen-500 border-transparent";
  } else if (isBooked && !isAdmin) {
      normalContainerClass = "bg-zen-50/20 border-transparent ring-2 ring-zen-500";
  }

  return (
    <div 
        onClick={isAdmin ? onAction : undefined}
        className={`relative flex flex-row rounded-2xl border transition-all shadow-sm overflow-hidden min-h-[180px]
            ${isPast ? 'opacity-60' : 'hover:shadow-md hover:border-zen-300'}
            ${normalContainerClass}
        `}
    >
        {displayAsSubstitute && (
            <div className="absolute top-0 left-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-br-xl z-20 shadow-sm flex items-center gap-1">
                <AlertCircle size={12} /> 代課
            </div>
        )}

        {isAdmin && onEdit && (
            <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="absolute top-2 right-2 p-2 text-gray-400 hover:text-zen-600 hover:bg-gray-100 rounded-lg transition-colors z-20"
                title="編輯課程設定"
            >
                <Settings size={18} />
            </button>
        )}

        <div className="w-[35%] bg-gray-50/50 border-r border-gray-100 p-4 flex flex-col justify-between shrink-0">
             <div className="bg-white border border-gray-200 rounded-lg p-2 text-center mb-3 shadow-sm">
                 <div className="text-2xl font-black text-gray-800 leading-none mb-1">
                    {startTimeDisplay}
                 </div>
                 <div className="text-sm font-medium text-gray-500">
                    {endTimeDisplay}
                 </div>
             </div>
             <div className="flex flex-col items-center text-center mb-3">
                 <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm mb-1">
                    {instructor.imageUrl ? (
                        <img src={instructor.imageUrl} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                            <UserCog size={20} />
                        </div>
                    )}
                 </div>
                 <span className="font-bold text-gray-800 text-sm leading-tight px-1">
                    {instructor.name}
                 </span>
                 <span className="text-[10px] text-gray-400">
                    {displayAsSubstitute ? '代課老師' : '授課老師'}
                 </span>
             </div>
             <div className="mt-auto">
                 <ActionButton />
             </div>
        </div>

        <div className="w-[65%] p-5 flex flex-col relative">
            <div className="mb-3 pr-8">
                <h3 className="text-2xl font-black text-gray-900 leading-tight mb-2 break-words">
                    {session.title}
                </h3>
                <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${difficultyColor}`}>
                        {difficultyLabel}
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">
                        <Coins size={12} /> {pointsCost}
                    </span>
                    <span className="text-xs text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                        <Users size={12} /> {validEnrolledCount}/{session.capacity}
                    </span>
                </div>
            </div>
            <div className="flex-1 min-h-[60px] relative group/desc">
                {isAdmin && !isEditingDesc && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsEditingDesc(true); }}
                        className="absolute bottom-0 right-0 p-2 bg-green-600 text-white rounded-full shadow-md hover:bg-green-700 transition-all active:scale-95 z-10"
                        title="編輯簡介"
                    >
                        <Pencil size={14} />
                    </button>
                )}
                {isEditingDesc ? (
                    <div className="h-full flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                        <textarea 
                            value={descValue}
                            onChange={(e) => setDescValue(e.target.value)}
                            className="w-full h-full min-h-[80px] p-2 text-sm border border-zen-300 rounded-lg focus:ring-2 focus:ring-zen-500 outline-none bg-white resize-none"
                            placeholder="輸入課程簡介..."
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsEditingDesc(false)} className="text-xs text-gray-500 hover:bg-gray-100 px-2 py-1 rounded">取消</button>
                            <button onClick={handleDescSave} className="text-xs bg-zen-600 text-white px-3 py-1 rounded flex items-center gap-1">
                                <Save size={12} /> 儲存
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap h-full overflow-y-auto max-h-[120px] custom-scrollbar pr-8">
                        {session.description ? session.description : <span className="text-gray-300 italic text-xs">尚無簡介...</span>}
                    </div>
                )}
            </div>
            <div className="absolute bottom-3 left-0 text-[10px] text-gray-400 flex items-center gap-1 bg-white/50 px-2 py-1 rounded-full">
                <MapPin size={10} /> {session.location}
            </div>
        </div>
    </div>
  );
};

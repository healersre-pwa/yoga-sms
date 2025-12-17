
import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Download, FileSpreadsheet, Users, UserCog, Calendar, FileText, Database, Table, Loader2, Trash2, AlertTriangle, CheckCircle, UserMinus, FileKey } from 'lucide-react';

interface Props {
  onClose: () => void;
}

// UI State for Prune Flow
type PruneStep = 'IDLE' | 'CONFIRM' | 'PRUNING' | 'SUCCESS';
type CleanStep = 'IDLE' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS';

export const DataExportModal: React.FC<Props> = ({ onClose }) => {
  const { students, instructors, classes, fetchArchivedClasses, allClassesHistory, pruneArchivedClasses, cleanupInactiveStudents, formatDateKey } = useApp();
  const [isPreparing, setIsPreparing] = useState(false);
  
  // Prune State
  const [pruneStep, setPruneStep] = useState<PruneStep>('IDLE');
  const [pruneMonths, setPruneMonths] = useState<number>(3); // Default 3 months
  const [pruneStats, setPruneStats] = useState({ deletedDocs: 0, cleanedRecords: 0 });

  // Cleanup State
  const [cleanStep, setCleanStep] = useState<CleanStep>('IDLE');
  const [inactiveCount, setInactiveCount] = useState<number | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
         const cellStr = String(cell ?? '');
         return `"${cellStr.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    link.setAttribute('download', `${filename}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportStudents = () => {
    const headers = ['ID', '姓名', '電話', '帳號', '身份', '會員資格', '剩餘點數', '課程自由到期日', '已付費'];
    const rows = students.map(s => [
      s.id,
      s.name,
      s.phoneNumber || '',
      s.username || '',
      s.role,
      s.membershipType === 'UNLIMITED' ? '課程自由' : '扣點制',
      s.credits || 0,
      s.unlimitedExpiry || '',
      s.hasPaid ? '是' : '否'
    ]);
    downloadCSV('ZenFlow_Students', headers, rows);
  };

  const handleExportInstructors = () => {
    const headers = ['ID', '姓名', '預設時薪', '簡介'];
    const rows = instructors.map(i => [
      i.id,
      i.name,
      i.defaultRate || 800,
      i.bio
    ]);
    downloadCSV('ZenFlow_Instructors', headers, rows);
  };

  const handleExportSchedule = () => {
    const headers = ['ID', '課程名稱', '星期', '開始時間', '時長(分)', '授課老師', '地點', '難度', '扣點', '人數限制'];
    const sortedClasses = [...classes].sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTimeStr.localeCompare(b.startTimeStr);
    });

    const rows = sortedClasses.map(c => {
        const instructorName = instructors.find(i => i.id === c.instructorId)?.name || '未知';
        return [
            c.id,
            c.title,
            c.dayOfWeek,
            c.startTimeStr,
            c.durationMinutes,
            instructorName,
            c.location,
            c.difficulty,
            c.pointsCost ?? 1,
            c.capacity
        ];
    });
    downloadCSV('ZenFlow_Schedule', headers, rows);
  };

  const handleExportMasterBookingLog = async () => {
    setIsPreparing(true);
    await fetchArchivedClasses(); 
    setIsPreparing(false);

    const headers = ['日期', '星期', '時間', '課程名稱', '授課老師', '學生姓名', '電話', '會員類型', '扣點'];
    const rows: string[][] = [];
    const dayMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

    allClassesHistory.forEach(cls => {
        if (!cls.bookings) return;
        const bookings = cls.bookings as Record<string, string[]>;

        Object.entries(bookings).forEach(([dateKey, studentIds]) => {
            const dateObj = new Date(dateKey);
            const dayName = dayMap[dateObj.getDay()];
            
            let instructorName = instructors.find(i => i.id === cls.instructorId)?.name || '未知';
            if (cls.substitutions && cls.substitutions[dateKey]) {
                const subName = instructors.find(i => i.id === cls.substitutions![dateKey])?.name;
                if (subName) instructorName = `${subName} (代)`;
            }

            studentIds.forEach(studentId => {
                const student = students.find(s => s.id === studentId);
                if (student) {
                    rows.push([
                        dateKey,
                        dayName,
                        cls.startTimeStr,
                        cls.title,
                        instructorName,
                        student.name,
                        student.phoneNumber || '',
                        student.membershipType === 'UNLIMITED' ? '課程自由' : '扣點',
                        (cls.pointsCost ?? 1).toString()
                    ]);
                }
            });
        });
    });

    rows.sort((a, b) => b[0].localeCompare(a[0]));
    downloadCSV('ZenFlow_Master_Booking_Log', headers, rows);
  };

  const handleExportSystemBackup = async () => {
      setIsPreparing(true);
      await fetchArchivedClasses();
      setIsPreparing(false);

      const safeStringify = (obj: any) => {
        const cache = new Set();
        try {
            return JSON.stringify(obj, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    // Try/Catch for safe property access
                    try {
                        if (value.window === value) return;
                        if (value instanceof HTMLElement) return;
                    } catch (e) {
                        return;
                    }

                    if (cache.has(value)) {
                        return; 
                    }
                    cache.add(value);
                }
                return value;
            }, 2);
        } catch(e) {
            console.error("Stringify failed", e);
            return "{}";
        }
      };

      try {
          const backupData = {
              timestamp: new Date().toISOString(),
              version: '1.0',
              students,
              instructors,
              classes: allClassesHistory // Export ALL history
          };
          
          const jsonString = safeStringify(backupData);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
          link.setAttribute('download', `ZenFlow_Full_Backup_${dateStr}.json`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e) {
          console.error("Backup failed", e);
          alert("備份失敗：資料結構可能過於複雜");
      }
  };

  // --- Prune Handlers ---
  const handleStartPrune = () => {
      setPruneStep('CONFIRM');
  };

  const handleExecutePrune = async () => {
      setPruneStep('PRUNING');
      try {
          const stats = await pruneArchivedClasses(pruneMonths);
          setPruneStats(stats);
          setPruneStep('SUCCESS');
      } catch (e) {
          alert("清理失敗，請檢查網路連線。");
          console.error(e);
          setPruneStep('IDLE');
      }
  };

  // --- Cleanup Handlers ---
  const handleStartCleanup = async () => {
      setCleanStep('CONFIRM');
  };

  const handleExecuteCleanup = async () => {
      setCleanStep('PROCESSING');
      try {
          const result = await cleanupInactiveStudents();
          setDeletedCount(result.count);
          setCleanStep('SUCCESS');
      } catch (e) {
          console.error(e);
          alert("清理失敗，請稍後再試");
          setCleanStep('IDLE');
      }
  };

  // --- Auth Deletion List Export ---
  const handleExportAuthDeletionList = () => {
      // Logic mirrors cleanupInactiveStudents but returns CSV instead of deleting
      const todayStr = formatDateKey(new Date());
      const studentsWithFutureBookings = new Set<string>();

      // 1. Identify students with future bookings
      classes.forEach(c => {
          if (c.bookings) {
              Object.entries(c.bookings).forEach(([dateKey, userIds]) => {
                  if (dateKey >= todayStr) {
                      (userIds as string[]).forEach(id => studentsWithFutureBookings.add(id));
                  }
              });
          }
      });

      // 2. Identify Targets
      const targets = students.filter(u => {
          if (u.role !== 'STUDENT') return false;
          if (studentsWithFutureBookings.has(u.id)) return false;
          if ((u.credits || 0) > 0) return false;
          const isUnlimited = u.membershipType === 'UNLIMITED';
          const isUnlValid = isUnlimited && (u.unlimitedExpiry && u.unlimitedExpiry >= todayStr);
          if (isUnlValid) return false;
          return true;
      });

      if (targets.length === 0) {
          alert("目前沒有符合「閒置條件」的學生帳號。");
          return;
      }

      // 3. Export
      const headers = ['User UID', 'Email', 'Name', 'Reason'];
      const rows = targets.map(u => [
          u.id, // This is the Auth UID
          u.email || 'No Email',
          u.name,
          'Inactive (No credits/bookings)'
      ]);

      downloadCSV('Auth_Users_To_Delete', headers, rows);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-white p-5 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Download className="text-zen-600" size={24} />
                        資料與備份管理
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        匯出報表、系統備份與資料庫維護
                    </p>
                </div>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                    <X size={24} />
                </button>
            </div>

            <div className="p-6 space-y-4 bg-gray-50">
                {isPreparing && (
                    <div className="flex items-center justify-center p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm mb-4">
                        <Loader2 className="animate-spin mr-2" size={16} />
                        正在下載歷史資料以供匯出，請稍候...
                    </div>
                )}

                {/* Export Section */}
                <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">分項清單 (CSV)</p>
                    <button onClick={handleExportStudents} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-zen-300 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors"><Users size={20} /></div>
                            <div className="text-left"><h3 className="font-bold text-gray-800 text-sm">匯出學生名單</h3></div>
                        </div>
                        <FileText className="text-gray-300 group-hover:text-blue-500" size={20} />
                    </button>

                    <button onClick={handleExportInstructors} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-zen-300 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors"><UserCog size={20} /></div>
                            <div className="text-left"><h3 className="font-bold text-gray-800 text-sm">匯出師資與薪資</h3></div>
                        </div>
                        <FileText className="text-gray-300 group-hover:text-purple-500" size={20} />
                    </button>

                    <button onClick={handleExportSchedule} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-zen-300 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors"><Calendar size={20} /></div>
                            <div className="text-left"><h3 className="font-bold text-gray-800 text-sm">匯出每週課表</h3></div>
                        </div>
                        <FileText className="text-gray-300 group-hover:text-green-500" size={20} />
                    </button>
                </div>

                <div className="border-t border-gray-200 my-4"></div>

                {/* Backup Section */}
                <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">完整備份 / 總表</p>
                    
                    <button onClick={handleExportMasterBookingLog} disabled={isPreparing} className="w-full bg-zen-50 p-4 rounded-xl border border-zen-200 shadow-sm hover:shadow-md hover:border-zen-400 transition-all flex items-center justify-between group disabled:opacity-50">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white text-zen-600 rounded-full flex items-center justify-center border border-zen-100 group-hover:bg-zen-600 group-hover:text-white transition-colors"><Table size={20} /></div>
                            <div className="text-left">
                                <h3 className="font-bold text-gray-800 text-sm">匯出完整預約總表 (CSV)</h3>
                                <p className="text-xs text-gray-500">所有歷史預約紀錄</p>
                            </div>
                        </div>
                        <FileSpreadsheet className="text-zen-400 group-hover:text-zen-600" size={20} />
                    </button>

                    <button onClick={handleExportSystemBackup} disabled={isPreparing} className="w-full bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm hover:shadow-md hover:bg-gray-900 transition-all flex items-center justify-between group disabled:opacity-50">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center group-hover:text-white transition-colors"><Database size={20} /></div>
                            <div className="text-left">
                                <h3 className="font-bold text-white text-sm">系統完整備份 (.json)</h3>
                                <p className="text-xs text-gray-400">包含所有資料，可用於還原</p>
                            </div>
                        </div>
                        <Download className="text-gray-500 group-hover:text-white" size={20} />
                    </button>
                </div>

                <div className="border-t border-gray-200 my-4"></div>

                {/* Maintenance Section (Multi-step) */}
                <div className="space-y-4">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> 資料庫維護
                    </p>
                    
                    {/* PRUNE SECTION */}
                    {pruneStep === 'IDLE' && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-red-800 text-sm">刪除過期資料</h3>
                                <select 
                                    value={pruneMonths} 
                                    onChange={(e) => setPruneMonths(Number(e.target.value))}
                                    className="text-xs border border-red-200 rounded px-2 py-1 bg-white text-red-800 outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                                >
                                    <option value={2}>2 個月前</option>
                                    <option value={3}>3 個月前</option>
                                    <option value={6}>6 個月前</option>
                                    <option value={12}>1 年前</option>
                                </select>
                            </div>
                            <p className="text-xs text-red-600/80 mb-3 leading-relaxed">
                                此操作將永久刪除<b>{pruneMonths}個月前</b>的已封存課程紀錄與舊預約。<br/>
                                這將有效縮減資料庫大小，且<b>不會影響</b>學生的剩餘點數。
                            </p>
                            <button 
                                onClick={handleStartPrune}
                                className="w-full bg-white border border-red-200 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Trash2 size={14} />
                                執行清理
                            </button>
                        </div>
                    )}

                    {pruneStep === 'CONFIRM' && (
                        <div className="bg-red-100 border border-red-200 p-4 rounded-xl animate-in zoom-in-95">
                            <h3 className="font-bold text-red-800 text-sm mb-2 flex items-center gap-2">
                                <AlertTriangle size={16} /> 確定要刪除嗎？
                            </h3>
                            <p className="text-xs text-red-700 mb-4 leading-relaxed">
                                這將無法復原！您即將刪除 {pruneMonths} 個月前的所有歷史紀錄。
                                <br/>建議先執行「系統完整備份」。
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setPruneStep('IDLE')}
                                    className="flex-1 bg-white border border-red-200 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-50"
                                >
                                    取消
                                </button>
                                <button 
                                    onClick={handleExecutePrune}
                                    className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-red-700 shadow-md"
                                >
                                    確定刪除
                                </button>
                            </div>
                        </div>
                    )}

                    {pruneStep === 'PRUNING' && (
                        <div className="bg-red-50 border border-red-100 p-6 rounded-xl flex flex-col items-center justify-center text-red-600 animate-pulse">
                            <Loader2 size={24} className="animate-spin mb-2" />
                            <span className="text-sm font-bold">正在清理過期資料...</span>
                            <span className="text-xs opacity-70 mt-1">請勿關閉視窗</span>
                        </div>
                    )}

                    {pruneStep === 'SUCCESS' && (
                        <div className="bg-green-50 border border-green-200 p-4 rounded-xl animate-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 mb-2 text-green-800 font-bold text-sm">
                                <CheckCircle size={16} />
                                清理完成！
                            </div>
                            <ul className="text-xs text-green-700 space-y-1 mb-3 list-disc pl-4">
                                <li>已刪除 <b>{pruneStats.deletedDocs}</b> 個舊課程檔案</li>
                                <li>已移除 <b>{pruneStats.cleanedRecords}</b> 筆過期預約紀錄</li>
                            </ul>
                            <button 
                                onClick={() => setPruneStep('IDLE')}
                                className="w-full bg-white border border-green-200 text-green-700 py-2 rounded-lg text-xs font-bold hover:bg-green-100"
                            >
                                完成
                            </button>
                        </div>
                    )}

                    {/* CLEANUP INACTIVE STUDENTS SECTION */}
                    {cleanStep === 'IDLE' && (
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl transition-all space-y-3">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-orange-800 text-sm">清除閒置學生帳號</h3>
                            </div>
                            <p className="text-xs text-orange-700/80 leading-relaxed">
                                掃描條件：1.無點數 2.無會籍(或過期) 3.無未來約課
                            </p>
                            
                            <button 
                                onClick={handleStartCleanup}
                                className="w-full bg-white border border-orange-200 text-orange-600 py-2 rounded-lg text-xs font-bold hover:bg-orange-600 hover:text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                                <UserMinus size={14} />
                                掃描並清除 DB 資料
                            </button>

                            <button 
                                onClick={handleExportAuthDeletionList}
                                className="w-full bg-orange-100 border border-orange-300 text-orange-800 py-2 rounded-lg text-xs font-bold hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                title="因權限限制，無法直接刪除 Auth 帳號，請匯出此清單手動處理"
                            >
                                <FileKey size={14} />
                                匯出 Auth UID 刪除清單 (CSV)
                            </button>
                        </div>
                    )}

                    {cleanStep === 'CONFIRM' && (
                        <div className="bg-orange-100 border border-orange-200 p-4 rounded-xl animate-in zoom-in-95">
                            <h3 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-2">
                                <AlertTriangle size={16} /> 確定執行嗎？
                            </h3>
                            <p className="text-xs text-orange-800 mb-4 leading-relaxed">
                                系統將自動刪除符合「無點數、無會籍、無未來預約」的學生資料。
                                <br/>此操作無法復原。
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setCleanStep('IDLE')}
                                    className="flex-1 bg-white border border-orange-200 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-50"
                                >
                                    取消
                                </button>
                                <button 
                                    onClick={handleExecuteCleanup}
                                    className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-orange-700 shadow-md"
                                >
                                    確認執行
                                </button>
                            </div>
                        </div>
                    )}

                    {cleanStep === 'PROCESSING' && (
                        <div className="bg-orange-50 border border-orange-100 p-6 rounded-xl flex flex-col items-center justify-center text-orange-600 animate-pulse">
                            <Loader2 size={24} className="animate-spin mb-2" />
                            <span className="text-sm font-bold">正在掃描與刪除...</span>
                        </div>
                    )}

                    {cleanStep === 'SUCCESS' && (
                        <div className="bg-green-50 border border-green-200 p-4 rounded-xl animate-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 mb-2 text-green-800 font-bold text-sm">
                                <CheckCircle size={16} />
                                清除完成！
                            </div>
                            <p className="text-xs text-green-700 mb-3">
                                共刪除了 <b>{deletedCount}</b> 位閒置學生資料。
                            </p>
                            <button 
                                onClick={() => setCleanStep('IDLE')}
                                className="w-full bg-white border border-green-200 text-green-700 py-2 rounded-lg text-xs font-bold hover:bg-green-100"
                            >
                                完成
                            </button>
                        </div>
                    )}

                </div>

            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
                <button onClick={onClose} className="text-gray-500 font-bold text-sm px-4 py-2 hover:bg-gray-100 rounded-lg">
                    關閉
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

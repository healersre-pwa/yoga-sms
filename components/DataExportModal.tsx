
import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Download, FileSpreadsheet, Users, FileText, Table, Loader2, Trash2, UserMinus, ShieldAlert, CheckCircle, Database, UserCog } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type MaintenanceStep = 'IDLE' | 'CONFIRM_PRUNE' | 'CONFIRM_CLEANUP' | 'PROCESSING' | 'SUCCESS';

export const DataExportModal: React.FC<Props> = ({ onClose }) => {
  const { 
    students, instructors, fetchArchivedClasses, allClassesHistory, 
    pruneArchivedClasses, cleanupInactiveStudents, formatDateKey,
    appLogo, appBackgroundImage, appIcon192, appIcon512 
  } = useApp();
  
  const [isPreparing, setIsPreparing] = useState(false);
  const [step, setStep] = useState<MaintenanceStep>('IDLE');
  const [resultMsg, setResultMsg] = useState('');

  const downloadFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    downloadFile(`${filename}.csv`, csvContent, 'text/csv;charset=utf-8;');
  };

  const handleExportStudents = () => {
    const headers = ['ID', '姓名', '電話', 'Email', '會員資格', '剩餘點數', '到期日'];
    const rows = students.map(s => [
        s.id, s.name, s.phoneNumber || '', s.email || '', 
        s.membershipType === 'UNLIMITED' ? '課程自由' : '扣點制', 
        s.credits || 0, s.unlimitedExpiry || ''
    ]);
    downloadCSV('ZenFlow_學生總名單', headers, rows);
  };

  const handleExportNoCreditStudents = () => {
    const noCredit = students.filter(s => {
        if (s.membershipType === 'UNLIMITED') return false;
        return (s.credits || 0) <= 0;
    });
    const headers = ['ID', '姓名', '電話', 'Email', '餘額'];
    const rows = noCredit.map(s => [s.id, s.name, s.phoneNumber || '', s.email || '', 0]);
    downloadCSV('ZenFlow_零額度待續費名單', headers, rows);
  };

  const handleExportInstructors = () => {
    const headers = ['ID', '姓名', '電話', '預設時薪', '簡介'];
    const rows = instructors.map(i => [i.id, i.name, i.phoneNumber || '', i.defaultRate || 0, i.bio || '']);
    downloadCSV('ZenFlow_講師聯絡名錄', headers, rows);
  };

  const handleExportMasterBookingLog = async () => {
    setIsPreparing(true);
    await fetchArchivedClasses(); 
    setIsPreparing(false);
    const headers = ['日期', '時間', '課程名稱', '授課老師', '學生姓名', '地點'];
    const rows: string[][] = [];
    allClassesHistory.forEach(cls => {
        if (!cls.bookings) return;
        Object.entries(cls.bookings).forEach(([date, studentIds]) => {
            (studentIds as string[]).forEach(sid => {
                const s = students.find(u => u.id === sid);
                if (s) rows.push([
                    date, cls.startTimeStr, cls.title, 
                    instructors.find(i => i.id === cls.instructorId)?.name || '未知', 
                    s.name, cls.location
                ]);
            });
        });
    });
    downloadCSV('ZenFlow_預約總表對帳單', headers, rows);
  };

  // 系統資料全備份 (JSON Backup - 類似 SQL Dump)
  const handleSystemBackup = () => {
      const backupData = {
          version: '2.0',
          exportDate: new Date().toISOString(),
          appSettings: {
              logo: appLogo,
              background: appBackgroundImage,
              icon192: appIcon192,
              icon512: appIcon512
          },
          instructors: instructors.map(i => ({ ...i, imageUrl: i.imageUrl ? '[IMAGE_DATA]' : '' })), // 避免檔案過大只存結構，或可全存
          students: students.map(s => ({ ...s, avatarUrl: s.avatarUrl ? '[IMAGE_DATA]' : '' }))
      };
      downloadFile(`ZenFlow_FullBackup_${formatDateKey(new Date())}.json`, JSON.stringify(backupData, null, 2), 'application/json');
  };

  const executePrune = async () => {
      setStep('PROCESSING');
      const res = await pruneArchivedClasses(3);
      setResultMsg(`清理完成！共刪除 ${res.deletedDocs} 堂舊課程，釋放 ${res.cleanedRecords} 筆空間。`);
      setStep('SUCCESS');
  };

  const executeCleanup = async () => {
      setStep('PROCESSING');
      const res = await cleanupInactiveStudents();
      setResultMsg(`清理完成！共從系統移除 ${res.count} 位無額度且無預約的非活躍學生。`);
      setStep('SUCCESS');
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            
            <div className="bg-white p-5 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">數據中心與系統維護</h2>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-8 bg-gray-50/50">
                
                {/* 第一區：Excel / CSV 報表匯出 */}
                <div className="space-y-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">CSV / EXCEL 報表</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button onClick={handleExportStudents} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-zen-300 transition-all flex items-center gap-4 group text-left">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0"><Users size={22} /></div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm">全體學生名單</h3>
                                <p className="text-[10px] text-gray-400">通訊錄與剩餘點數</p>
                            </div>
                        </button>
                        
                        <button onClick={handleExportNoCreditStudents} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-zen-300 transition-all flex items-center gap-4 group text-left">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0"><FileText size={22} /></div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm">零額度學生名單</h3>
                                <p className="text-[10px] text-gray-400">篩選需續費的學生</p>
                            </div>
                        </button>

                        <button onClick={handleExportInstructors} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-zen-300 transition-all flex items-center gap-4 group text-left">
                            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0"><UserCog size={22} /></div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm">講師通訊錄</h3>
                                <p className="text-[10px] text-gray-400">時薪設定與聯絡資料</p>
                            </div>
                        </button>

                        <button onClick={handleExportMasterBookingLog} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-zen-300 transition-all flex items-center gap-4 group text-left">
                            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors shrink-0">
                                {isPreparing ? <Loader2 size={22} className="animate-spin" /> : <Table size={22} />}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm">全體預約歷史總表</h3>
                                <p className="text-[10px] text-gray-400">所有上課對帳紀錄</p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* 第二區：系統備份與優化 */}
                <div className="space-y-4 pt-6 border-t border-gray-200">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">系統維護與備份</p>
                    
                    <div className="space-y-3">
                        {/* 系統備份 (類似 SQL 備份) */}
                        <button 
                            onClick={handleSystemBackup}
                            className="w-full bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex items-center justify-between group hover:border-zen-500 transition-all"
                        >
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-zen-600 group-hover:text-white transition-colors"><Database size={22} /></div>
                                <div className="text-left">
                                    <h4 className="font-bold text-gray-800 text-sm">系統完整備份 (JSON)</h4>
                                    <p className="text-[10px] text-gray-500">備份所有學生、老師與介面設定檔案。</p>
                                </div>
                            </div>
                            <Download className="text-gray-300 group-hover:text-zen-600" size={18} />
                        </button>

                        {/* 清理功能 */}
                        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-4">
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0"><UserMinus size={22} /></div>
                                <div className="text-left">
                                    <h4 className="font-bold text-gray-800 text-sm">清理非活躍學生</h4>
                                    <p className="text-[10px] text-gray-500">刪除餘額為 0 且未來無預約的帳號。</p>
                                </div>
                            </div>
                            <button onClick={() => setStep('CONFIRM_CLEANUP')} className="bg-red-500 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-red-600 shadow-md shadow-red-100 whitespace-nowrap">執行清理</button>
                        </div>

                        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-4">
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center shrink-0"><Trash2 size={22} /></div>
                                <div className="text-left">
                                    <h4 className="font-bold text-gray-800 text-sm">壓縮雲端體積</h4>
                                    <p className="text-[10px] text-gray-500">刪除三個月前的舊預約紀錄。</p>
                                </div>
                            </div>
                            <button onClick={() => setStep('CONFIRM_PRUNE')} className="bg-gray-800 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-black shadow-md shadow-gray-200 whitespace-nowrap">壓縮資料</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 操作確認 / 進度 Overlay */}
            {(step !== 'IDLE') && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-[20] flex items-center justify-center p-8 text-center animate-in fade-in duration-200">
                    <div className="max-w-xs space-y-6">
                        {step === 'PROCESSING' ? (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="animate-spin text-zen-600" size={48} />
                                <p className="font-bold text-gray-800">資料處理中，請稍候...</p>
                            </div>
                        ) : step === 'SUCCESS' ? (
                            <div className="space-y-4">
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle size={40} /></div>
                                <h3 className="font-bold text-2xl text-gray-900">執行完成</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{resultMsg}</p>
                                <button onClick={() => setStep('IDLE')} className="w-full bg-zen-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-zen-200 active:scale-95 transition-transform">返回中心</button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><ShieldAlert size={40} /></div>
                                <div>
                                    <h3 className="font-bold text-2xl text-gray-900">確定執行？</h3>
                                    <p className="text-sm text-gray-500 mt-2 leading-relaxed">此操作涉及大規模數據刪除且無法復原，建議您先執行上方「完整備份」。</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setStep('IDLE')} className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors">先不要</button>
                                    <button 
                                        onClick={step === 'CONFIRM_PRUNE' ? executePrune : executeCleanup} 
                                        className={`flex-1 text-white py-4 rounded-2xl font-bold shadow-lg transition-transform active:scale-95 ${step === 'CONFIRM_CLEANUP' ? 'bg-red-500 shadow-red-100' : 'bg-gray-900'}`}
                                    >
                                        確定清理
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
                <button onClick={onClose} className="text-gray-400 font-bold text-sm px-6 py-2 hover:bg-gray-100 rounded-xl transition-colors">關閉數據中心</button>
            </div>
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Download, FileSpreadsheet, Users, FileText, Table, Loader2, Trash2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type PruneStep = 'IDLE' | 'CONFIRM' | 'PRUNING' | 'SUCCESS';

export const DataExportModal: React.FC<Props> = ({ onClose }) => {
  const { students, instructors, fetchArchivedClasses, allClassesHistory, pruneArchivedClasses } = useApp();
  const [isPreparing, setIsPreparing] = useState(false);
  const [pruneStep, setPruneStep] = useState<PruneStep>('IDLE');

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportStudents = () => {
    const headers = ['ID', '姓名', '電話', '帳號', '會員資格', '剩餘點數'];
    const rows = students.map(s => [s.id, s.name, s.phoneNumber || '', s.username || '', s.membershipType === 'UNLIMITED' ? '課程自由' : '扣點制', s.credits || 0]);
    downloadCSV('ZenFlow_Students', headers, rows);
  };

  const handleExportMasterBookingLog = async () => {
    setIsPreparing(true);
    await fetchArchivedClasses(); 
    setIsPreparing(false);
    const headers = ['日期', '時間', '課程', '老師', '學生'];
    const rows: string[][] = [];
    allClassesHistory.forEach(cls => {
        if (!cls.bookings) return;
        Object.entries(cls.bookings).forEach(([date, studentIds]) => {
            (studentIds as string[]).forEach(sid => {
                const s = students.find(u => u.id === sid);
                if (s) rows.push([date, cls.startTimeStr, cls.title, instructors.find(i => i.id === cls.instructorId)?.name || '未知', s.name]);
            });
        });
    });
    downloadCSV('ZenFlow_All_Bookings', headers, rows);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-white p-5 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">系統維護與報表</h2>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-6 bg-gray-50">
                <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">資料匯出</p>
                    <button onClick={handleExportStudents} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-zen-300 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors"><Users size={20} /></div>
                            <h3 className="font-bold text-gray-800 text-sm">學生名單 (CSV)</h3>
                        </div>
                        <FileText className="text-gray-300" size={20} />
                    </button>
                    <button onClick={handleExportMasterBookingLog} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-zen-300 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors"><Table size={20} /></div>
                            <h3 className="font-bold text-gray-800 text-sm">預約總表 (CSV)</h3>
                        </div>
                        <FileSpreadsheet className="text-gray-300" size={20} />
                    </button>
                    {isPreparing && <div className="text-center text-xs text-zen-600 font-bold animate-pulse">正在整理歷史報表...</div>}
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider ml-1">清理舊檔</p>
                    {pruneStep === 'IDLE' && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                            <h3 className="font-bold text-red-800 text-sm mb-1">刪除過期資料</h3>
                            <p className="text-xs text-red-600/80 mb-3">永久刪除三個月前的舊紀錄以縮減雲端體積。</p>
                            <button onClick={() => setPruneStep('CONFIRM')} className="w-full bg-white border border-red-200 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-colors">執行清理</button>
                        </div>
                    )}
                    {pruneStep === 'CONFIRM' && (
                        <div className="bg-red-100 border border-red-200 p-4 rounded-xl">
                            <h3 className="font-bold text-red-800 text-sm mb-2">確定刪除三個月前的資料？</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setPruneStep('IDLE')} className="flex-1 bg-white border border-red-200 text-gray-600 py-2 rounded-lg text-xs font-bold">取消</button>
                                <button onClick={async () => { setPruneStep('PRUNING'); await pruneArchivedClasses(3); setPruneStep('SUCCESS'); }} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold">確定</button>
                            </div>
                        </div>
                    )}
                    {pruneStep === 'PRUNING' && <div className="text-center p-4"><Loader2 className="animate-spin mx-auto text-red-600" /></div>}
                    {pruneStep === 'SUCCESS' && <div className="bg-green-50 p-4 rounded-xl text-green-800 text-center font-bold text-sm">清理完成！<button onClick={() => setPruneStep('IDLE')} className="block mx-auto mt-2 text-xs underline">確定</button></div>}
                </div>
            </div>
            <div className="p-4 bg-white border-t border-gray-100 flex justify-end"><button onClick={onClose} className="text-gray-500 font-bold text-sm px-4 py-2 hover:bg-gray-100 rounded-lg">關閉</button></div>
        </div>
      </div>
    </div>
  );
};

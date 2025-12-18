
import React, { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Download, FileSpreadsheet, Users, UserCog, Calendar, FileText, Database, Table, Loader2, Trash2, AlertTriangle, CheckCircle, UserMinus, FileKey, Smartphone } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type PruneStep = 'IDLE' | 'CONFIRM' | 'PRUNING' | 'SUCCESS';
type CleanStep = 'IDLE' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS';

export const DataExportModal: React.FC<Props> = ({ onClose }) => {
  const { students, instructors, classes, fetchArchivedClasses, allClassesHistory, pruneArchivedClasses, cleanupInactiveStudents, formatDateKey, updateAppIcons, appIcon192 } = useApp();
  const [isPreparing, setIsPreparing] = useState(false);
  const [pruneStep, setPruneStep] = useState<PruneStep>('IDLE');
  const [pruneMonths, setPruneMonths] = useState<number>(3); 
  const [pruneStats, setPruneStats] = useState({ deletedDocs: 0, cleanedRecords: 0 });
  const [cleanStep, setCleanStep] = useState<CleanStep>('IDLE');
  const [deletedCount, setDeletedCount] = useState(0);

  // 圖示上傳狀態
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploadingIcon(true);
      
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              // 建立兩個畫布進行裁切與縮放
              const sizes = [192, 512];
              const results: string[] = [];

              sizes.forEach(size => {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  canvas.width = size;
                  canvas.height = size;
                  
                  // 正方形裁切邏輯
                  const minSide = Math.min(img.width, img.height);
                  const sx = (img.width - minSide) / 2;
                  const sy = (img.height - minSide) / 2;
                  
                  ctx?.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
                  results.push(canvas.toDataURL('image/png'));
              });

              updateAppIcons(results[0], results[1]).then(() => {
                  setIsUploadingIcon(false);
                  alert("App 圖示已更新！所有尺寸已自動生成。");
              });
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

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
            // FIX: Explicitly cast studentIds to string[] to resolve TypeScript 'unknown' error on line 91
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
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Smartphone className="text-zen-600" size={24} />系統維護與設定</h2>
                </div>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-6 bg-gray-50">
                {/* App 圖示管理 */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Smartphone size={18} className="text-zen-600" />
                        App 圖示管理 (PWA Icons)
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden shrink-0 relative group">
                            {isUploadingIcon ? (
                                <Loader2 className="animate-spin text-zen-600" />
                            ) : appIcon192 ? (
                                <img src={appIcon192} className="w-full h-full object-cover" />
                            ) : (
                                <Smartphone size={24} className="text-gray-300" />
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-2 leading-relaxed">上傳一張大圖，系統會自動幫您生成 192x192 與 512x512 圖示。</p>
                            <button 
                                onClick={() => iconInputRef.current?.click()}
                                disabled={isUploadingIcon}
                                className="bg-zen-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-zen-700 disabled:opacity-50"
                            >
                                {isUploadingIcon ? "處理中..." : "上傳新圖示"}
                            </button>
                            <input type="file" ref={iconInputRef} className="hidden" accept="image/*" onChange={handleIconUpload} />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">報表與備份</p>
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
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider ml-1">資料清理</p>
                    {pruneStep === 'IDLE' && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                            <h3 className="font-bold text-red-800 text-sm mb-1">刪除過期資料</h3>
                            <p className="text-xs text-red-600/80 mb-3">永久刪除三個月前的舊紀錄以縮減體積。</p>
                            <button onClick={() => setPruneStep('CONFIRM')} className="w-full bg-white border border-red-200 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-colors">執行清理</button>
                        </div>
                    )}
                    {pruneStep === 'CONFIRM' && (
                        <div className="bg-red-100 border border-red-200 p-4 rounded-xl">
                            <h3 className="font-bold text-red-800 text-sm mb-2">確定刪除？</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setPruneStep('IDLE')} className="flex-1 bg-white border border-red-200 text-gray-600 py-2 rounded-lg text-xs font-bold">取消</button>
                                <button onClick={async () => { setPruneStep('PRUNING'); await pruneArchivedClasses(3); setPruneStep('SUCCESS'); }} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold">確定</button>
                            </div>
                        </div>
                    )}
                    {pruneStep === 'PRUNING' && <div className="text-center p-4"><Loader2 className="animate-spin mx-auto text-red-600" /></div>}
                    {pruneStep === 'SUCCESS' && <div className="bg-green-50 p-4 rounded-xl text-green-800 text-center font-bold text-sm">清理完成！<button onClick={() => setPruneStep('IDLE')} className="block mx-auto mt-2 text-xs underline">關閉</button></div>}
                </div>
            </div>
            <div className="p-4 bg-white border-t border-gray-100 flex justify-end"><button onClick={onClose} className="text-gray-500 font-bold text-sm px-4 py-2 hover:bg-gray-100 rounded-lg">關閉</button></div>
        </div>
      </div>
    </div>
  );
};

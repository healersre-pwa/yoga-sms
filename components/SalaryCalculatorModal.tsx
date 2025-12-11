
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Calculator, ChevronDown, ChevronRight, AlertCircle, Download, Loader2, User as UserIcon, UserCog } from 'lucide-react';

interface Props {
  onClose: () => void;
}

interface ClassLog {
    date: string;
    dayName: string;
    time: string;
    type: 'BASE' | 'SUB';
    originalName?: string;
    duration: number;
}

export const SalaryCalculatorModal: React.FC<Props> = ({ onClose }) => {
  const { instructors, allClassesHistory, formatDateKey, classes, fetchArchivedClasses } = useApp();
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  // LOCK TO LAST MONTH STRICTLY
  const [currentDate] = useState(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // FETCH HISTORY ON MOUNT
  useEffect(() => {
      fetchArchivedClasses().then(() => {
          setIsLoadingHistory(false);
      });
  }, []);

  const [rates, setRates] = useState<Record<string, number | string>>({});
  const [expandedInstructor, setExpandedInstructor] = useState<string | null>(null);

  const getRate = (id: string) => {
      if (rates[id] !== undefined) {
          const val = rates[id];
          return typeof val === 'string' ? (val === '' ? 0 : parseFloat(val)) : val;
      }
      const inst = instructors.find(i => i.id === id);
      return inst?.defaultRate ?? 800;
  };

  const handleRateChange = (id: string, val: string) => {
      if (val === '') {
          setRates(prev => ({ ...prev, [id]: '' }));
          return;
      }
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
          setRates(prev => ({ ...prev, [id]: num }));
      }
  };

  const stats = useMemo(() => {
    const instructorStats: Record<string, { 
        id: string, 
        name: string, 
        avatar: string, 
        totalMinutes: number, 
        classCount: number,
        logs: ClassLog[]
    }> = {};

    instructors.forEach(inst => {
        instructorStats[inst.id] = { 
            id: inst.id, 
            name: inst.name, 
            avatar: inst.imageUrl, 
            totalMinutes: 0, 
            classCount: 0,
            logs: []
        };
    });

    const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay() || 7;
        const dateStr = formatDateKey(d);
        
        let daysClasses = allClassesHistory.filter(c => {
            if (Number(c.dayOfWeek) !== dayOfWeek) return false;
            if (c.createdAt && c.createdAt > dateStr) return false;
            if (c.archived && c.archivedAt && c.archivedAt < dateStr) return false;
            return true;
        });

        const activeClassesForDay = classes.filter(c => Number(c.dayOfWeek) === dayOfWeek);
        const activeClassMap = new Map();
        activeClassesForDay.forEach(c => activeClassMap.set(c.startTimeStr, c));

        daysClasses.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const processedSlots = new Set<string>();

        daysClasses.forEach(cls => {
            const timeSlot = cls.startTimeStr;
            if (processedSlots.has(timeSlot)) return; 
            processedSlots.add(timeSlot);

            let teacherId = cls.instructorId; 
            let type: 'BASE' | 'SUB' = 'BASE';
            let originalName = '';

            const activeVersion = activeClassMap.get(timeSlot);
            const sourceClass = activeVersion || cls; 

            if (sourceClass.substitutions && sourceClass.substitutions[dateStr]) {
                teacherId = sourceClass.substitutions[dateStr];
                type = 'SUB';
                const originalInst = instructors.find(i => i.id === cls.instructorId);
                originalName = originalInst?.name || 'Unknown';
            }

            if (instructorStats[teacherId]) {
                const duration = Number(cls.durationMinutes) || 0;
                if (duration > 0) {
                    instructorStats[teacherId].totalMinutes += duration;
                    instructorStats[teacherId].classCount += 1;
                    instructorStats[teacherId].logs.push({
                        date: dateStr,
                        dayName: dayNames[dayOfWeek === 7 ? 0 : dayOfWeek],
                        time: `${cls.startTimeStr} (${duration}m)`,
                        type,
                        originalName,
                        duration
                    });
                }
            }
        });
    }
    
    Object.values(instructorStats).forEach(s => {
        s.logs.sort((a, b) => a.date.localeCompare(b.date));
    });

    return Object.values(instructorStats).filter(s => s.totalMinutes > 0).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [allClassesHistory, classes, instructors, formatDateKey]);

  const totalPayout = stats.reduce((sum, stat) => sum + Math.round((stat.totalMinutes / 60) * getRate(stat.id)), 0);

  const handleExportDetails = () => {
      const headers = ['講師姓名', '日期', '星期', '時間', '課程類型', '代課原師', '時長(分)', '時薪', '單堂薪資'];
      const rows: string[][] = [];

      stats.forEach(stat => {
          const currentRate = getRate(stat.id);
          stat.logs.forEach(log => {
              const salary = Math.round((log.duration / 60) * currentRate);
              const cleanTime = log.time.split(' ')[0];

              rows.push([
                  stat.name,
                  log.date,
                  log.dayName,
                  cleanTime,
                  log.type === 'SUB' ? '代課' : '正課',
                  log.originalName || '-',
                  log.duration.toString(),
                  currentRate.toString(),
                  salary.toString()
              ]);
          });
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = monthStart.toISOString().slice(0, 7); 
      link.setAttribute('download', `Salary_Details_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header Section */}
        <div className="bg-white p-5 border-b border-gray-100 flex flex-wrap justify-between items-center sticky top-0 z-20 shadow-sm gap-y-4">
            <div className="flex flex-col gap-1 mr-auto">
                <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-xl font-bold text-gray-800 leading-tight flex items-center gap-2">
                        <Calculator className="text-zen-600 shrink-0" size={20} />
                        薪資計算中心
                    </h2>
                    <span className="text-sm font-normal text-gray-500 whitespace-nowrap">
                        (上個月)
                    </span>
                </div>
                <p className="text-xs text-gray-500 font-mono">
                    區間：{monthStart.toLocaleDateString()} - {monthEnd.toLocaleDateString()}
                </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 ml-auto">
                <button 
                    onClick={handleExportDetails}
                    className="flex items-center justify-center gap-1.5 bg-zen-50 text-zen-700 hover:bg-zen-100 border border-zen-200 px-3 py-2 rounded-lg text-sm font-bold transition-colors h-10 shadow-sm whitespace-nowrap"
                >
                    <Download size={16} />
                    <span>匯出明細</span>
                </button>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors h-10 w-10 flex items-center justify-center">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto bg-white p-0 relative">
            {isLoadingHistory && (
                <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
                    <div className="flex flex-col items-center text-zen-600">
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <span className="text-sm font-bold">正在讀取歷史資料...</span>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-gray-50 sticky top-0 z-10 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 shadow-sm">
                        <tr>
                            <th className="py-3 px-2 w-10 text-center align-middle"></th>
                            <th className="py-3 px-3 align-middle text-left">講師</th>
                            <th className="py-3 px-2 text-center text-purple-600 align-middle whitespace-nowrap">總堂數</th>
                            <th className="py-3 px-2 text-center text-blue-600 align-middle whitespace-nowrap">總時數</th>
                            <th className="py-3 px-2 w-[110px] text-center align-middle whitespace-nowrap">時薪 ($)</th>
                            <th className="py-3 px-3 pr-6 text-right text-green-600 align-middle whitespace-nowrap">小計</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                        {stats.map((stat) => {
                            const hours = Math.floor(stat.totalMinutes / 60);
                            const mins = stat.totalMinutes % 60;
                            const rate = getRate(stat.id);
                            const salary = Math.round((stat.totalMinutes / 60) * rate);
                            const isExpanded = expandedInstructor === stat.id;
                            
                            const instructorDefaultRate = instructors.find(i => i.id === stat.id)?.defaultRate ?? 800;
                            const storedRate = rates[stat.id];
                            const inputValue = storedRate !== undefined ? storedRate : instructorDefaultRate;

                            return (
                                <React.Fragment key={stat.id}>
                                    <tr 
                                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}
                                        onClick={() => setExpandedInstructor(isExpanded ? null : stat.id)}
                                    >
                                        <td className="py-4 px-2 text-center text-gray-400 align-middle">
                                            {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                        </td>
                                        <td className="py-4 px-3 align-middle">
                                            <div className="flex items-center gap-3">
                                                {stat.avatar ? (
                                                    <img src={stat.avatar} className="w-10 h-10 rounded-full object-cover bg-gray-100 border border-gray-200 shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 border border-gray-200 shrink-0">
                                                        <UserCog size={16} />
                                                    </div>
                                                )}
                                                <span className="font-bold text-sm text-gray-900">{stat.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 text-center align-middle">
                                            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full whitespace-nowrap border border-purple-100">
                                                {stat.classCount} 堂
                                            </span>
                                        </td>
                                        <td className="py-4 px-2 text-center align-middle">
                                            <span className="text-sm font-bold text-blue-600 whitespace-nowrap">
                                                {hours}<span className="text-xs text-blue-400 font-normal">h</span>
                                                {mins > 0 && <span className="text-xs text-gray-400 ml-0.5 font-normal">{mins}m</span>}
                                            </span>
                                        </td>
                                        <td className="py-4 px-2 align-middle" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-center">
                                                <input 
                                                    type="number"
                                                    value={inputValue}
                                                    onChange={(e) => handleRateChange(stat.id, e.target.value)}
                                                    className="w-20 text-sm font-bold text-gray-900 border border-gray-300 rounded px-2 py-1 text-center focus:ring-2 focus:ring-zen-500 outline-none shadow-sm bg-white"
                                                    style={{ colorScheme: 'light' }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </td>
                                        <td className="py-4 px-3 pr-6 text-right align-middle">
                                            <span className="font-bold text-green-600 text-lg tracking-tight">
                                                ${salary.toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={6} className="bg-gray-50/50 p-0 border-b border-gray-100">
                                                <div className="px-4 py-3 sm:px-14 sm:py-4">
                                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                        <AlertCircle size={12}/> {stat.name} 的課堂明細
                                                    </h4>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {stat.logs.map((log, idx) => {
                                                            return (
                                                                <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-gray-500 bg-gray-50 px-1.5 rounded">{log.date}</span>
                                                                        <span className="font-bold text-gray-700 w-8">{log.dayName}</span>
                                                                        <span className="text-gray-600">{log.time}</span>
                                                                    </div>
                                                                    <div>
                                                                        {log.type === 'SUB' ? (
                                                                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border border-amber-200">
                                                                                代 ({log.originalName})
                                                                            </span>
                                                                        ) : (
                                                                            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] whitespace-nowrap border border-green-100">正課</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {stats.length === 0 && !isLoadingHistory && (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-gray-400 text-sm italic">
                                    上個月無課程紀錄
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
            <span className="text-sm font-bold text-gray-500">本月總支出預估</span>
            <span className="text-3xl font-black text-zen-600 tracking-tight">
                ${totalPayout.toLocaleString()}
            </span>
        </div>
      </div>
    </div>
  );
};

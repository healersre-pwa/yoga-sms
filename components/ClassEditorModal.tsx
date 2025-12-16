
import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Save, Trash2, MapPin, Users, BarChart, Clock, Calendar, Loader2, Coins } from 'lucide-react';
import { SMSNotificationModal } from './SMSNotificationModal';

interface Props {
  classId?: string | null;
  initialDayOfWeek?: number; 
  onClose: () => void;
}

// Helper for input groups
const InputGroup = ({ label, icon: Icon, children }: { label: string, icon?: React.ElementType, children?: React.ReactNode }) => (
  <div>
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
      <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-zen-500 bg-white overflow-hidden transition-all hover:border-gray-400">
          {Icon && (
              <div className="pl-3 flex items-center justify-center text-gray-400 select-none">
                  <Icon size={16} />
              </div>
          )}
          <div className="flex-1 min-w-0">
              {children}
          </div>
      </div>
  </div>
);

export const ClassEditorModal: React.FC<Props> = ({ classId, initialDayOfWeek, onClose }) => {
  const { classes, addClass, updateClass, deleteClass, deleteClassWithRefund, instructors, checkInstructorConflict, students, getNextClassDate, formatDateKey } = useApp();
  
  const existingClass = classId ? classes.find(c => c.id === classId) : undefined;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dayOfWeek: 1, 
    startTimeStr: '10:00',
    durationMinutes: 60,
    instructorId: '',
    capacity: 20,
    location: 'A 教室',
    difficulty: 'Beginner' as 'Beginner' | 'Intermediate' | 'Advanced',
    pointsCost: 1
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // SMS Modal State
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [cancellationMessage, setCancellationMessage] = useState('');
  const [affectedStudents, setAffectedStudents] = useState<any[]>([]);

  useEffect(() => {
    if (existingClass) {
      setFormData({
        title: existingClass.title,
        description: existingClass.description || '',
        dayOfWeek: existingClass.dayOfWeek,
        startTimeStr: existingClass.startTimeStr,
        durationMinutes: existingClass.durationMinutes,
        instructorId: existingClass.instructorId,
        capacity: existingClass.capacity,
        location: existingClass.location,
        difficulty: existingClass.difficulty,
        pointsCost: existingClass.pointsCost ?? 1
      });
    } else {
       setFormData({
            title: '',
            description: '',
            dayOfWeek: initialDayOfWeek || 1,
            startTimeStr: '10:00',
            durationMinutes: 60,
            instructorId: instructors[0]?.id || '',
            capacity: 20,
            location: 'A 教室',
            difficulty: 'Beginner',
            pointsCost: 1
       });
    }
  }, [existingClass, initialDayOfWeek, instructors]); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate Instructor Schedule
    const conflictResult = checkInstructorConflict(
        formData.instructorId,
        formData.dayOfWeek,
        formData.startTimeStr,
        formData.durationMinutes,
        existingClass?.id // Exclude self if editing
    );

    if (conflictResult.conflict) {
        alert(`❌ 排課失敗：師資衝突！\n\n老師在該時段已有課程：\n「${conflictResult.className}」 (${conflictResult.time})\n\n同一位老師不能同時上兩堂課。`);
        return;
    }

    setIsSubmitting(true);
    
    const submitData = {
        ...formData,
        isSubstitute: false, 
        originalInstructorId: null
    };

    try {
        if (existingClass) {
            await updateClass(existingClass.id, submitData);
        } else {
            await addClass(submitData);
        }
        setTimeout(onClose, 50);
    } catch (e) {
        console.error(e);
        setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (existingClass) {
      setIsSubmitting(true);
      
      // 1. Identify affected students (Future bookings)
      const bookings = (existingClass.bookings || {}) as Record<string, string[]>;
      const todayStr = formatDateKey(new Date());
      
      const futureStudentIds = new Set<string>();
      Object.entries(bookings).forEach(([date, ids]) => {
          if (date >= todayStr) {
              ids.forEach(id => futureStudentIds.add(id));
          }
      });
      
      const enrolled = students.filter(s => futureStudentIds.has(s.id));
      
      if (enrolled.length > 0) {
        // Has enrolled students: Refund & Notify
        try {
            if (deleteClassWithRefund) {
                await deleteClassWithRefund(existingClass.id);
            } else {
                // Fallback if context not updated yet
                await deleteClass(existingClass.id);
            }
            
            setAffectedStudents(enrolled);
            
            // Generate message
            const dayMap = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日'];
            const dayStr = dayMap[existingClass.dayOfWeek];
            
            const msg = `同學好，很遺憾通知您，每週${dayStr} ${existingClass.startTimeStr} 的「${existingClass.title}」固定課程將停止上課。系統已自動退還相關預約點數。造成不便敬請見諒。`;
            setCancellationMessage(msg);
            setShowSMSModal(true);
        } catch (e) {
            alert("刪除失敗，請稍後再試");
            setIsSubmitting(false);
        }
      } else {
        // No students: Just delete
        await deleteClass(existingClass.id);
        setTimeout(onClose, 50);
      }
    }
  };

  // Time Select Logic
  const handleTimeChange = (type: 'hour' | 'minute', val: string) => {
      const [h, m] = formData.startTimeStr.split(':');
      let newH = h;
      let newM = m;
      if (type === 'hour') newH = val;
      if (type === 'minute') newM = val;
      setFormData({ ...formData, startTimeStr: `${newH}:${newM}` });
  };

  const currentHour = formData.startTimeStr.split(':')[0];
  const currentMinute = formData.startTimeStr.split(':')[1];

  if (showSMSModal) {
      return (
          <SMSNotificationModal 
              isOpen={true} 
              onClose={onClose}
              students={affectedStudents}
              defaultMessage={cancellationMessage}
              title="課程取消通知"
          />
      );
  }

  return (
    // Wrapper: Fixed overlay with scrolling
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm overflow-y-auto">
      {/* Container: Flex to center, min-h-full to allow scrolling if content is tall */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Modal Card */}
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative flex flex-col">
          
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl sticky top-0 z-10">
            <h2 className="text-xl font-bold text-gray-800">
              {existingClass ? '編輯每週課程' : '新增每週課程'}
            </h2>
            <button onClick={onClose} disabled={isSubmitting} className="text-gray-400 hover:text-gray-600 disabled:opacity-50 p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">課程名稱</label>
              <input 
                required
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zen-500 outline-none text-gray-900 bg-white"
                placeholder="例如：晨間瑜伽"
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">課程簡介</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zen-500 outline-none text-gray-900 bg-white min-h-[60px]"
                placeholder="輸入課程簡介..."
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="星期" icon={Calendar}>
                  <select
                    required
                    value={formData.dayOfWeek}
                    onChange={e => setFormData({...formData, dayOfWeek: parseInt(e.target.value, 10)})}
                    className="w-full p-2.5 bg-transparent outline-none border-none text-gray-900 cursor-pointer [color-scheme:light]"
                    disabled={isSubmitting}
                  >
                      <option value={1}>週一</option>
                      <option value={2}>週二</option>
                      <option value={3}>週三</option>
                      <option value={4}>週四</option>
                      <option value={5}>週五</option>
                      <option value={6}>週六</option>
                      <option value={7}>週日</option>
                  </select>
              </InputGroup>
              
              <InputGroup label="時間 (24小時制)" icon={Clock}>
                  <div className="flex w-full">
                      <select 
                          value={currentHour} 
                          onChange={(e) => handleTimeChange('hour', e.target.value)}
                          className="flex-1 p-2.5 bg-transparent outline-none border-none text-gray-900 cursor-pointer text-center appearance-none hover:bg-gray-50"
                          disabled={isSubmitting}
                      >
                          {Array.from({ length: 24 }).map((_, i) => (
                              <option key={i} value={String(i).padStart(2, '0')}>
                                  {String(i).padStart(2, '0')}
                              </option>
                          ))}
                      </select>
                      <span className="flex items-center text-gray-400 font-bold">:</span>
                      <select 
                          value={currentMinute} 
                          onChange={(e) => handleTimeChange('minute', e.target.value)}
                          className="flex-1 p-2.5 bg-transparent outline-none border-none text-gray-900 cursor-pointer text-center appearance-none hover:bg-gray-50"
                          disabled={isSubmitting}
                      >
                          {Array.from({ length: 12 }).map((_, i) => (
                              <option key={i * 5} value={String(i * 5).padStart(2, '0')}>
                                  {String(i * 5).padStart(2, '0')}
                              </option>
                          ))}
                      </select>
                  </div>
              </InputGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">時長 (分鐘)</label>
                <input 
                  required
                  type="number" 
                  min="15"
                  step="5"
                  value={formData.durationMinutes}
                  onChange={e => setFormData({...formData, durationMinutes: parseInt(e.target.value)})}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zen-500 outline-none text-gray-900 bg-white"
                  disabled={isSubmitting}
                />
              </div>
              <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">授課老師</label>
              <select 
                  value={formData.instructorId}
                  onChange={e => setFormData({...formData, instructorId: e.target.value})}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zen-500 outline-none bg-white text-gray-900 cursor-pointer"
                  disabled={isSubmitting}
              >
                  {instructors.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
              </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="人數限制" icon={Users}>
                    <input 
                      required
                      type="number" 
                      min="1"
                      value={formData.capacity}
                      onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})}
                      className="w-full p-2.5 bg-transparent outline-none border-none text-gray-900"
                      disabled={isSubmitting}
                    />
              </InputGroup>
              <InputGroup label="扣點數 (Credits)" icon={Coins}>
                    <input 
                      required
                      type="number" 
                      min="0"
                      step="0.5"
                      value={formData.pointsCost}
                      onChange={e => setFormData({...formData, pointsCost: parseFloat(e.target.value)})}
                      className="w-full p-2.5 bg-transparent outline-none border-none text-gray-900"
                      disabled={isSubmitting}
                    />
              </InputGroup>
            </div>

            <InputGroup label="地點" icon={MapPin}>
                  <select 
                  required
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full p-2.5 bg-transparent outline-none border-none text-gray-900 cursor-pointer"
                  disabled={isSubmitting}
                  >
                  <option value="A 教室">A 教室</option>
                  <option value="B 教室">B 教室</option>
                  <option value="C 教室">C 教室</option>
                  <option value="D 教室">D 教室</option>
                  <option value="E 教室">E 教室</option>
                  </select>
            </InputGroup>

            <InputGroup label="難度" icon={BarChart}>
                  <select 
                      value={formData.difficulty}
                      onChange={e => setFormData({...formData, difficulty: e.target.value as any})}
                      className="w-full p-2.5 bg-transparent outline-none border-none text-gray-900 cursor-pointer"
                      disabled={isSubmitting}
                  >
                      <option value="Beginner">初學者</option>
                      <option value="Intermediate">中級</option>
                      <option value="Advanced">進階</option>
                  </select>
            </InputGroup>

            <div className="pt-4 flex items-center justify-between">
              {existingClass ? (
                showDeleteConfirm ? (
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isSubmitting}
                        className="px-3 py-2 rounded-lg text-gray-600 bg-gray-100 text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                          取消
                      </button>
                      <button 
                        type="button"
                        onClick={handleDelete}
                        disabled={isSubmitting}
                        className="px-3 py-2 rounded-lg text-white bg-red-600 text-sm font-medium hover:bg-red-700 flex items-center gap-1 shadow-md transition-colors"
                      >
                          {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}
                          確認刪除
                      </button>
                    </div>
                ) : (
                    <button 
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isSubmitting}
                      className="text-red-500 hover:bg-red-50 px-3 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                      <Trash2 size={18} />
                      刪除課程
                    </button>
                )
              ) : (
                  <div></div> // Spacer
              )}
              
              <button 
                type="submit"
                disabled={isSubmitting}
                className="bg-zen-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-zen-700 shadow-lg shadow-zen-200 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />}
                {existingClass ? '儲存變更' : '建立課程'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

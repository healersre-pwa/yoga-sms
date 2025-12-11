
import React, { useState } from 'react';
import { User } from '../types';
import { X, MessageSquare, Copy, Check, Phone, PhoneOff, Send } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  students: User[];
  defaultMessage: string;
  title: string;
}

export const SMSNotificationModal: React.FC<Props> = ({ isOpen, onClose, students, defaultMessage, title }) => {
  const [message, setMessage] = useState(defaultMessage);
  const [copiedType, setCopiedType] = useState<'MSG' | 'PHONES' | null>(null);

  if (!isOpen) return null;

  // Filter students with valid phones
  const validStudents = students.filter(s => s.phoneNumber && s.phoneNumber.length > 0);
  const missingPhoneCount = students.length - validStudents.length;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    setCopiedType('MSG');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyPhones = () => {
    const phones = validStudents.map(s => s.phoneNumber).join(',');
    navigator.clipboard.writeText(phones);
    setCopiedType('PHONES');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const sendIndividualSMS = (phone: string) => {
    // Detect iOS for specific SMS delimiter
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    const link = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
    window.location.href = link;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-zen-600 p-5 flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare size={24} />
              {title}
            </h2>
            <p className="text-zen-100 text-xs mt-1">
              請確認訊息內容並發送通知給 {students.length} 位學生
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          
          {/* Message Editor */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between">
                <span>通知內容</span>
                <button 
                    onClick={handleCopyMessage}
                    className="text-zen-600 hover:text-zen-800 flex items-center gap-1 transition-colors"
                >
                    {copiedType === 'MSG' ? <Check size={12}/> : <Copy size={12}/>}
                    {copiedType === 'MSG' ? '已複製' : '複製內容'}
                </button>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-zen-500 focus:outline-none min-h-[140px] text-base font-medium leading-relaxed text-gray-900 shadow-sm bg-white resize-none"
            />
          </div>

          {/* Student List */}
          <div>
            <div className="flex justify-between items-end mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase">
                    發送對象 ({validStudents.length})
                </label>
                {validStudents.length > 0 && (
                    <button 
                        onClick={handleCopyPhones}
                        className="text-xs bg-white border border-gray-300 px-2 py-1 rounded text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                    >
                        {copiedType === 'PHONES' ? <Check size={12}/> : <Copy size={12}/>}
                        複製所有電話
                    </button>
                )}
            </div>

            <div className="space-y-2">
                {validStudents.map(student => (
                    <div key={student.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zen-50 flex items-center justify-center text-zen-600 font-bold text-xs">
                                {student.name.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-800">{student.name}</p>
                                <p className="text-xs text-gray-500 font-mono">{student.phoneNumber}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => sendIndividualSMS(student.phoneNumber!)}
                            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg flex items-center gap-1 text-xs font-bold transition-colors shadow-sm active:scale-95"
                        >
                            <Send size={14} /> 傳送
                        </button>
                    </div>
                ))}

                {/* Students without phone */}
                {students.filter(s => !s.phoneNumber).map(student => (
                    <div key={student.id} className="bg-gray-100 p-3 rounded-xl border border-gray-200 flex items-center justify-between opacity-60">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">
                                {student.name.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-600">{student.name}</p>
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <PhoneOff size={10} /> 無電話號碼
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {validStudents.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                    沒有可發送的聯絡資訊
                </div>
            )}
          </div>

        </div>

        <div className="p-4 bg-white border-t border-gray-100 text-center">
            <button 
                onClick={onClose}
                className="text-gray-500 font-bold text-sm hover:bg-gray-100 px-6 py-2 rounded-full transition-colors"
            >
                完成
            </button>
        </div>

      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, CreditCard, Send, CheckCircle, Copy, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const TopUpModal: React.FC<Props> = ({ onClose }) => {
  const { notifyAdminPayment, currentUser } = useApp();
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [lastFiveDigits, setLastFiveDigits] = useState('');

  const BANK_INFO = {
      bankCode: "822",
      bankName: "中國信託",
      account: "1234-5678-9012" // 範例帳號
  };

  const handleNotify = async () => {
      // 只有在有輸入的情況下才檢查長度是否為 5
      if (lastFiveDigits.length > 0 && lastFiveDigits.length !== 5) {
          alert("若要提供末五碼，請輸入完整的 5 位數字");
          return;
      }

      setIsSending(true);
      const success = await notifyAdminPayment(lastFiveDigits || "未提供");
      setIsSending(false);
      
      if (success) {
          setIsSuccess(true);
      } else {
          alert("發送失敗，請稍後再試或直接聯繫管理員。");
      }
  };

  const copyToClipboard = (text: string, type: string) => {
      navigator.clipboard.writeText(text);
      setCopyStatus(type);
      setTimeout(() => setCopyStatus(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-zen-600 p-5 flex justify-between items-center text-white shrink-0">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <CreditCard size={24} />
                購課方案
            </h2>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto bg-gray-50 flex-1 space-y-6">
            
            {/* 1. Pricing Plans */}
            <div>
                <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                   💰 消費制度介紹
                </h3>
                <div className="grid grid-cols-1 gap-3">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-800">單堂體驗</span>
                            <span className="text-zen-600 font-bold">$500</span>
                        </div>
                        <p className="text-xs text-gray-500">適合首次體驗或臨時上課的同學 (1點)</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-zen-200 shadow-sm ring-1 ring-zen-100">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-800">10 堂套票</span>
                            <span className="text-zen-600 font-bold">$4,500</span>
                        </div>
                        <p className="text-xs text-gray-500">平均每堂 $450，使用期限 3 個月 (10點)</p>
                    </div>
                    <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-4 rounded-xl shadow-md text-white">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-white">課程自由</span>
                            <span className="text-yellow-400 font-bold">$3,800 / 月</span>
                        </div>
                        <p className="text-xs text-gray-300">30天內不限堂數，適合每週上課 3 次以上的精進同學</p>
                    </div>
                </div>
            </div>

            {/* 2. Bank Info */}
            <div>
                <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                   🏦 匯款資訊
                </h3>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                     <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                         <span className="text-gray-500 text-sm">銀行代碼</span>
                         <div className="flex items-center gap-2">
                             <span className="font-mono font-bold text-lg">{BANK_INFO.bankCode}</span>
                             <span className="text-sm font-bold text-gray-800">({BANK_INFO.bankName})</span>
                         </div>
                     </div>
                     <div className="flex justify-between items-center pt-1">
                         <span className="text-gray-500 text-sm">匯款帳號</span>
                         <div className="flex items-center gap-2">
                             <span className="font-mono font-bold text-lg text-gray-800 tracking-wide">{BANK_INFO.account}</span>
                             <button 
                                onClick={() => copyToClipboard(BANK_INFO.account, 'ACC')}
                                className="text-zen-600 hover:bg-zen-50 p-1.5 rounded transition-colors"
                                title="複製帳號"
                             >
                                 {copyStatus === 'ACC' ? <CheckCircle size={16}/> : <Copy size={16}/>}
                             </button>
                         </div>
                     </div>
                     
                     <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-xs text-yellow-800 leading-relaxed">
                        ⚠️ 匯款時請備註您的「姓名」或截圖留存，以利對帳。
                     </div>
                </div>
            </div>

            {/* 3. Action */}
            <div className="pt-2">
                {isSuccess ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center animate-in zoom-in">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircle size={24} />
                        </div>
                        <h3 className="font-bold text-green-800 text-lg mb-1">通知已發送！</h3>
                        <p className="text-green-700 text-sm mb-4">管理員將盡快確認款項並為您儲值。</p>
                        <button 
                            onClick={onClose}
                            className="text-sm font-bold text-green-700 hover:underline"
                        >
                            關閉視窗
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                您的帳號末五碼（選填）
                            </label>
                            <input 
                                type="text"
                                maxLength={5}
                                value={lastFiveDigits}
                                onChange={(e) => setLastFiveDigits(e.target.value.replace(/\D/g, ''))}
                                placeholder="12345"
                                className="w-full p-3 border border-gray-300 rounded-xl text-center text-lg font-bold tracking-widest focus:ring-2 focus:ring-zen-500 outline-none"
                            />
                        </div>

                        <button 
                            onClick={handleNotify}
                            disabled={isSending}
                            className="w-full bg-zen-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-zen-200 hover:bg-zen-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    發送中...
                                </>
                            ) : (
                                <>
                                    <Send size={20} />
                                    我已完成匯款，通知管理員
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};

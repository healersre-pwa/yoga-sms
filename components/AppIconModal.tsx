
import React, { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Smartphone, Loader2, Upload, CheckCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const AppIconModal: React.FC<Props> = ({ onClose }) => {
  const { updateAppIcons, appIcon192 } = useApp();
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 限制 5MB 以內
      if (file.size > 5 * 1024 * 1024) {
          alert("圖片檔案過大，請選擇 5MB 以下的圖片。");
          return;
      }

      setIsUploading(true);
      setShowSuccess(false);
      
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              // 準備生成 192x192 和 512x512 兩種尺寸
              const sizes = [192, 512];
              const results: string[] = [];

              sizes.forEach(size => {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  canvas.width = size;
                  canvas.height = size;
                  
                  // 自動正方形裁切邏輯 (取中間)
                  const minSide = Math.min(img.width, img.height);
                  const sx = (img.width - minSide) / 2;
                  const sy = (img.height - minSide) / 2;
                  
                  if (ctx) {
                      // 填寫背景色（避免透明圖層在某些設備顯示異常）
                      ctx.fillStyle = "#FFFFFF";
                      ctx.fillRect(0, 0, size, size);
                      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
                  }
                  results.push(canvas.toDataURL('image/png'));
              });

              // 呼叫 Context 更新資料庫
              updateAppIcons(results[0], results[1]).then(() => {
                  setIsUploading(false);
                  setShowSuccess(true);
                  setTimeout(() => {
                      setShowSuccess(false);
                      onClose();
                  }, 1500);
              });
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 text-center">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <Smartphone className="text-zen-600" />
                      更換 App 下載圖示
                  </h2>
                  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                      <X size={20} />
                  </button>
              </div>

              <div className="mb-8">
                  <div className="w-32 h-32 mx-auto rounded-[2rem] bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center relative group overflow-hidden shadow-inner">
                      {isUploading ? (
                          <div className="flex flex-col items-center">
                              <Loader2 className="animate-spin text-zen-600 mb-2" size={32} />
                              <span className="text-[10px] text-gray-400 font-bold uppercase">裁切中</span>
                          </div>
                      ) : showSuccess ? (
                          <div className="flex flex-col items-center text-green-500 animate-in fade-in">
                              <CheckCircle size={40} />
                              <span className="text-xs font-bold mt-2">更新成功</span>
                          </div>
                      ) : appIcon192 ? (
                          <img src={appIcon192} className="w-full h-full object-cover" alt="Current Icon" />
                      ) : (
                          <Smartphone size={48} className="text-gray-200" />
                      )}
                  </div>
              </div>

              <div className="space-y-4">
                  <p className="text-sm text-gray-500 leading-relaxed px-4">
                      只需上傳一次，系統會自動為您生成所有設備所需的下載圖示規格。
                  </p>
                  
                  <button 
                      onClick={() => iconInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full bg-zen-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-zen-200 hover:bg-zen-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                      {isUploading ? "處理中..." : (
                          <>
                              <Upload size={20} />
                              選擇圖片並上傳
                          </>
                      )}
                  </button>
                  <input ref={iconInputRef} type="file" className="hidden" accept="image/*" onChange={handleIconUpload} />
                  
                  <button 
                      onClick={onClose}
                      className="w-full py-2 text-sm text-gray-400 font-bold hover:text-gray-600 transition-colors"
                  >
                      取消
                  </button>
              </div>
          </div>

          <div className="bg-gray-50 p-4 text-[10px] text-gray-400 text-center border-t border-gray-100">
              提示：建議上傳解析度 1024x1024 以上的正方形圖片
          </div>
      </div>
    </div>
  );
};

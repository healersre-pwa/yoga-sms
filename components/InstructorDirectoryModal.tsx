
import React, { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { Instructor } from '../types';
import { X, Search, UserPlus, Trash2, UserCog, Save, Camera, Loader2, DollarSign, ChevronLeft, Phone } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const InstructorDirectoryModal: React.FC<Props> = ({ onClose }) => {
  const { instructors, addInstructor, updateInstructor, deleteInstructor } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Image Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Instructor>>({
    name: '',
    bio: '',
    phoneNumber: '',
    defaultRate: 800,
    imageUrl: ''
  });

  const filteredInstructors = instructors.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.phoneNumber?.includes(searchTerm)
  );

  const selectedInst = instructors.find(i => i.id === selectedInstId);
  const isEditing = selectedInstId || isCreating;

  const handleSelect = (inst: Instructor) => {
    setSelectedInstId(inst.id);
    setIsCreating(false);
    setShowDeleteConfirm(false);
    setFormData({
        name: inst.name,
        bio: inst.bio,
        phoneNumber: inst.phoneNumber || '',
        defaultRate: inst.defaultRate || 800,
        imageUrl: inst.imageUrl
    });
  };

  const handleBackToList = () => {
      setSelectedInstId(null);
      setIsCreating(false);
  };

  const handleCreateNew = () => {
    setSelectedInstId(null);
    setIsCreating(true);
    setShowDeleteConfirm(false);
    setFormData({
        name: '',
        bio: '',
        phoneNumber: '',
        defaultRate: 800,
        imageUrl: ''
    });
  };

  const handleSave = () => {
    if (!formData.name) return;

    if (isCreating) {
        const newId = addInstructor(formData);
        setSelectedInstId(newId);
        setIsCreating(false);
    } else if (selectedInstId) {
        updateInstructor(selectedInstId, formData);
    }
  };

  const handleDelete = () => {
    if (selectedInstId) {
        deleteInstructor(selectedInstId);
        handleBackToList();
        setFormData({ name: '', bio: '', phoneNumber: '', defaultRate: 800, imageUrl: '' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
        alert("圖片大小請小於 2MB");
        return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            
            canvas.width = width;
            canvas.height = height;
            ctx?.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setFormData(prev => ({ ...prev, imageUrl: dataUrl }));
            setIsUploading(false);
            
            if (selectedInstId) {
                updateInstructor(selectedInstId, { imageUrl: dataUrl });
            }
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-100 sm:bg-black/50 sm:backdrop-blur-sm sm:p-4">
      <div className="bg-white w-full h-full sm:rounded-2xl sm:shadow-2xl sm:max-w-5xl sm:h-[85vh] flex overflow-hidden relative">
        
        {/* LIST VIEW */}
        <div className={`w-full md:w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col ${isEditing ? 'hidden md:flex' : 'flex h-full'}`}>
            <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <UserCog size={24} className="text-zen-600"/>
                    師資管理
                </h2>
                <button onClick={onClose} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                    <X size={28} />
                </button>
            </div>
            
            <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="搜尋老師 (姓名/電話)..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zen-500 text-gray-900 bg-white"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 pb-20">
                <button 
                    onClick={handleCreateNew}
                    className="w-full flex items-center gap-4 p-4 rounded-xl text-left text-zen-700 bg-zen-50 hover:bg-zen-100 border border-zen-200 transition-colors mb-2"
                >
                    <div className="w-10 h-10 rounded-full bg-zen-200 flex items-center justify-center">
                        <UserPlus size={20} />
                    </div>
                    <span className="font-bold text-base">新增老師</span>
                </button>

                {filteredInstructors.map(inst => (
                    <button
                        key={inst.id}
                        onClick={() => handleSelect(inst)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors ${
                            selectedInstId === inst.id 
                            ? 'bg-white shadow-md ring-1 ring-gray-200 z-10 border-l-4 border-l-zen-600' 
                            : 'hover:bg-gray-100 bg-white border border-gray-100'
                        }`}
                    >
                        {inst.imageUrl ? (
                            <img src={inst.imageUrl} alt={inst.name} className="w-12 h-12 rounded-full bg-gray-200 object-cover" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                                <UserCog size={20} />
                            </div>
                        )}
                        <div className="overflow-hidden flex-1">
                            <p className="font-bold text-lg text-gray-900 truncate">{inst.name}</p>
                            <div className="flex justify-between items-center text-sm text-gray-500">
                                <span className="truncate">${inst.defaultRate}/hr</span>
                                {inst.phoneNumber && <span className="text-xs font-mono">{inst.phoneNumber}</span>}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* DETAIL VIEW */}
        <div className={`flex-1 bg-white flex flex-col w-full h-full ${isEditing ? 'flex fixed inset-0 sm:static z-20' : 'hidden md:flex'}`}>
            
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white shadow-sm sm:shadow-none z-30 sticky top-0">
                <button 
                    onClick={handleBackToList}
                    className="md:hidden flex items-center gap-1 text-gray-600 font-medium px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                    <ChevronLeft size={20} />
                    返回列表
                </button>
                <div className="flex-1"></div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100">
                    <X size={28} />
                </button>
            </div>

            {(selectedInstId || isCreating) ? (
                <div className="flex-1 overflow-y-auto px-6 pb-32 sm:px-12 sm:pb-12 bg-white">
                    <div className="flex items-center gap-6 mb-8 mt-6">
                         <div 
                             className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden relative group cursor-pointer border-4 border-white shadow-sm shrink-0"
                             onClick={() => fileInputRef.current?.click()}
                         >
                             {isUploading ? (
                                 <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                                     <Loader2 className="animate-spin text-white" size={32} />
                                 </div>
                             ) : null}

                             {formData.imageUrl ? (
                                <img src={formData.imageUrl} alt="avatar" className="w-full h-full object-cover"/>
                             ) : (
                                <UserCog size={48} className="text-gray-300"/>
                             )}
                             
                             <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera size={24} className="text-white" />
                             </div>
                         </div>
                         <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />

                         <div>
                             <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 break-all line-clamp-2">
                                {formData.name || (isCreating ? '新老師' : '未命名')}
                             </h1>
                             <p className="text-gray-500 text-base">
                                {isCreating ? '建立新師資' : `ID: ${selectedInstId}`}
                             </p>
                             {formData.phoneNumber && (
                                <p className="text-zen-600 text-base font-medium flex items-center gap-1 mt-1">
                                    <Phone size={16}/> {formData.phoneNumber}
                                </p>
                             )}
                         </div>
                    </div>

                    <div className="space-y-8 max-w-lg mx-auto sm:mx-0">
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">姓名</label>
                                <input 
                                    type="text" 
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:outline-none font-medium text-gray-900 text-lg"
                                    placeholder="例如：Sarah Jenks"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">電話</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input 
                                        type="tel" 
                                        value={formData.phoneNumber || ''}
                                        onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                                        className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:outline-none text-gray-900 text-lg"
                                        placeholder="09xx..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">預設時薪 ($)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input 
                                        type="number" 
                                        value={formData.defaultRate?.toString() ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            // Handle empty input to delete 0
                                            if (val === '') {
                                                setFormData({ ...formData, defaultRate: undefined });
                                                return;
                                            }
                                            const parsed = parseInt(val, 10);
                                            setFormData({ ...formData, defaultRate: isNaN(parsed) ? 0 : parsed });
                                        }}
                                        className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:outline-none font-mono text-gray-900 text-lg"
                                        style={{ colorScheme: 'light' }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-2">此數值將作為薪資計算機的預設標準</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">簡介</label>
                                <textarea 
                                    value={formData.bio || ''}
                                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                    className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-zen-500 focus:outline-none text-gray-900 min-h-[140px] text-base leading-relaxed"
                                    placeholder="輸入老師簡介..."
                                />
                            </div>
                        </div>

                        <div className="pt-6 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 mt-8 pb-10">
                            {!isCreating && (
                                showDeleteConfirm ? (
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={() => setShowDeleteConfirm(false)}
                                            className="flex-1 px-4 py-3 rounded-xl text-gray-600 bg-gray-100 text-base font-medium hover:bg-gray-200"
                                        >
                                            取消
                                        </button>
                                        <button 
                                            onClick={handleDelete}
                                            className="flex-1 px-4 py-3 rounded-xl text-white bg-red-600 text-base font-medium hover:bg-red-700 flex items-center justify-center gap-2 shadow-md"
                                        >
                                            確認刪除
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 px-5 py-3 rounded-xl text-base font-medium flex items-center gap-2 transition-colors w-full sm:w-auto justify-center sm:justify-start border border-red-100 sm:border-none"
                                    >
                                        <Trash2 size={20} />
                                        刪除老師
                                    </button>
                                )
                            )}
                            <div className="flex gap-3 w-full sm:w-auto ml-auto">
                                <button 
                                    onClick={handleSave}
                                    disabled={!formData.name}
                                    className="flex-1 bg-zen-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-zen-700 shadow-lg shadow-zen-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                                >
                                    <Save size={20} />
                                    {isCreating ? '建立' : '儲存'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8 text-center">
                    <UserCog size={80} className="mb-6 text-gray-200" />
                    <p className="text-xl font-medium text-gray-400">請從左側列表選擇老師<br/>以編輯資料或設定時薪</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

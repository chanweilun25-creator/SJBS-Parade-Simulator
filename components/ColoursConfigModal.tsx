
import React, { useState } from 'react';
import { Flag, X, Check } from 'lucide-react';

interface ColoursConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (count: number, colors: string[]) => void;
}

export const ColoursConfigModal: React.FC<ColoursConfigModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [count, setCount] = useState(1);
    const [colors, setColors] = useState<string[]>(['#EF4444']);

    if (!isOpen) return null;

    const handleCountChange = (val: number) => {
        const newCount = Math.max(1, Math.min(6, val));
        setCount(newCount);
        
        // Adjust colors array
        const newColors = [...colors];
        if (newCount > colors.length) {
            for (let i = colors.length; i < newCount; i++) {
                newColors.push('#EF4444');
            }
        } else {
            newColors.splice(newCount);
        }
        setColors(newColors);
    };

    const handleColorChange = (index: number, color: string) => {
        const newColors = [...colors];
        newColors[index] = color;
        setColors(newColors);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(count, colors);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                        <Flag className="w-5 h-5 text-yellow-500" /> Colours Party Setup
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Number of Colours</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range" 
                                min="1" max="6"
                                value={count}
                                onChange={(e) => handleCountChange(parseInt(e.target.value))}
                                className="flex-1 accent-yellow-500"
                            />
                            <span className="text-2xl font-mono text-white w-8 text-center">{count}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-400 mb-3 uppercase tracking-wide">Flag Colours</label>
                        <div className="grid grid-cols-3 gap-4">
                            {colors.map((color, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-600 relative group">
                                        <input 
                                            type="color" 
                                            value={color}
                                            onChange={(e) => handleColorChange(idx, e.target.value)}
                                            className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-none"
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500">Colour {idx + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-800 flex justify-end gap-3">
                         <button 
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                         >
                             Cancel
                         </button>
                         <button 
                            type="submit"
                            className="px-6 py-2 rounded bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-bold shadow-lg flex items-center gap-2"
                         >
                             <Check className="w-4 h-4" /> Place on Ground
                         </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

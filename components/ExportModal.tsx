
import React, { useState, useEffect } from 'react';
import { Download, X, Eye, EyeOff } from 'lucide-react';
import { PIXELS_PER_PACE, TERRAIN_COLORS } from '../constants';
import { ParadeState } from '../types';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    parade: ParadeState;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, parade }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showGrid, setShowGrid] = useState(true);
    const [showPaths, setShowPaths] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            generatePreview();
        } else {
            setPreviewUrl(null);
        }
    }, [isOpen, showGrid, showPaths]);

    const generatePreview = () => {
        setIsGenerating(true);
        const svgElement = document.getElementById('parade-canvas-svg');
        if (!svgElement) {
            setIsGenerating(false);
            return;
        }

        // Clone the SVG to manipulate it for export
        const clone = svgElement.cloneNode(true) as SVGSVGElement;
        
        // Reset ViewBox/Dimensions to match full parade size (unscaled)
        const width = parade.config.width * PIXELS_PER_PACE;
        const height = parade.config.height * PIXELS_PER_PACE;
        
        clone.setAttribute('width', width.toString());
        clone.setAttribute('height', height.toString());
        clone.style.width = `${width}px`;
        clone.style.height = `${height}px`;
        clone.style.cursor = 'default';

        // Reset Transform (remove pan/zoom)
        const g = clone.querySelector('g');
        if (g) {
            g.setAttribute('transform', 'scale(1)');
        }

        // Handle Toggles
        if (!showGrid) {
            const grid = clone.querySelector('#grid-layer');
            if (grid) grid.remove();
        }
        if (!showPaths) {
            const paths = clone.querySelector('#paths-layer');
            if (paths) paths.remove();
        }

        const data = (new XMLSerializer()).serializeToString(clone);
        const svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);

        // Convert to PNG for preview
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            if (ctx) {
                // Draw background explicitly (as some viewers might ignore SVG rect)
                ctx.fillStyle = TERRAIN_COLORS[parade.config.terrain];
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0);
                const pngUrl = canvas.toDataURL('image/png');
                setPreviewUrl(pngUrl);
                URL.revokeObjectURL(url);
                setIsGenerating(false);
            }
        };
        img.onerror = () => {
            setIsGenerating(false);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    };

    const handleDownload = () => {
        if (previewUrl) {
            const a = document.createElement('a');
            a.href = previewUrl;
            a.download = `${parade.config.title.replace(/\s+/g, '_')}_layout.png`;
            a.click();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
                    <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                        <Download className="w-5 h-5 text-green-500" /> Export Layout Snapshot
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Controls */}
                    <div className="w-64 bg-gray-900/50 border-r border-gray-700 p-6 flex flex-col gap-6 shrink-0">
                        <div>
                            <h3 className="text-xs uppercase font-bold text-gray-500 mb-3 tracking-wider">Visual Options</h3>
                            <div className="space-y-3">
                                <label className="flex items-center justify-between group cursor-pointer">
                                    <span className="text-sm text-gray-300 group-hover:text-white">Show Grid Lines</span>
                                    <div 
                                        onClick={() => setShowGrid(!showGrid)}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${showGrid ? 'bg-green-600' : 'bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showGrid ? 'left-6' : 'left-1'}`} />
                                    </div>
                                </label>
                                <label className="flex items-center justify-between group cursor-pointer">
                                    <span className="text-sm text-gray-300 group-hover:text-white">Show Animation Paths</span>
                                    <div 
                                        onClick={() => setShowPaths(!showPaths)}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${showPaths ? 'bg-green-600' : 'bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showPaths ? 'left-6' : 'left-1'}`} />
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="mt-auto">
                             <div className="text-xs text-gray-500 mb-2">
                                 Snapshot Size: <span className="text-gray-300">{Math.round(parade.config.width * PIXELS_PER_PACE)} x {Math.round(parade.config.height * PIXELS_PER_PACE)} px</span>
                             </div>
                             <button 
                                onClick={handleDownload}
                                disabled={!previewUrl || isGenerating}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-bold shadow-lg flex items-center justify-center gap-2 transition-all"
                            >
                                {isGenerating ? 'Generating...' : (
                                    <>
                                        <Download className="w-4 h-4" /> Download PNG
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 bg-black/50 p-8 flex items-center justify-center overflow-auto relative">
                        {isGenerating && (
                             <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                                 <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                             </div>
                        )}
                        {previewUrl ? (
                            <img 
                                src={previewUrl} 
                                alt="Parade Layout Preview" 
                                className="max-w-full max-h-full object-contain border border-gray-700 shadow-2xl bg-gray-900 rounded"
                            />
                        ) : (
                            <div className="text-gray-500 flex flex-col items-center">
                                <div className="w-8 h-8 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                                Generating Preview...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

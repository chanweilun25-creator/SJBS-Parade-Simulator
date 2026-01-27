
import React from 'react';
import { MousePointer2, Move, ZoomIn, ZoomOut, Undo2, Redo2, Magnet, Save, Route } from 'lucide-react';

interface NotchBarProps {
  tool: 'SELECT' | 'PAN';
  setTool: (t: 'SELECT' | 'PAN') => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;
  scale: number;
  onZoom: (delta: number) => void;
  onResetZoom: () => void;
  onCenterCanvas: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showPaths?: boolean;
  setShowPaths?: (v: boolean) => void;
}

export const NotchBar: React.FC<NotchBarProps> = ({ 
    tool, setTool, snapToGrid, setSnapToGrid, scale, onZoom, onResetZoom, onCenterCanvas, onUndo, onRedo, onSave, canUndo, canRedo,
    showPaths, setShowPaths
}) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800 rounded-full shadow-lg border border-gray-700 px-4 py-2 flex items-center gap-1 z-10">
      <div className="flex items-center gap-1 pr-3 border-r border-gray-700">
        <button 
          onClick={() => setTool('SELECT')}
          className={`p-2 rounded-full transition-colors ${tool === 'SELECT' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
          title="Select (S)"
        >
          <MousePointer2 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => setTool('PAN')}
          onDoubleClick={onCenterCanvas}
          className={`p-2 rounded-full transition-colors ${tool === 'PAN' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
          title="Pan (Space) - Dbl Click to Center"
        >
          <Move className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-3 border-r border-gray-700">
        <button onClick={() => onZoom(-0.1)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full">
            <ZoomOut className="w-4 h-4" />
        </button>
        <button 
            onClick={onResetZoom} 
            className="w-12 text-center text-xs font-mono text-gray-300 hover:text-white cursor-pointer select-none"
            title="Reset to 100%"
        >
            {Math.round(scale * 100)}%
        </button>
        <button onClick={() => onZoom(0.1)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full">
            <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-3 border-r border-gray-700">
        <button 
            onClick={onUndo} 
            disabled={!canUndo}
            className={`p-2 rounded-full ${canUndo ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 cursor-not-allowed'}`}
        >
            <Undo2 className="w-4 h-4" />
        </button>
        <button 
            onClick={onRedo} 
            disabled={!canRedo}
            className={`p-2 rounded-full ${canRedo ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 cursor-not-allowed'}`}
        >
            <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 pl-3">
         <button 
          onClick={() => setSnapToGrid(!snapToGrid)}
          className={`p-2 rounded-full transition-colors ${snapToGrid ? 'text-green-400 bg-green-900/30' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
          title="Toggle Grid Snap"
        >
          <Magnet className="w-4 h-4" />
        </button>
        {setShowPaths && (
            <button 
            onClick={() => setShowPaths(!showPaths)}
            className={`p-2 rounded-full transition-colors ${showPaths ? 'text-yellow-400 bg-yellow-900/30' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="Toggle Animation Paths"
            >
            <Route className="w-4 h-4" />
            </button>
        )}
        <button 
          onClick={onSave}
          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-full ml-1"
          title="Save Parade"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

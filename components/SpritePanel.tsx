
import React, { useState } from 'react';
import { EntityType } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { renderEntityVisual } from './RenderUtils';

interface SpritePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onDragStart: (type: EntityType) => void;
}

export const SpritePanel: React.FC<SpritePanelProps> = ({ isOpen, onToggle, onDragStart }) => {
  const [activeTab, setActiveTab] = useState<'PEOPLE' | 'FURNITURE'>('PEOPLE');

  const getPreviewIcon = (type: EntityType, label: string = "") => {
      // Create a small SVG context for the preview
      return (
          <svg width="32" height="32" viewBox="-20 -20 40 40">
              {renderEntityVisual(type, label)}
          </svg>
      );
  };

  const peopleItems = [
    { type: EntityType.REVIEWING_OFFICER, label: 'Reviewing Officer', icon: getPreviewIcon(EntityType.REVIEWING_OFFICER) },
    { type: EntityType.HOST, label: 'Host', icon: getPreviewIcon(EntityType.HOST) },
    { type: EntityType.PC, label: 'Parade Comd', icon: getPreviewIcon(EntityType.PC) },
    { type: EntityType.RSM, label: 'RSM', icon: getPreviewIcon(EntityType.RSM) },
    { type: EntityType.COLOURS, label: 'Colours Party', icon: getPreviewIcon(EntityType.COLOURS) },
    { type: EntityType.CONTINGENT, label: 'Contingent', icon: (
        // Mini grid formation for Contingent preview
        <svg width="32" height="32" viewBox="-25 -25 50 50">
             <g transform="translate(0,-10) scale(0.6)">{renderEntityVisual(EntityType.OFFICER)}</g>
             <g transform="translate(-10,10) scale(0.6)">{renderEntityVisual(EntityType.TROOPER)}</g>
             <g transform="translate(0,10) scale(0.6)">{renderEntityVisual(EntityType.TROOPER)}</g>
             <g transform="translate(10,10) scale(0.6)">{renderEntityVisual(EntityType.TROOPER)}</g>
        </svg>
    ) },
    { type: EntityType.ORDERLY, label: 'Orderly', icon: getPreviewIcon(EntityType.ORDERLY) },
  ];

  // Furniture items with scaled viewboxes for larger items
  const furnitureItems = [
    { 
      type: EntityType.SALUTING_BASE, 
      label: 'Saluting Base', 
      icon: (
          <svg width="32" height="32" viewBox="-80 -60 160 120">
              {renderEntityVisual(EntityType.SALUTING_BASE)}
          </svg>
      )
    },
    { 
      type: EntityType.ROSTRUM, 
      label: 'Rostrum', 
      icon: (
          <svg width="32" height="32" viewBox="-20 -20 40 40">
              {renderEntityVisual(EntityType.ROSTRUM)}
          </svg>
      )
    },
    { 
        type: EntityType.AWARD_TABLE, 
        label: 'Award Table', 
        icon: (
             <svg width="32" height="32" viewBox="-40 -20 80 40">
                {renderEntityVisual(EntityType.AWARD_TABLE)}
            </svg>
        )
    },
    { type: EntityType.TROPHY_CUP, label: 'Trophy (Cup)', icon: getPreviewIcon(EntityType.TROPHY_CUP) },
    { type: EntityType.TROPHY_PLAQUE, label: 'Trophy (Plaque)', icon: getPreviewIcon(EntityType.TROPHY_PLAQUE) },
    { type: EntityType.TROPHY_SHIELD, label: 'Trophy (Shield)', icon: getPreviewIcon(EntityType.TROPHY_SHIELD) },
    { 
        type: EntityType.SPEAKER, 
        label: 'Loud Speaker', 
        icon: getPreviewIcon(EntityType.SPEAKER)
    },
    { 
        type: EntityType.MIXER, 
        label: 'AV Mixer', 
        icon: (
            <svg width="32" height="32" viewBox="-25 -20 50 40">
                {renderEntityVisual(EntityType.MIXER)}
            </svg>
        )
    },
  ];

  const activeItems = activeTab === 'PEOPLE' ? peopleItems : furnitureItems;

  const handleDragStart = (e: React.DragEvent, type: EntityType) => {
    onDragStart(type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 relative ${isOpen ? 'w-64' : 'w-0 border-r-0'}`}>
      
      {/* Toggle Button - Vertically Centered */}
      <button 
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 bg-gray-700 border border-gray-600 rounded-full p-1 text-gray-300 hover:text-white hover:bg-gray-600 z-50 shadow-md"
        title={isOpen ? "Collapse Panel" : "Expand Panel"}
      >
        {isOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Content Container - Hidden when collapsed */}
      <div className={`flex flex-col h-full overflow-hidden ${!isOpen ? 'invisible' : 'visible'}`}>
        {/* Header Tabs */}
        <div className="flex border-b border-gray-700">
            <button 
                onClick={() => setActiveTab('PEOPLE')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'PEOPLE' ? 'text-green-400 border-b-2 border-green-500 bg-gray-700/50' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'}`}
            >
                People
            </button>
            <button 
                onClick={() => setActiveTab('FURNITURE')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'FURNITURE' ? 'text-green-400 border-b-2 border-green-500 bg-gray-700/50' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'}`}
            >
                Furniture
            </button>
        </div>

        {/* List */}
        <div className="p-2 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          {activeItems.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => handleDragStart(e, item.type)}
              className="flex items-center gap-3 p-2 bg-gray-700 hover:bg-gray-600 rounded cursor-grab active:cursor-grabbing border border-gray-600 hover:border-gray-500 transition-colors shadow-sm group"
            >
              <div className="p-1.5 bg-gray-800/50 rounded shrink-0 flex items-center justify-center w-10 h-10 border border-gray-700">
                  {item.icon}
              </div>
              <span className="text-sm font-medium text-gray-200 truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

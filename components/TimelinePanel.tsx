
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ParadeState, AnimationTrack, AnimationAction } from '../types';
import { Play, Pause, Square, Plus, Move, RotateCw, Compass, ZoomIn, ZoomOut, GripVertical } from 'lucide-react';
import { isFurniture } from '../constants';

interface TimelinePanelProps {
  parade: ParadeState;
  currentTime: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (t: number) => void;
  onAddAction: (ownerId: string, type: 'MOVE' | 'TURN' | 'WHEEL') => void;
  onUpdateAction: (ownerId: string, actionId: string, updates: Partial<AnimationAction>) => void;
  onDeleteAction: (ownerId: string, actionId: string) => void;
  onSelectAction: (action: AnimationAction | null) => void;
  selectedActionId: string | null;
  onTrackReorder?: (newOrder: string[]) => void;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  parade, currentTime, isPlaying, onPlay, onPause, onStop, onSeek,
  onAddAction, onUpdateAction, onDeleteAction, onSelectAction, selectedActionId, onTrackReorder
}) => {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(40);
  const [activeMenu, setActiveMenu] = useState<{ id: string, x: number, y: number } | null>(null);
  
  // Refs for scrolling synchronization
  const sidebarRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Drag State (Clip Dragging)
  const [dragState, setDragState] = useState<{
      actionId: string;
      ownerId: string;
      startX: number; // Client X
      initialStartTime: number;
  } | null>(null);

  // Drag State (Row Reordering)
  const [reorderDragIndex, setReorderDragIndex] = useState<number | null>(null);

  // Derived Track List (Filtered and Ordered)
  const trackOwners = useMemo(() => {
    // 1. Get all eligible IDs (Groups + Non-Furniture Entities)
    const allGroups = Object.keys(parade.groups).map(gid => ({ 
        id: gid, 
        label: parade.groups[gid].label || 'Group', 
        isGroup: true 
    }));
    
    const allEntities = parade.entities
        .filter(e => !e.groupId && !isFurniture(e.type)) // Exclude grouped & furniture
        .map(e => ({ 
            id: e.id, 
            label: e.label || e.type.replace(/_/g, ' '), 
            isGroup: false 
        }));

    // If an entity is grouped but has animation tracks, it should appear (Individual control override)
    // Filter entities that ARE in a group AND have tracks
    const individualOverrides = parade.entities
        .filter(e => e.groupId && parade.animation.tracks[e.id])
        .map(e => ({
            id: e.id,
            label: `↳ ${e.label || 'Member'}`, // Indent visual
            isGroup: false
        }));

    const allItems = [...allGroups, ...allEntities, ...individualOverrides];
    const itemsMap = new Map(allItems.map(i => [i.id, i]));

    // 2. Use persisted order if available
    let orderedIds = parade.animation.trackOrder || [];
    
    // 3. Reconcile: Filter out deleted, Append new
    const finalIds = new Set(orderedIds);
    // Remove IDs that no longer exist in eligible items
    const validOrderedIds = orderedIds.filter(id => itemsMap.has(id));
    
    // Add missing items
    allItems.forEach(item => {
        if (!finalIds.has(item.id)) {
            validOrderedIds.push(item.id);
        }
    });

    return validOrderedIds.map(id => itemsMap.get(id)!);
  }, [parade.groups, parade.entities, parade.animation.trackOrder, parade.animation.tracks]);

  // Sync Scrolling: Timeline drives Sidebar
  const handleTimelineScroll = () => {
      if (sidebarRef.current && timelineRef.current) {
          sidebarRef.current.scrollTop = timelineRef.current.scrollTop;
      }
  };

  // Dragging Logic (Clip)
  useEffect(() => {
      const handleMove = (e: MouseEvent) => {
          if (!dragState) return;
          const dt = (e.clientX - dragState.startX) / pixelsPerSecond;
          let newTime = dragState.initialStartTime + dt;
          
          // Snap to 0.25s
          newTime = Math.round(newTime * 4) / 4; 
          if (newTime < 0) newTime = 0;
          
          onUpdateAction(dragState.ownerId, dragState.actionId, { startTime: newTime });
      };
      
      const handleUp = () => {
          setDragState(null);
      };

      if (dragState) {
          window.addEventListener('mousemove', handleMove);
          window.addEventListener('mouseup', handleUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
      };
  }, [dragState, pixelsPerSecond, onUpdateAction]);

  // Close menus when clicking elsewhere
  useEffect(() => {
    const closeMenu = () => setActiveMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);


  const handleAddClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      // Position menu just above or to the right of the button
      setActiveMenu(activeMenu?.id === id ? null : { id, x: rect.right + 5, y: rect.top });
  };

  const executeAdd = (id: string, type: 'MOVE' | 'TURN' | 'WHEEL') => {
      onAddAction(id, type);
      setActiveMenu(null);
  };

  const handleRulerClick = (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const clickX = e.clientX - rect.left + scrollLeft;
      const t = Math.max(0, clickX / pixelsPerSecond);
      onSeek(t);
  };

  const handleClipMouseDown = (e: React.MouseEvent, ownerId: string, action: AnimationAction) => {
      e.stopPropagation();
      onSelectAction(action);
      setDragState({
          actionId: action.id,
          ownerId,
          startX: e.clientX,
          initialStartTime: action.startTime
      });
  };

  // --- Row Reordering Handlers ---
  const handleRowDragStart = (e: React.DragEvent, index: number) => {
    setReorderDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Set a transparent image or similar if needed, or default browser ghost
  };

  const handleRowDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Allow drop
    if (reorderDragIndex === null || reorderDragIndex === index) return;
    
    // Reorder
    const newOrder = [...trackOwners];
    const draggedItem = newOrder[reorderDragIndex];
    newOrder.splice(reorderDragIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    
    // Optimistic update visual (optional, but better to just update prop if fast enough)
    // Here we rely on parent update via onTrackReorder
    if (onTrackReorder) {
        onTrackReorder(newOrder.map(i => i.id));
        setReorderDragIndex(index); // Update local index to prevent jitter
    }
  };

  const handleRowDrop = () => {
      setReorderDragIndex(null);
  };

  return (
    <div className="h-64 bg-gray-900 border-t border-gray-700 flex flex-col shrink-0 select-none z-10">
      {/* Toolbar */}
      <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-2 shrink-0">
        <button onClick={isPlaying ? onPause : onPlay} className="p-1 rounded hover:bg-gray-700 text-white">
             {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={onStop} className="p-1 rounded hover:bg-gray-700 text-white">
            <Square className="w-4 h-4" />
        </button>
        <div className="mx-2 w-px h-6 bg-gray-700" />
        <span className="font-mono text-sm text-green-400 w-16">{currentTime.toFixed(2)}s</span>
        
        <div className="flex items-center gap-1 ml-4 border-l border-gray-700 pl-4">
            <button onClick={() => setPixelsPerSecond(prev => Math.max(10, prev - 10))} className="p-1 text-gray-400 hover:text-white">
                <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 w-12 text-center">{pixelsPerSecond}px/s</span>
            <button onClick={() => setPixelsPerSecond(prev => Math.min(200, prev + 10))} className="p-1 text-gray-400 hover:text-white">
                <ZoomIn className="w-4 h-4" />
            </button>
        </div>

        <div className="flex-1" />
        <span className="text-xs text-gray-500">Drag clips to move (0.25s snap)</span>
      </div>

      {/* Main Area: Sidebar + Scrollable Timeline */}
      <div className="flex flex-1 overflow-hidden relative">
         
         {/* Sidebar (Track Headers) - Independent overflow but sync controlled */}
         <div 
            ref={sidebarRef}
            className="w-48 bg-gray-850 border-r border-gray-700 flex flex-col shrink-0 overflow-hidden"
         >
             <div className="h-8 border-b border-gray-700 bg-gray-800 text-xs font-bold text-gray-400 flex items-center px-2 shrink-0">
                 TRACKS
             </div>
             {/* Track Labels List */}
             <div className="flex-1">
                 {trackOwners.map((owner, index) => (
                     <div 
                        key={owner.id} 
                        className={`h-10 border-b border-gray-700/50 flex items-center px-2 justify-between text-xs text-gray-300 hover:bg-gray-800 group relative ${reorderDragIndex === index ? 'opacity-50' : ''}`}
                        draggable
                        onDragStart={(e) => handleRowDragStart(e, index)}
                        onDragOver={(e) => handleRowDragOver(e, index)}
                        onDrop={handleRowDrop}
                     >
                         <div className="flex items-center gap-2 truncate flex-1 cursor-grab active:cursor-grabbing">
                             <GripVertical className="w-3 h-3 text-gray-600" />
                             <span className="truncate" title={owner.label}>{owner.label}</span>
                         </div>
                         <button 
                            onClick={(e) => handleAddClick(e, owner.id)} 
                            className={`p-1 rounded hover:text-white ${activeMenu?.id === owner.id ? 'text-green-400 bg-gray-700' : 'text-gray-500'}`}
                         >
                            <Plus className="w-3 h-3" />
                         </button>
                     </div>
                 ))}
                 {/* Empty space filler to match timeline height if needed */}
                 <div className="h-full bg-gray-850" />
             </div>
         </div>

         {/* Timeline Content - Handles Scrolling */}
         <div 
            ref={timelineRef}
            className="flex-1 bg-gray-900 overflow-auto relative custom-scrollbar"
            onScroll={handleTimelineScroll}
         >
             <div className="min-w-[1000px] h-full relative" style={{ width: `${Math.max(100, parade.animation.duration * pixelsPerSecond + 200)}px` }}>
                 {/* Ruler */}
                 <div 
                    className="h-8 border-b border-gray-700 bg-gray-800/80 sticky top-0 z-20 flex cursor-pointer"
                    onClick={handleRulerClick}
                 >
                     {Array.from({ length: Math.ceil(parade.animation.duration) + 5 }).map((_, i) => (
                         <div key={i} className="absolute bottom-0 border-l border-gray-600 pl-1 text-[10px] text-gray-500 select-none pointer-events-none" style={{ left: i * pixelsPerSecond }}>
                             {i}s
                         </div>
                     ))}
                 </div>
                 
                 {/* Playhead */}
                 <div 
                    className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
                    style={{ left: currentTime * pixelsPerSecond }}
                 >
                     <div className="w-3 h-3 bg-red-500 -ml-1.5 rotate-45 transform -mt-1.5" />
                 </div>

                 {/* Tracks Container */}
                 <div className="relative">
                     {trackOwners.map((owner, index) => {
                         const track = parade.animation.tracks[owner.id];
                         return (
                             <div 
                                key={owner.id} 
                                className="h-10 border-b border-gray-700/30 relative bg-gray-900/30 hover:bg-gray-800/30 transition-colors"
                                onDragOver={(e) => handleRowDragOver(e, index)} // Support drag over on timeline area too for better UX
                                onDrop={handleRowDrop}
                             >
                                 {track?.actions.map(action => {
                                     const isSelected = action.id === selectedActionId;
                                     let bgColor = 'bg-gray-700';
                                     if (action.type === 'MOVE') bgColor = 'bg-blue-900/60 border-blue-700';
                                     if (action.type === 'TURN') bgColor = 'bg-green-900/60 border-green-700';
                                     if (action.type === 'WHEEL') bgColor = 'bg-yellow-900/60 border-yellow-700';

                                     return (
                                         <div 
                                            key={action.id}
                                            onMouseDown={(e) => handleClipMouseDown(e, owner.id, action)}
                                            className={`absolute top-1 bottom-1 rounded px-2 text-[10px] flex items-center overflow-hidden cursor-move border select-none
                                                ${isSelected ? 'border-white z-10 ring-1 ring-white shadow-md' : 'border-opacity-50 hover:border-opacity-100'} ${bgColor}`}
                                            style={{ 
                                                left: action.startTime * pixelsPerSecond,
                                                width: action.duration * pixelsPerSecond,
                                                transition: dragState?.actionId === action.id ? 'none' : 'left 0.1s, width 0.1s'
                                            }}
                                         >
                                             <span className="text-gray-200 font-bold truncate flex items-center gap-1 pointer-events-none">
                                                 {action.type === 'MOVE' && <Move className="w-3 h-3" />}
                                                 {action.type === 'TURN' && <RotateCw className="w-3 h-3" />}
                                                 {action.type === 'WHEEL' && <Compass className="w-3 h-3" />}
                                                 {action.type}
                                             </span>
                                         </div>
                                     );
                                 })}
                             </div>
                         );
                     })}
                 </div>
             </div>
         </div>
      </div>

      {/* Floating Context Menu */}
      {activeMenu && (
          <div 
            className="fixed bg-gray-800 border border-gray-600 rounded shadow-xl z-50 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100"
            style={{ 
                top: Math.min(window.innerHeight - 120, activeMenu.y - 40), // Adjust to keep on screen
                left: activeMenu.x 
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing immediately
          >
             <div className="px-2 py-1 text-[10px] uppercase text-gray-500 font-bold tracking-wider border-b border-gray-700 mb-1">Add Animation</div>
             <button onClick={() => executeAdd(activeMenu.id, 'MOVE')} className="px-3 py-2 text-left hover:bg-gray-700 flex items-center gap-2 text-xs text-gray-200">
                 <Move className="w-3 h-3 text-blue-400" /> Move
             </button>
             <button onClick={() => executeAdd(activeMenu.id, 'TURN')} className="px-3 py-2 text-left hover:bg-gray-700 flex items-center gap-2 text-xs text-gray-200">
                 <RotateCw className="w-3 h-3 text-green-400" /> Turn
             </button>
             <button onClick={() => executeAdd(activeMenu.id, 'WHEEL')} className="px-3 py-2 text-left hover:bg-gray-700 flex items-center gap-2 text-xs text-gray-200">
                 <Compass className="w-3 h-3 text-yellow-400" /> Wheel
             </button>
          </div>
      )}
    </div>
  );
};

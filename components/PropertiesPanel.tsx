
import React, { useState, useEffect } from 'react';
import { Entity, EntityType, GroupMetadata, AnimationAction, AnchorPosition } from '../types';
import { RotateCw, Trash2, Users, UserMinus, ChevronLeft, ChevronRight, SlidersHorizontal, UserPlus, Eye, EyeOff, Check, Compass, Flag, Clock, CornerUpRight, MoveDiagonal, LayoutTemplate } from 'lucide-react';

interface PropertiesPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedEntities: Entity[];
  groups: Record<string, GroupMetadata>;
  onUpdate: (updates: Partial<Entity>[]) => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onUpdateGroup: (id: string, updates: Partial<GroupMetadata>) => void;
  
  // Animation props
  selectedAction?: AnimationAction;
  onUpdateAction: (actionId: string, updates: Partial<AnimationAction>) => void;
  onDeleteAction: () => void;
}

// Helper component for Color Picker with "Set" button
const ColorPickerWithSet: React.FC<{ 
    color: string; 
    index: number; 
    onSet: (c: string) => void; 
}> = ({ color, index, onSet }) => {
    const [tempColor, setTempColor] = useState(color);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setTempColor(color);
        setIsDirty(false);
    }, [color]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempColor(e.target.value);
        setIsDirty(true);
    };

    const handleSet = () => {
        onSet(tempColor);
        setIsDirty(false);
    };

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative group/color">
                <input 
                    type="color"
                    value={tempColor}
                    onChange={handleChange}
                    className="w-8 h-8 rounded cursor-pointer border-none p-0 overflow-hidden bg-transparent"
                    title={`Colour ${index + 1}`}
                />
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 opacity-0 group-hover/color:opacity-100 whitespace-nowrap pointer-events-none">
                    Flag {index + 1}
                </span>
            </div>
            {isDirty && (
                <button 
                    onClick={handleSet}
                    className="p-0.5 bg-green-600 hover:bg-green-500 rounded text-white shadow-sm flex items-center justify-center w-full mt-1"
                    title="Set Color"
                >
                    <Check className="w-3 h-3" />
                </button>
            )}
        </div>
    );
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
    isOpen, onToggle, selectedEntities, groups, onUpdate, onDelete, onGroup, onUngroup, onUpdateGroup,
    selectedAction, onUpdateAction, onDeleteAction
}) => {
  
  const toggleButton = (
    <button 
        onClick={onToggle}
        className="absolute -left-3 top-1/2 -translate-y-1/2 bg-gray-700 border border-gray-600 rounded-full p-1 text-gray-300 hover:text-white hover:bg-gray-600 z-50 shadow-md"
        title={isOpen ? "Collapse Properties" : "Expand Properties"}
    >
        {isOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
    </button>
  );

  if (!isOpen) {
      return (
        <div className="w-0 border-l-0 bg-gray-800 flex flex-col items-center relative transition-all duration-300">
             {toggleButton}
        </div>
      );
  }

  const renderAnimationProperties = () => {
    if (!selectedAction) return <div className="p-4 text-xs text-gray-500">No action selected</div>;

    const handlePayloadChange = (key: string, value: number | string) => {
        onUpdateAction(selectedAction.id, { payload: { ...selectedAction.payload, [key]: value } });
    };

    const handleCommonChange = (key: keyof AnimationAction, value: number) => {
        onUpdateAction(selectedAction.id, { [key]: value });
    };

    // Determine if we are editing a group action
    let isGroupAction = false;
    // Find owner of action
    // (Logic could be passed down, but for now we infer if selectedEntities are a group or if we can find the track)
    // Simplified: Check if payload accepts groupAnchor
    
    return (
        <div className="p-4 space-y-4 flex flex-col h-full bg-gray-850">
            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                     <span className="font-bold text-green-400 text-sm">{selectedAction.type} Action</span>
                     <span className="text-xs text-gray-500 font-mono">{selectedAction.id.slice(0, 8)}</span>
                </div>

                {/* Timing */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Start Time (s)</label>
                        <input 
                            type="number" step="0.1" min="0"
                            value={selectedAction.startTime}
                            onChange={(e) => handleCommonChange('startTime', parseFloat(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Duration (s)</label>
                        <input 
                            type="number" step="0.1" min="0.1"
                            value={selectedAction.duration}
                            onChange={(e) => handleCommonChange('duration', parseFloat(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                        />
                    </div>
                </div>

                {/* Type Specific */}
                {selectedAction.type === 'MOVE' && (
                    <div className="space-y-4">
                         <div className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-400 uppercase">Pathing</h4>
                            <div className="flex bg-gray-900 rounded p-1 border border-gray-700">
                                <button
                                    onClick={() => handlePayloadChange('movePathMode', 'ORTHOGONAL')}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs ${(!selectedAction.payload.movePathMode || selectedAction.payload.movePathMode === 'ORTHOGONAL') ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <CornerUpRight className="w-3 h-3"/> Right Angle
                                </button>
                                <button
                                    onClick={() => handlePayloadChange('movePathMode', 'DIRECT')}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs ${selectedAction.payload.movePathMode === 'DIRECT' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <MoveDiagonal className="w-3 h-3"/> Direct
                                </button>
                            </div>
                         </div>

                         <div className="space-y-2">
                             <h4 className="text-xs font-bold text-gray-400 uppercase">Target Position</h4>
                             <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">X (Paces)</label>
                                    <input 
                                        type="number" step="0.5"
                                        value={selectedAction.payload.targetX ?? 0}
                                        onChange={(e) => handlePayloadChange('targetX', parseFloat(e.target.value))}
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Y (Paces)</label>
                                    <input 
                                        type="number" step="0.5"
                                        value={selectedAction.payload.targetY ?? 0}
                                        onChange={(e) => handlePayloadChange('targetY', parseFloat(e.target.value))}
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                                    />
                                </div>
                             </div>
                         </div>

                         {/* Group Anchor Reference */}
                         <div className="space-y-2 pt-2 border-t border-gray-700">
                             <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                                 <LayoutTemplate className="w-3 h-3"/> Group Reference
                             </h4>
                             <div className="grid grid-cols-3 gap-1 bg-gray-900 p-1 rounded border border-gray-700 w-24 mx-auto">
                                 {['TL', 'TM', 'TR', 'CL', 'C', 'CR', 'BL', 'BM', 'BR'].map((pos) => (
                                     <button
                                         key={pos}
                                         onClick={() => handlePayloadChange('groupAnchor', pos)}
                                         className={`w-full aspect-square text-[8px] font-bold rounded flex items-center justify-center 
                                            ${(selectedAction.payload.groupAnchor || 'TL') === pos ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                                         title={`Anchor: ${pos}`}
                                     >
                                         {pos}
                                     </button>
                                 ))}
                             </div>
                             <p className="text-[10px] text-gray-500 text-center">
                                 Select which point of the group moves to the target coordinates.
                             </p>
                         </div>
                    </div>
                )}

                {selectedAction.type === 'TURN' && (
                    <div className="space-y-2">
                         <h4 className="text-xs font-bold text-gray-400 uppercase">Target Rotation</h4>
                         <div>
                            <label className="block text-xs text-gray-500 mb-1">Angle (Degrees)</label>
                            <input 
                                type="number" 
                                value={selectedAction.payload.targetRotation ?? 0}
                                onChange={(e) => handlePayloadChange('targetRotation', parseFloat(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                            />
                            <div className="flex gap-1 mt-2">
                                {[0, 90, 180, 270].map(d => (
                                    <button 
                                      key={d} 
                                      onClick={() => handlePayloadChange('targetRotation', d)}
                                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                         </div>
                    </div>
                )}

                {selectedAction.type === 'WHEEL' && (
                    <div className="space-y-2">
                         <h4 className="text-xs font-bold text-gray-400 uppercase">Wheel Config</h4>
                         <div>
                            <label className="block text-xs text-gray-500 mb-1">Angle (Degrees)</label>
                            <input 
                                type="number" 
                                value={selectedAction.payload.wheelAngle ?? 90}
                                onChange={(e) => handlePayloadChange('wheelAngle', parseFloat(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                            />
                         </div>
                         <div>
                            <label className="block text-xs text-gray-500 mb-1">Pivot Corner</label>
                            <div className="grid grid-cols-3 gap-1">
                                {['TL', 'TR', 'CENTER', 'BL', 'BR'].map(pos => (
                                     <button 
                                        key={pos}
                                        onClick={() => handlePayloadChange('pivotCorner', pos)}
                                        className={`py-1 text-[10px] rounded border ${selectedAction.payload.pivotCorner === pos ? 'bg-green-900/50 border-green-500 text-green-400' : 'bg-gray-700 border-gray-600'}`}
                                    >
                                        {pos}
                                    </button>
                                ))}
                            </div>
                         </div>
                    </div>
                )}
            </div>

            <button 
                onClick={onDeleteAction}
                className="w-full py-2 bg-red-900/30 text-red-400 border border-red-900/50 rounded hover:bg-red-900/50 flex items-center justify-center gap-2 text-sm mt-auto shrink-0"
            >
                <Trash2 className="w-4 h-4" /> Delete Action
            </button>
        </div>
    );
  };

  const renderEntityProperties = () => {
    if (selectedEntities.length === 0) {
        if (selectedAction) return <div className="p-4 text-xs text-gray-500 text-center italic">Select an entity on canvas to see properties</div>;

        return (
          <div className="h-full flex flex-col items-center justify-center p-6 text-gray-500 text-sm text-center">
            <Users className="w-10 h-10 mb-2 opacity-20" />
            Select an entity to edit properties
          </div>
        );
      }
    
      const primary = selectedEntities[0];
      const isMultiple = selectedEntities.length > 1;
      
      const commonGroupId = primary.groupId && selectedEntities.every(e => e.groupId === primary.groupId) ? primary.groupId : null;
      const isGroup = !!commonGroupId;
      const groupMeta = commonGroupId ? groups[commonGroupId] : null;

      const handleRotationChange = (val: number) => {
        onUpdate(selectedEntities.map(e => ({ id: e.id, rotation: val })));
      };
      
      const handleGroupRotationChange = (val: number) => {
          if (commonGroupId) {
              onUpdateGroup(commonGroupId, { rotation: val });
          }
      };
    
      const handleLabelChange = (val: string) => {
        onUpdate([{ id: primary.id, label: val }]);
      };
    
      const handlePositionChange = (axis: 'x' | 'y', val: number) => {
          if (!isMultiple) {
              onUpdate([{ id: primary.id, [axis]: val }]);
          }
      };

      const handleGroupLabelChange = (val: string) => {
          if (commonGroupId) onUpdateGroup(commonGroupId, { label: val });
      };

      const handleGroupVisibilityChange = () => {
          if (commonGroupId && groupMeta) onUpdateGroup(commonGroupId, { showLabel: !groupMeta.showLabel });
      };

      // Config Handlers
      const handleContingentRowsChange = (val: number) => {
          if(commonGroupId && groupMeta?.config) {
             onUpdateGroup(commonGroupId, { config: { ...groupMeta.config, rows: Math.max(1, val) }});
          }
      };

      const handleContingentColsChange = (val: number) => {
          if(commonGroupId && groupMeta?.config) {
             onUpdateGroup(commonGroupId, { config: { ...groupMeta.config, cols: Math.max(1, val) }});
          }
      };
      
      const handleColoursSergeantToggle = () => {
          if(commonGroupId && groupMeta?.config) {
              onUpdateGroup(commonGroupId, { config: { ...groupMeta.config, hasColoursSergeant: !groupMeta.config.hasColoursSergeant }});
          }
      };

      const handleColourCountChange = (val: number) => {
          if(commonGroupId && groupMeta?.config) {
              onUpdateGroup(commonGroupId, { config: { ...groupMeta.config, colourCount: Math.min(6, Math.max(1, val)) }});
          }
      };
      
      const handleFlagColorSet = (index: number, color: string) => {
          if(commonGroupId && groupMeta?.config?.flagColors) {
              const newColors = [...groupMeta.config.flagColors];
              newColors[index] = color;
              onUpdateGroup(commonGroupId, { config: { ...groupMeta.config, flagColors: newColors }});
          }
      };

      return (
        <div className="p-4 space-y-6">
             {/* Header Info */}
            <div className="pb-4 border-b border-gray-700 mb-4">
                <h3 className="font-bold text-gray-200 uppercase text-sm tracking-wider flex items-center justify-between">
                    <span>{isGroup ? 'Group Selected' : (isMultiple ? `${selectedEntities.length} Items` : primary.type)}</span>
                    {isGroup && <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded">Grouped</span>}
                </h3>
                {!isMultiple && <p className="text-xs text-gray-500 font-mono mt-1">ID: {primary.id.slice(0,8)}</p>}
            </div>

            {/* Special Config: Contingent */}
            {isGroup && groupMeta?.type === 'CONTINGENT' && groupMeta.config && (
                <div className="p-3 bg-gray-900/50 rounded border border-gray-700 space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase">Formation Layout</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Ranks (Rows)</label>
                            <input 
                                type="number" 
                                min="1" max="20"
                                value={groupMeta.config.rows || 3} 
                                onChange={(e) => handleContingentRowsChange(parseInt(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Files (Cols)</label>
                            <input 
                                type="number" 
                                min="1" max="20"
                                value={groupMeta.config.cols || 9} 
                                onChange={(e) => handleContingentColsChange(parseInt(e.target.value))}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                            />
                        </div>
                    </div>
                    
                    {/* Colours Sergeant Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                        <label className="text-xs text-gray-400">Colours Sergeant</label>
                        <button
                            onClick={handleColoursSergeantToggle}
                            className={`w-10 h-5 rounded-full relative transition-colors ${groupMeta.config.hasColoursSergeant ? 'bg-green-600' : 'bg-gray-600'}`}
                        >
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${groupMeta.config.hasColoursSergeant ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                </div>
            )}

            {/* Special Config: Colours Party */}
            {isGroup && groupMeta?.type === 'COLOURS_PARTY' && groupMeta.config && (
                <div className="p-3 bg-gray-900/50 rounded border border-gray-700 space-y-3">
                     <h4 className="text-xs font-bold text-gray-400 uppercase">Party Configuration</h4>
                     <div>
                        <label className="block text-xs text-gray-500 mb-1">Number of Colours (1-6)</label>
                        <input 
                            type="range" 
                            min="1" max="6"
                            value={groupMeta.config.colourCount || 1}
                            onChange={(e) => handleColourCountChange(parseInt(e.target.value))}
                            className="w-full accent-green-500"
                        />
                        <div className="text-right text-xs font-mono">{groupMeta.config.colourCount || 1} Colours</div>
                     </div>
                     
                     {/* Flag Colours Config */}
                     {groupMeta.config.flagColors && groupMeta.config.flagColors.length > 0 && (
                         <div className="space-y-2 pt-2 border-t border-gray-700/50">
                             <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                                 <Flag className="w-3 h-3"/> Flag Colours
                             </label>
                             <div className="flex flex-wrap gap-2">
                                 {groupMeta.config.flagColors.map((color, idx) => (
                                     <ColorPickerWithSet 
                                        key={idx} 
                                        color={color} 
                                        index={idx} 
                                        onSet={(c) => handleFlagColorSet(idx, c)} 
                                     />
                                 ))}
                             </div>
                         </div>
                     )}
                </div>
            )}

            {/* Group Label / Single Label */}
            {isGroup && groupMeta ? (
                <div>
                     <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Group Label</label>
                     <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={groupMeta.label || ''}
                            onChange={(e) => handleGroupLabelChange(e.target.value)}
                            className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                        />
                        <button 
                            onClick={handleGroupVisibilityChange}
                            className={`p-2 rounded border ${groupMeta.showLabel ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-gray-700 text-gray-400 border-gray-600'}`}
                            title="Toggle Group Label Visibility"
                        >
                            {groupMeta.showLabel ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                     </div>
                </div>
            ) : !isMultiple ? (
                <div>
                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Label</label>
                    <input 
                        type="text" 
                        value={primary.label}
                        onChange={(e) => handleLabelChange(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                    />
                </div>
            ) : null}
    
            {/* Position (Single Only) */}
            {!isMultiple && (
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs uppercase text-gray-500 font-bold mb-1">X (Paces)</label>
                        <input 
                            type="number" 
                            step="0.5"
                            value={primary.x}
                            onChange={(e) => handlePositionChange('x', parseFloat(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Y (Paces)</label>
                        <input 
                            type="number" 
                            step="0.5"
                            value={primary.y}
                            onChange={(e) => handlePositionChange('y', parseFloat(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 outline-none"
                        />
                    </div>
                </div>
            )}
    
            {/* Group Rotation */}
            {isGroup && groupMeta && (
                <div className="pt-2">
                    <label className="block text-xs uppercase text-green-400 font-bold mb-1 flex justify-between">
                        <span>Formation Bearing</span>
                        <Compass className="w-3 h-3" />
                    </label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="range" 
                            min="0" max="359"
                            value={groupMeta.rotation || 0}
                            onChange={(e) => handleGroupRotationChange(parseInt(e.target.value))}
                            className="flex-1 accent-green-500"
                        />
                        <span className="text-xs font-mono w-8 text-right">{groupMeta.rotation || 0}°</span>
                    </div>
                    <div className="flex justify-between mt-2 gap-1">
                        {[0, 90, 180, 270].map(deg => (
                            <button 
                                key={deg} 
                                onClick={() => handleGroupRotationChange(deg)}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                            >
                                {deg}°
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Individual Rotation (Hide if Group Selected to avoid confusion, or keep for fine tuning?) */}
            {!isGroup && (
                <div>
                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1 flex justify-between">
                        <span>Individual Bearing</span>
                        <RotateCw className="w-3 h-3" />
                    </label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="range" 
                            min="0" max="359"
                            value={primary.rotation}
                            onChange={(e) => handleRotationChange(parseInt(e.target.value))}
                            className="flex-1 accent-blue-500"
                        />
                        <span className="text-xs font-mono w-8 text-right">{primary.rotation}°</span>
                    </div>
                    <div className="flex justify-between mt-2 gap-1">
                        {[0, 90, 180, 270].map(deg => (
                            <button 
                                key={deg} 
                                onClick={() => handleRotationChange(deg)}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                            >
                                {deg}°
                            </button>
                        ))}
                    </div>
                </div>
            )}
    
            {/* Actions */}
            <div className="pt-4 border-t border-gray-700 space-y-2">
                {isGroup ? (
                    <button 
                        onClick={onUngroup}
                        className="w-full py-2 bg-blue-900/30 text-blue-400 border border-blue-900/50 rounded hover:bg-blue-900/50 flex items-center justify-center gap-2 text-sm"
                    >
                        <UserMinus className="w-4 h-4" /> Ungroup Selection
                    </button>
                ) : isMultiple ? (
                    <button 
                        onClick={onGroup}
                        className="w-full py-2 bg-green-900/30 text-green-400 border border-green-900/50 rounded hover:bg-green-900/50 flex items-center justify-center gap-2 text-sm"
                    >
                        <UserPlus className="w-4 h-4" /> Group Selection
                    </button>
                ) : null}
                
                <button 
                    onClick={onDelete}
                    className="w-full py-2 bg-red-900/30 text-red-400 border border-red-900/50 rounded hover:bg-red-900/50 flex items-center justify-center gap-2 text-sm"
                >
                    <Trash2 className="w-4 h-4" /> Delete Entities
                </button>
            </div>
        </div>
      );
  };

  return (
    <div className="w-64 bg-gray-800 border-l border-gray-700 flex flex-col text-gray-200 relative transition-all duration-300">
        {toggleButton}
        
        {selectedAction ? (
            // Split View: 1/2 Sprite Props (Top), 1/2 Animation Props (Bottom)
            // Flex column allows natural flow without overlap
            <div className="flex flex-col h-full">
                <div className="flex-1 overflow-hidden flex flex-col border-b border-gray-900">
                     <div className="bg-gray-900/50 p-2 text-[10px] text-gray-400 uppercase font-bold tracking-widest border-b border-gray-800 shrink-0">
                         Entity Properties
                     </div>
                     <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {renderEntityProperties()}
                     </div>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col bg-gray-850">
                     <div className="bg-green-900/20 p-2 text-[10px] text-green-400 uppercase font-bold tracking-widest border-b border-green-900/30 shrink-0">
                         Animation Clip
                     </div>
                     <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {renderAnimationProperties()}
                     </div>
                </div>
            </div>
        ) : (
            // Full View
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-gray-900/50 p-2 text-[10px] text-gray-400 uppercase font-bold tracking-widest border-b border-gray-800 shrink-0">
                     Entity Properties
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {renderEntityProperties()}
                </div>
            </div>
        )}
    </div>
  );
};


import React, { useRef, useState, useMemo } from 'react';
import { Entity, ParadeState, Coordinates, EntityType, GroupMetadata, AnimationAction, AnimationTrack } from '../types';
import { PIXELS_PER_PACE, TERRAIN_COLORS, GRID_MAJOR_INTERVAL, SELECTION_COLOR, ENTITY_SIZE_MAP, BOX_SELECT_BORDER, BOX_SELECT_FILL } from '../constants';
import { renderEntityVisual } from './RenderUtils';

interface ParadeCanvasProps {
  parade: ParadeState;
  selectedIds: string[];
  snapToGrid: boolean;
  scale: number;
  panOffset: { x: number, y: number };
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
  onSelectionChange: (ids: string[]) => void;
  onEntitiesChange: (entities: Entity[], newGroups?: Record<string, GroupMetadata>) => void;
  droppedEntityType: EntityType | null;
  onDropComplete: () => void;
  tool: 'SELECT' | 'PAN';
  showPaths?: boolean;
  selectedActionId?: string | null;
  onUpdateAction?: (actionId: string, updates: Partial<AnimationAction>) => void;
  isPlaying?: boolean;
}

export const ParadeCanvas: React.FC<ParadeCanvasProps> = ({
  parade,
  selectedIds,
  snapToGrid,
  scale,
  panOffset,
  setPanOffset,
  onSelectionChange,
  onEntitiesChange,
  droppedEntityType,
  onDropComplete,
  tool,
  showPaths = true,
  selectedActionId,
  onUpdateAction,
  isPlaying = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Coordinates | null>(null); // In Paces
  const [dragAnchorId, setDragAnchorId] = useState<string | null>(null); // To calculate relative snap
  const [panStart, setPanStart] = useState<{ x: number, y: number } | null>(null); // In Pixels (Client)
  
  // Animation Path Dragging State
  const [draggingActionId, setDraggingActionId] = useState<string | null>(null);
  
  // Multi-select Box State
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ start: Coordinates, current: Coordinates } | null>(null);

  const [initialEntityPositions, setInitialEntityPositions] = useState<Map<string, Coordinates>>(new Map());

  // Correct Coordinate Transform: Screen -> SVG Space -> Transformed Group Space -> Paces
  const getPacesFromEvent = (e: React.MouseEvent | React.DragEvent | React.TouchEvent): Coordinates => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    
    // Get client coordinates
    let clientX, clientY;
    if ('touches' in e) {
      clientX = (e as React.TouchEvent).touches[0].clientX;
      clientY = (e as React.TouchEvent).touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // 1. Transform screen to SVG Viewport coordinates
    const point = svgRef.current.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const svgPoint = point.matrixTransform(CTM.inverse());

    // 2. Untransform the Pan and Scale to get 'Pixels within the group'
    const groupPixelX = (svgPoint.x - panOffset.x) / scale;
    const groupPixelY = (svgPoint.y - panOffset.y) / scale;

    // 3. Convert Pixels to Paces
    return {
      x: groupPixelX / PIXELS_PER_PACE,
      y: groupPixelY / PIXELS_PER_PACE
    };
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (tool === 'PAN') return;
    const clickPaces = getPacesFromEvent(e);
    
    // Hit Test Entities (Topmost first)
    const reversedEntities = [...parade.entities].reverse();
    const clickedEntity = reversedEntities.find(ent => {
        let size = ENTITY_SIZE_MAP[ent.type] || 1;
        if (ent.type === EntityType.SALUTING_BASE) size = 4;
        const hitRadius = Math.max(size/2, 0.5); 
        const dist = Math.sqrt(Math.pow(ent.x - clickPaces.x, 2) + Math.pow(ent.y - clickPaces.y, 2));
        return dist <= hitRadius;
    });

    if (clickedEntity) {
        // Double click strictly selects the individual entity, overriding group selection
        onSelectionChange([clickedEntity.id]);
        e.stopPropagation();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'PAN') {
        setIsDragging(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
    }

    const clickPaces = getPacesFromEvent(e);

    // Hit Test for Animation Path Handle (only if an action is selected and paths are shown)
    if (showPaths && selectedActionId) {
         // Find coordinates of target handle
         // We iterate paths to find if we clicked a handle
         const actions = Object.values(parade.animation.tracks).flatMap((t: AnimationTrack) => t.actions);
         const targetAction = actions.find(a => a.id === selectedActionId);
         
         if (targetAction && targetAction.type === 'MOVE') {
             const tx = targetAction.payload.targetX;
             const ty = targetAction.payload.targetY;
             if (tx !== undefined && ty !== undefined) {
                 const dist = Math.sqrt(Math.pow(tx - clickPaces.x, 2) + Math.pow(ty - clickPaces.y, 2));
                 if (dist < 0.5) { // 0.5 pace hit radius
                     setDraggingActionId(selectedActionId);
                     setIsDragging(true);
                     return; // Stop processing selection
                 }
             }
         }
    }
    
    // Hit Test Entities
    const reversedEntities = [...parade.entities].reverse();
    const clickedEntity = reversedEntities.find(ent => {
        let size = ENTITY_SIZE_MAP[ent.type] || 1;
        if (ent.type === EntityType.SALUTING_BASE) size = 4;
        
        const hitRadius = Math.max(size/2, 0.5); 
        const dist = Math.sqrt(Math.pow(ent.x - clickPaces.x, 2) + Math.pow(ent.y - clickPaces.y, 2));
        return dist <= hitRadius;
    });

    if (clickedEntity) {
        // ... (Entity Selection Logic) ...
        let relatedIds = [clickedEntity.id];
        if (clickedEntity.groupId) {
            relatedIds = parade.entities
                .filter(ent => ent.groupId === clickedEntity.groupId)
                .map(ent => ent.id);
        }

        let newSelectedIds = [...selectedIds];
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
             const isAlreadySelected = selectedIds.includes(clickedEntity.id);
             if (isAlreadySelected) {
                 newSelectedIds = selectedIds.filter(id => !relatedIds.includes(id));
             } else {
                 const toAdd = relatedIds.filter(id => !selectedIds.includes(id));
                 newSelectedIds = [...selectedIds, ...toAdd];
             }
        } else {
             // Standard Click: Select Group if available, else individual
             newSelectedIds = relatedIds;
        }
        
        onSelectionChange(newSelectedIds);
        setIsDragging(true);
        setDragStart(clickPaces);
        
        let anchorId = clickedEntity.id;
        if (clickedEntity.groupId) {
            const groupEntities = parade.entities.filter(ent => ent.groupId === clickedEntity.groupId);
            const leader = groupEntities.find(ent => ent.type === EntityType.OFFICER) || 
                           groupEntities.find(ent => ent.type === EntityType.RSM) ||
                           groupEntities[0];
            if (leader) anchorId = leader.id;
        }
        setDragAnchorId(anchorId);
        
        const initialPos = new Map<string, Coordinates>();
        parade.entities.forEach(ent => {
            if (newSelectedIds.includes(ent.id)) {
                initialPos.set(ent.id, { x: ent.x, y: ent.y });
            }
        });
        setInitialEntityPositions(initialPos);
        
    } else {
        if (!(e.metaKey || e.ctrlKey || e.shiftKey)) {
            onSelectionChange([]);
        }
        setIsBoxSelecting(true);
        setSelectionBox({ start: clickPaces, current: clickPaces });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tool === 'PAN' && isDragging && panStart) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
    }

    const currentPaces = getPacesFromEvent(e);
    
    if (isDragging && draggingActionId && onUpdateAction) {
        let targetX = currentPaces.x;
        let targetY = currentPaces.y;
        
        if (snapToGrid) {
            targetX = Math.round(targetX * 2) / 2;
            targetY = Math.round(targetY * 2) / 2;
        }
        
        // Update Action Payload
        onUpdateAction(draggingActionId, {
            payload: {
                targetX, targetY
            } // We need to preserve other payload data if necessary, but Partial handles merge
        });
        
        return;
    }

    if (isBoxSelecting && selectionBox) {
        setSelectionBox(prev => prev ? { ...prev, current: currentPaces } : null);
        return;
    }

    if (isDragging && dragStart && selectedIds.length > 0) {
        const rawDeltaX = currentPaces.x - dragStart.x;
        const rawDeltaY = currentPaces.y - dragStart.y;

        let effectiveDeltaX = rawDeltaX;
        let effectiveDeltaY = rawDeltaY;

        if (snapToGrid && dragAnchorId && initialEntityPositions.has(dragAnchorId)) {
            const anchorInit = initialEntityPositions.get(dragAnchorId)!;
            const rawAnchorX = anchorInit.x + rawDeltaX;
            const rawAnchorY = anchorInit.y + rawDeltaY;

            const snappedAnchorX = Math.round(rawAnchorX * 2) / 2;
            const snappedAnchorY = Math.round(rawAnchorY * 2) / 2;

            effectiveDeltaX = snappedAnchorX - anchorInit.x;
            effectiveDeltaY = snappedAnchorY - anchorInit.y;
        } else if (snapToGrid) {
             effectiveDeltaX = Math.round(rawDeltaX * 2) / 2;
             effectiveDeltaY = Math.round(rawDeltaY * 2) / 2;
        }

        let minDx = -Infinity;
        let maxDx = Infinity;
        let minDy = -Infinity;
        let maxDy = Infinity;

        selectedIds.forEach(id => {
            const init = initialEntityPositions.get(id);
            if (init) {
                minDx = Math.max(minDx, -init.x);
                maxDx = Math.min(maxDx, parade.config.width - init.x);
                minDy = Math.max(minDy, -init.y);
                maxDy = Math.min(maxDy, parade.config.height - init.y);
            }
        });

        effectiveDeltaX = Math.max(minDx, Math.min(maxDx, effectiveDeltaX));
        effectiveDeltaY = Math.max(minDy, Math.min(maxDy, effectiveDeltaY));

        const updatedEntities = parade.entities.map(ent => {
            if (initialEntityPositions.has(ent.id)) {
                const init = initialEntityPositions.get(ent.id)!;
                return { ...ent, x: init.x + effectiveDeltaX, y: init.y + effectiveDeltaY };
            }
            return ent;
        });
        onEntitiesChange(updatedEntities);
    }
  };

  const handleMouseUp = () => {
    if (isBoxSelecting && selectionBox) {
        const minX = Math.min(selectionBox.start.x, selectionBox.current.x);
        const maxX = Math.max(selectionBox.start.x, selectionBox.current.x);
        const minY = Math.min(selectionBox.start.y, selectionBox.current.y);
        const maxY = Math.max(selectionBox.start.y, selectionBox.current.y);

        const entitiesInBox = parade.entities.filter(ent => {
             return ent.x >= minX && ent.x <= maxX && ent.y >= minY && ent.y <= maxY;
        });

        const groupsToSelect = new Set<string>();
        entitiesInBox.forEach(ent => {
            if (ent.groupId) groupsToSelect.add(ent.groupId);
        });

        const newSelectedIds = parade.entities.filter(ent => {
            const inBox = ent.x >= minX && ent.x <= maxX && ent.y >= minY && ent.y <= maxY;
            const inGroup = ent.groupId && groupsToSelect.has(ent.groupId);
            return inBox || inGroup;
        }).map(e => e.id);

        onSelectionChange(newSelectedIds);
    }

    setIsDragging(false);
    setDragStart(null);
    setDragAnchorId(null);
    setPanStart(null);
    setIsBoxSelecting(false);
    setSelectionBox(null);
    setDraggingActionId(null);
    setInitialEntityPositions(new Map());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!droppedEntityType) return;

    const coords = getPacesFromEvent(e);
    let snapX = coords.x;
    let snapY = coords.y;

    if (snapToGrid) {
        snapX = Math.round(snapX * 2) / 2;
        snapY = Math.round(snapY * 2) / 2;
    }

    snapX = Math.max(0, Math.min(parade.config.width, snapX));
    snapY = Math.max(0, Math.min(parade.config.height, snapY));

    const newEntities: Entity[] = [];
    let newGroups: Record<string, GroupMetadata> | undefined = undefined;

    if (droppedEntityType === EntityType.CONTINGENT) {
        const rows = 3;
        const cols = 9;
        const spacing = 1; 
        const groupId = crypto.randomUUID();

        newGroups = {
            [groupId]: {
                id: groupId,
                label: 'Contingent',
                showLabel: false,
                type: 'CONTINGENT',
                rotation: 0,
                config: { rows, cols }
            }
        };

        const formationWidth = (cols - 1) * spacing;
        const startX = snapX - (formationWidth / 2);
        const startY = snapY;

        newEntities.push({
            id: crypto.randomUUID(),
            type: EntityType.OFFICER,
            label: '',
            x: snapX,
            y: snapY - 3,
            rotation: 0,
            groupId
        });

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                newEntities.push({
                    id: crypto.randomUUID(),
                    type: EntityType.TROOPER,
                    label: '',
                    x: startX + (c * spacing),
                    y: startY + (r * spacing),
                    rotation: 0,
                    groupId
                });
            }
        }
    } else if (droppedEntityType === EntityType.COLOURS) {
        const groupId = crypto.randomUUID();
        newGroups = {
            [groupId]: {
                id: groupId,
                label: 'Colours Party',
                showLabel: false,
                type: 'COLOURS_PARTY',
                rotation: 0,
                config: { 
                    colourCount: 1,
                    flagColors: ['#EF4444']
                }
            }
        };

        newEntities.push({ id: crypto.randomUUID(), type: EntityType.COLOURS, label: 'Ensign', x: snapX, y: snapY, rotation: 0, groupId });
        newEntities.push({ id: crypto.randomUUID(), type: EntityType.TROOPER, label: 'Escort', x: snapX - 1.5, y: snapY, rotation: 0, groupId });
        newEntities.push({ id: crypto.randomUUID(), type: EntityType.TROOPER, label: 'Escort', x: snapX + 1.5, y: snapY, rotation: 0, groupId });
        newEntities.push({ id: crypto.randomUUID(), type: EntityType.RSM, label: 'CSM', x: snapX, y: snapY + 2, rotation: 0, groupId });

    } else {
        let label = '';
        if (droppedEntityType === EntityType.SALUTING_BASE) label = 'Saluting Base';
        else if (droppedEntityType === EntityType.ROSTRUM) label = 'Rostrum';
        else if (droppedEntityType === EntityType.REVIEWING_OFFICER) label = 'Reviewing Officer';
        else if (droppedEntityType === EntityType.AWARD_TABLE) label = 'Award Table';

        newEntities.push({
            id: crypto.randomUUID(),
            type: droppedEntityType,
            label: label,
            x: snapX,
            y: snapY,
            rotation: 0
        });
    }

    onEntitiesChange([...parade.entities, ...newEntities], newGroups);
    onSelectionChange(newEntities.map(e => e.id));
    onDropComplete();
  };

  const groupLabels = useMemo(() => {
    const labels: { id: string, label: string, x: number, y: number }[] = [];
    if (!parade.groups) return labels;

    const grouped: Record<string, Entity[]> = {};
    parade.entities.forEach(ent => {
        if (ent.groupId) {
            if (!grouped[ent.groupId]) grouped[ent.groupId] = [];
            grouped[ent.groupId].push(ent);
        }
    });

    Object.keys(grouped).forEach(groupId => {
        const groupMeta = parade.groups[groupId];
        if (!groupMeta || !groupMeta.showLabel) return;
        const members = grouped[groupId];
        if (members.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        members.forEach(m => {
            if (m.x < minX) minX = m.x;
            if (m.x > maxX) maxX = m.x;
            if (m.y < minY) minY = m.y;
            if (m.y > maxY) maxY = m.y;
        });

        labels.push({
            id: groupId,
            label: groupMeta.label,
            x: (minX + maxX) / 2,
            y: minY - 2 
        });
    });

    return labels;
  }, [parade.entities, parade.groups]);

  // --- Rendering ---
  const renderGrid = () => {
    const lines = [];
    for (let x = 0; x <= parade.config.width; x++) {
      const isMajor = x % GRID_MAJOR_INTERVAL === 0;
      lines.push(
        <line 
          key={`v-${x}`}
          x1={x * PIXELS_PER_PACE} y1={0}
          x2={x * PIXELS_PER_PACE} y2={parade.config.height * PIXELS_PER_PACE}
          stroke={isMajor ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"}
          strokeWidth={isMajor ? 2 : 1}
        />
      );
    }
    for (let y = 0; y <= parade.config.height; y++) {
      const isMajor = y % GRID_MAJOR_INTERVAL === 0;
      lines.push(
        <line 
          key={`h-${y}`}
          x1={0} y1={y * PIXELS_PER_PACE}
          x2={parade.config.width * PIXELS_PER_PACE} y2={y * PIXELS_PER_PACE}
          stroke={isMajor ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"}
          strokeWidth={isMajor ? 2 : 1}
        />
      );
    }
    return <g id="grid-layer" pointerEvents="none">{lines}</g>;
  };

  const renderPaths = () => {
    // Only render paths for items with animation tracks
    if (!showPaths || !parade.animation?.tracks) return null;
    
    return (
        <g id="paths-layer">
            {Object.keys(parade.animation.tracks).map(ownerId => {
                const track = parade.animation.tracks[ownerId];
                // Check if group
                const group = parade.groups[ownerId];
                let currentX = 0, currentY = 0;

                if (group) {
                    // Logic for groups: Find "Anchor" (Leader) initial position
                    // We need to look at entities
                    const members = parade.entities.filter(e => e.groupId === ownerId);
                    if (members.length === 0) return null;
                    
                    // Prefer Officer, then any member
                    const anchor = members.find(m => m.type === EntityType.OFFICER) || members[0];
                    currentX = anchor.x;
                    currentY = anchor.y;
                } else {
                    // Single Entity Path
                    const entity = parade.entities.find(e => e.id === ownerId);
                    if (!entity) return null;
                    currentX = entity.x;
                    currentY = entity.y;
                }

                const pathSegments: React.ReactElement[] = [];
                
                track.actions.forEach(action => {
                    if (action.type === 'MOVE') {
                        const targetX = action.payload.targetX ?? currentX;
                        const targetY = action.payload.targetY ?? currentY;
                        
                        const isSelected = action.id === selectedActionId;

                        pathSegments.push(
                            <line 
                                key={action.id}
                                x1={currentX * PIXELS_PER_PACE}
                                y1={currentY * PIXELS_PER_PACE}
                                x2={targetX * PIXELS_PER_PACE}
                                y2={targetY * PIXELS_PER_PACE}
                                stroke={isSelected ? "#34d399" : "rgba(255, 255, 0, 0.4)"}
                                strokeWidth={isSelected ? "3" : "2"}
                                strokeDasharray="4 2"
                            />
                        );
                        
                        pathSegments.push(
                            <circle 
                                key={`${action.id}-end`}
                                cx={targetX * PIXELS_PER_PACE}
                                cy={targetY * PIXELS_PER_PACE}
                                r={isSelected ? 6 : 4}
                                fill={isSelected ? "#34d399" : "yellow"}
                                stroke="black"
                                strokeWidth={1}
                                className={isSelected ? "cursor-move" : ""} // Hint draggable
                            />
                        );

                        currentX = targetX;
                        currentY = targetY;
                    }
                });

                return <g key={`path-${ownerId}`}>{pathSegments}</g>;
            })}
        </g>
    );
  };

  const renderEntity = (ent: Entity) => {
    const isSelected = selectedIds.includes(ent.id);
    const pixelX = ent.x * PIXELS_PER_PACE;
    const pixelY = ent.y * PIXELS_PER_PACE;
    
    const group = ent.groupId ? parade.groups[ent.groupId] : undefined;
    const isColoursParty = group?.type === 'COLOURS_PARTY';
    
    let customColor = undefined;
    if (isColoursParty && ent.type === EntityType.COLOURS && group?.config?.flagColors) {
         const match = ent.label.match(/Ensign\s?(\d*)/);
         let index = 0;
         if (match) {
             const num = parseInt(match[1]);
             if (!isNaN(num)) index = num - 1;
             else index = 0;
         }
         if (index >= 0 && index < group.config.flagColors.length) {
             customColor = group.config.flagColors[index];
         }
    }

    const visual = renderEntityVisual(ent.type, ent.label, customColor);
    
    const hideLabel = isColoursParty || 
                      ent.label === 'Colours Sgt' || 
                      ent.type === EntityType.SALUTING_BASE || 
                      ent.type === EntityType.TROPHY_CUP ||
                      ent.type === EntityType.TROPHY_PLAQUE ||
                      ent.type === EntityType.TROPHY_SHIELD;

    // IMPORTANT: When isPlaying is true, disable transition to prevent "lag" or "swimming" effect 
    // as the position updates every frame.
    return (
        <g 
            key={ent.id}
            transform={`translate(${pixelX}, ${pixelY})`}
            className="cursor-move"
            onDoubleClick={handleDoubleClick}
            style={{ transition: (isDragging || isPlaying) ? 'none' : 'transform 0.1s' }}
        >
            {isSelected && <circle r={PIXELS_PER_PACE * (ent.type === EntityType.SALUTING_BASE ? 3 : 0.8)} fill={SELECTION_COLOR} fillOpacity={0.3} />}
            <g transform={`rotate(${ent.rotation})`}>
                {visual}
            </g>
            {ent.label && !hideLabel && (
                <text 
                    y={-PIXELS_PER_PACE * 0.9} 
                    textAnchor="middle" 
                    fill="white" 
                    fontSize={10} 
                    className="select-none pointer-events-none drop-shadow-md font-bold bg-black/50 px-1 rounded"
                    style={{ textShadow: '0px 1px 2px black' }}
                >
                    {ent.label}
                </text>
            )}
        </g>
    );
  };

  return (
    <div className="w-full h-full overflow-hidden bg-gray-900 relative">
      <svg
        id="parade-canvas-svg"
        ref={svgRef}
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ cursor: tool === 'PAN' ? 'grab' : 'default' }}
      >
        <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${scale})`}>
          <rect 
            x={0} y={0} 
            width={parade.config.width * PIXELS_PER_PACE} 
            height={parade.config.height * PIXELS_PER_PACE} 
            fill={TERRAIN_COLORS[parade.config.terrain]}
          />
          {renderGrid()}
          {renderPaths()}
          {parade.entities.map(renderEntity)}
          {groupLabels.map(g => (
              <text
                key={`grp-${g.id}`}
                x={g.x * PIXELS_PER_PACE}
                y={g.y * PIXELS_PER_PACE}
                textAnchor="middle"
                fill="rgba(255, 255, 255, 0.7)"
                fontSize={12 * Math.max(1, 1/scale)}
                fontFamily="monospace"
                fontWeight="bold"
                className="select-none pointer-events-none"
              >
                  {g.label.toUpperCase()}
              </text>
          ))}
          {isBoxSelecting && selectionBox && (
             <rect
                x={Math.min(selectionBox.start.x, selectionBox.current.x) * PIXELS_PER_PACE}
                y={Math.min(selectionBox.start.y, selectionBox.current.y) * PIXELS_PER_PACE}
                width={Math.abs(selectionBox.current.x - selectionBox.start.x) * PIXELS_PER_PACE}
                height={Math.abs(selectionBox.current.y - selectionBox.start.y) * PIXELS_PER_PACE}
                fill={BOX_SELECT_FILL}
                stroke={BOX_SELECT_BORDER}
                strokeWidth={2}
                strokeDasharray="8 4"
             />
          )}
        </g>
      </svg>
      <div className="absolute bottom-4 left-4 text-xs text-gray-400 select-none bg-black/50 p-2 rounded z-10 pointer-events-none">
        {Math.round(parade.config.width)}x{Math.round(parade.config.height)} Paces | Scale: {Math.round(scale * 100)}%
      </div>
    </div>
  );
};

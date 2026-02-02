
import React, { useRef, useState, useMemo } from 'react';
import { Entity, ParadeState, Coordinates, EntityType, GroupMetadata, AnimationAction, AnimationTrack, AnchorPosition } from '../types';
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
  // New prop for handling drop logic in parent
  onObjectDrop?: (type: EntityType, x: number, y: number) => void;
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
  isPlaying = false,
  onObjectDrop
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Coordinates | null>(null); // In Paces
  const [dragAnchorId, setDragAnchorId] = useState<string | null>(null); // To calculate relative snap
  const [panStart, setPanStart] = useState<{ x: number, y: number } | null>(null); // In Pixels (Client)
  
  // Animation Path Dragging State
  const [draggingActionId, setDraggingActionId] = useState<string | null>(null);
  const [draggingWaypointActionId, setDraggingWaypointActionId] = useState<string | null>(null);
  
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
         const actions = Object.values(parade.animation.tracks).flatMap((t: AnimationTrack) => t.actions);
         const targetAction = actions.find(a => a.id === selectedActionId);
         
         if (targetAction && targetAction.type === 'MOVE') {
             // 1. Check Target Handle
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
             
             // 2. Check Waypoint/Elbow Handle
             if (targetAction.payload.movePathMode !== 'DIRECT') {
                 // Determine where the handle currently IS
                 let handleX = 0, handleY = 0;
                 if (targetAction.payload.waypoint) {
                     handleX = targetAction.payload.waypoint.x;
                     handleY = targetAction.payload.waypoint.y;
                 } else {
                     // Default calculation if no explicit waypoint is set but we are orthogonal
                     // We need approximate start position for hit testing default elbow,
                     // but to keep it simple, we only hit test if the renderer drew the rect.
                     // The renderer logic below ensures the rect is drawn at the right spot.
                 }
                 
                 // Fallback check if we have explicit waypoint
                 if (targetAction.payload.waypoint) {
                     const distW = Math.sqrt(Math.pow(handleX - clickPaces.x, 2) + Math.pow(handleY - clickPaces.y, 2));
                     if (distW < 0.5) {
                         setDraggingWaypointActionId(selectedActionId);
                         setIsDragging(true);
                         return;
                     }
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
    
    // Handle Path End Point Dragging
    if (isDragging && draggingActionId && onUpdateAction) {
        let targetX = currentPaces.x;
        let targetY = currentPaces.y;
        
        if (snapToGrid) {
            targetX = Math.round(targetX * 2) / 2;
            targetY = Math.round(targetY * 2) / 2;
        }
        
        onUpdateAction(draggingActionId, {
            payload: { targetX, targetY } 
        });
        return;
    }

    // Handle Path Waypoint Dragging
    if (isDragging && draggingWaypointActionId && onUpdateAction) {
        let wx = currentPaces.x;
        let wy = currentPaces.y;
        
        if (snapToGrid) {
            wx = Math.round(wx * 2) / 2;
            wy = Math.round(wy * 2) / 2;
        }

        // We need to fetch current payload to preserve other fields?
        // onUpdateAction is Partial merge, but payload is a nested object, so we must be careful.
        // Usually React state updates are shallow merge on top level. 
        // PropertiesPanel implementation of `onUpdateAction` does:
        // `const proposed = { ...track.actions[actionIndex], ...updates };`
        // But `updates.payload` will overwrite `track.actions[actionIndex].payload` if we aren't careful.
        // The implementation in Simulator.tsx:
        // `onUpdateAction(draggingActionId, { payload: { targetX, targetY } })`
        // We need to make sure we don't wipe existing payload data.
        // Simulator.tsx `handleUpdateAction` implementation: 
        // It does `newActions[actionIndex] = { ...newActions[actionIndex], ...updates };`
        // If updates contains `payload`, it overwrites the whole payload object? 
        // Check Simulator.tsx: `const proposed = { ...track.actions[actionIndex], ...updates };`
        // Yes, if we pass `payload: { waypoint }`, we lose `targetX` etc.
        // WE MUST merge the payload manually in the `onUpdateAction` call here, 
        // OR fix Simulator.tsx to deep merge payload.
        // Fix: In Simulator.tsx, we rely on the caller to provide full payload update or we fix Simulator.
        // Looking at PropertiesPanel: it does `onUpdateAction(..., { payload: { ...selectedAction.payload, [key]: value } })`.
        // So we should do the same here. We need the current action to merge payload.
        
        // Find the action
        const actions = Object.values(parade.animation.tracks).flatMap((t: AnimationTrack) => t.actions);
        const action = actions.find(a => a.id === draggingWaypointActionId);
        
        if (action) {
            onUpdateAction(draggingWaypointActionId, {
                payload: { ...action.payload, waypoint: { x: wx, y: wy } }
            });
        }
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
    setDraggingWaypointActionId(null);
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

    // Delegate creation to parent
    if (onObjectDrop) {
        onObjectDrop(droppedEntityType, snapX, snapY);
    }
    
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

  // --- Helper to calculate Anchor Position from Group ---
  const getAnchorPos = (entities: Entity[], groupId: string, anchorType: AnchorPosition = 'TL') => {
      const members = entities.filter(e => e.groupId === groupId);
      if (members.length === 0) return { x: 0, y: 0 };
      
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      members.forEach(m => {
          if (m.x < minX) minX = m.x;
          if (m.x > maxX) maxX = m.x;
          if (m.y < minY) minY = m.y;
          if (m.y > maxY) maxY = m.y;
      });

      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      let ax = minX, ay = minY;
      if (anchorType.includes('M') || anchorType === 'C') ax = midX;
      if (anchorType.includes('R')) ax = maxX;
      if (anchorType.includes('C') || anchorType.includes('CL') || anchorType.includes('CR')) ay = midY;
      if (anchorType.includes('B')) ay = maxY;

      return { x: ax, y: ay };
  };

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
                const track: AnimationTrack = parade.animation.tracks[ownerId];
                // Check if group
                const group = parade.groups[ownerId];
                let currentX = 0, currentY = 0;

                if (group) {
                    const members = parade.entities.filter(e => e.groupId === ownerId);
                    if (members.length === 0) return null;
                    
                    const firstAction = track.actions[0];
                    const anchorPos = getAnchorPos(parade.entities, ownerId, firstAction?.payload.groupAnchor || 'TL');
                    currentX = anchorPos.x;
                    currentY = anchorPos.y;
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
                        const strokeColor = isSelected ? "#34d399" : "rgba(255, 255, 0, 0.4)";
                        
                        // Check if we have an explicit waypoint
                        if (action.payload.waypoint) {
                            const wx = action.payload.waypoint.x;
                            const wy = action.payload.waypoint.y;
                            
                            pathSegments.push(
                                <polyline
                                    key={`${action.id}-poly-waypoint`}
                                    points={`${currentX * PIXELS_PER_PACE},${currentY * PIXELS_PER_PACE} ${wx * PIXELS_PER_PACE},${wy * PIXELS_PER_PACE} ${targetX * PIXELS_PER_PACE},${targetY * PIXELS_PER_PACE}`}
                                    fill="none"
                                    stroke={strokeColor}
                                    strokeWidth={isSelected ? "3" : "2"}
                                    strokeDasharray="4 2"
                                />
                            );
                            
                            if (isSelected) {
                                pathSegments.push(
                                    <rect
                                        key={`${action.id}-elbow`}
                                        x={wx * PIXELS_PER_PACE - 4}
                                        y={wy * PIXELS_PER_PACE - 4}
                                        width={8}
                                        height={8}
                                        fill="#3b82f6"
                                        stroke="white"
                                        className="cursor-move"
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            setDraggingWaypointActionId(action.id);
                                            setIsDragging(true);
                                        }}
                                    >
                                        <title>Drag Pre-Destination Waypoint</title>
                                    </rect>
                                );
                            }

                        } 
                        // Orthogonal Handling (Default L-Shape unless DIRECT is explicitly set)
                        else if (action.payload.movePathMode !== 'DIRECT') {
                            // Draw L shape
                            let midX, midY;
                            if (action.payload.orthogonalOrder === 'Y_THEN_X') {
                                // Vertical then Horizontal
                                midX = currentX;
                                midY = targetY;
                            } else {
                                // Horizontal then Vertical (Default)
                                midX = targetX;
                                midY = currentY;
                            }

                            pathSegments.push(
                                <polyline
                                    key={`${action.id}-poly`}
                                    points={`${currentX * PIXELS_PER_PACE},${currentY * PIXELS_PER_PACE} ${midX * PIXELS_PER_PACE},${midY * PIXELS_PER_PACE} ${targetX * PIXELS_PER_PACE},${targetY * PIXELS_PER_PACE}`}
                                    fill="none"
                                    stroke={strokeColor}
                                    strokeWidth={isSelected ? "3" : "2"}
                                    strokeDasharray="4 2"
                                />
                            );

                            // Draggable Elbow Handle (Only if selected)
                            if (isSelected && onUpdateAction) {
                                pathSegments.push(
                                    <rect
                                        key={`${action.id}-elbow`}
                                        x={midX * PIXELS_PER_PACE - 4}
                                        y={midY * PIXELS_PER_PACE - 4}
                                        width={8}
                                        height={8}
                                        fill="#3b82f6"
                                        stroke="white"
                                        className="cursor-move"
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            // Initialize waypoint to current elbow pos to start dragging
                                            onUpdateAction(action.id, { 
                                                payload: { 
                                                    ...action.payload, 
                                                    waypoint: { x: midX, y: midY }
                                                } 
                                            });
                                            setDraggingWaypointActionId(action.id);
                                            setIsDragging(true);
                                        }}
                                    >
                                        <title>Drag to create Pre-Destination</title>
                                    </rect>
                                );
                            }

                        } else {
                            // Direct Line - No Draggable Handle!
                            pathSegments.push(
                                <line 
                                    key={action.id}
                                    x1={currentX * PIXELS_PER_PACE}
                                    y1={currentY * PIXELS_PER_PACE}
                                    x2={targetX * PIXELS_PER_PACE}
                                    y2={targetY * PIXELS_PER_PACE}
                                    stroke={strokeColor}
                                    strokeWidth={isSelected ? "3" : "2"}
                                    strokeDasharray="4 2"
                                />
                            );
                        }
                        
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

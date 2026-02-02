
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ParadeState, Entity, EntityType, GroupMetadata, AnimationAction, AnimationTrack } from '../types';
import { saveParade } from '../services/storageService';
import { SpritePanel } from './SpritePanel';
import { PropertiesPanel } from './PropertiesPanel';
import { ParadeCanvas } from './ParadeCanvas';
import { NotchBar } from './NotchBar';
import { TimelinePanel } from './TimelinePanel';
import { ExportModal } from './ExportModal';
import { ColoursConfigModal } from './ColoursConfigModal';
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, PIXELS_PER_PACE } from '../constants';
import { getParadeStateAtTime } from '../utils/animationUtils';
import { Download, Clock, CircleHelp } from 'lucide-react';

interface SimulatorProps {
  initialState: ParadeState;
  onExit: () => void;
}

export const Simulator: React.FC<SimulatorProps> = ({ initialState, onExit }) => {
  // Ensure animation object exists (migration)
  const fullInitialState: ParadeState = {
      ...initialState,
      groups: initialState.groups || {},
      animation: initialState.animation || { duration: 60, tracks: {} }
  };

  const [history, setHistory] = useState<ParadeState[]>([fullInitialState]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [scale, setScale] = useState(DEFAULT_ZOOM);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [tool, setTool] = useState<'SELECT' | 'PAN'>('SELECT');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [isSpritePanelOpen, setSpritePanelOpen] = useState(true);
  const [isPropertiesPanelOpen, setPropertiesPanelOpen] = useState(true);
  const [droppedEntityType, setDroppedEntityType] = useState<EntityType | null>(null);

  // Animation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showPaths, setShowPaths] = useState(true); 
  
  // Export Modal State
  const [isExportModalOpen, setExportModalOpen] = useState(false);

  // Colours Party Modal State
  const [isColoursModalOpen, setColoursModalOpen] = useState(false);
  const [pendingDropLocation, setPendingDropLocation] = useState<{x: number, y: number} | null>(null);

  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const currentState = history[historyIndex];

  // Calculated State for Playback
  const displayState = useMemo(() => {
      // Always calculate interpolated state if time > 0 OR if we are just previewing a specific timestamp while paused
      if (currentTime > 0) {
          return {
              ...currentState,
              ...getParadeStateAtTime(currentState, currentTime)
          };
      }
      return currentState;
  }, [currentState, currentTime]);

  // --- Animation Loop ---
  useEffect(() => {
      if (isPlaying) {
          lastFrameTimeRef.current = performance.now();
          const loop = (timestamp: number) => {
              const delta = (timestamp - lastFrameTimeRef.current) / 1000;
              lastFrameTimeRef.current = timestamp;
              
              setCurrentTime(prev => {
                  const next = prev + delta;
                  if (next >= currentState.animation.duration) {
                      setIsPlaying(false);
                      return currentState.animation.duration;
                  }
                  return next;
              });
              
              animationRef.current = requestAnimationFrame(loop);
          };
          animationRef.current = requestAnimationFrame(loop);
      } else {
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
          lastFrameTimeRef.current = 0;
      }
      return () => {
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
  }, [isPlaying, currentState.animation.duration]);


  const getCanvasDimensions = useCallback(() => {
      const sidebarWidth = isSpritePanelOpen ? 256 : 0; 
      const propPanelWidth = isPropertiesPanelOpen ? 256 : 0;
      const headerHeight = 48; // Header bar
      const timelineHeight = 256; // Fixed height of timeline
      const availableWidth = window.innerWidth - sidebarWidth - propPanelWidth;
      const availableHeight = window.innerHeight - headerHeight - timelineHeight;
      return { width: availableWidth, height: availableHeight };
  }, [isSpritePanelOpen, isPropertiesPanelOpen]);

  const centerCanvas = useCallback(() => {
    const { width: availableWidth, height: availableHeight } = getCanvasDimensions();
    const margin = 50;
    const paradePixelWidth = currentState.config.width * PIXELS_PER_PACE;
    const paradePixelHeight = currentState.config.height * PIXELS_PER_PACE;
    const scaleX = (availableWidth - margin * 2) / paradePixelWidth;
    const scaleY = (availableHeight - margin * 2) / paradePixelHeight;
    const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), MIN_ZOOM), MAX_ZOOM);
    const centeredX = (availableWidth - (paradePixelWidth * fitScale)) / 2;
    const centeredY = (availableHeight - (paradePixelHeight * fitScale)) / 2;
    setScale(fitScale);
    setPanOffset({ x: centeredX, y: centeredY });
  }, [currentState.config.width, currentState.config.height, getCanvasDimensions]);

  useEffect(() => {
    centerCanvas();
  }, [initialState.config.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
        centerCanvas();
    }, 50); 
    return () => clearTimeout(timer);
  }, [isSpritePanelOpen, isPropertiesPanelOpen, centerCanvas]);

  const pushState = (newState: ParadeState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    saveParade(newState);
  };

  const handleStateChange = (updates: Partial<ParadeState>) => {
      pushState({
          ...currentState,
          ...updates,
          config: { ...currentState.config, lastModified: Date.now() }
      });
  };

  const handleUpdateEntities = (updates: Partial<Entity>[]) => {
      const newEntities = currentState.entities.map(ent => {
          const update = updates.find(u => u.id === ent.id);
          return update ? { ...ent, ...update } : ent;
      });
      handleStateChange({ entities: newEntities });
  };

  const handleDelete = () => {
      const newEntities = currentState.entities.filter(e => !selectedIds.includes(e.id));
      
      const newTracks = { ...currentState.animation.tracks };
      let tracksModified = false;

      selectedIds.forEach(id => {
          if (newTracks[id]) {
              delete newTracks[id];
              tracksModified = true;
          }
      });
      
      const groupsToCheck = new Set<string>();
      currentState.entities.forEach(e => {
          if (selectedIds.includes(e.id) && e.groupId) {
              groupsToCheck.add(e.groupId);
          }
      });

      groupsToCheck.forEach(groupId => {
          const members = currentState.entities.filter(e => e.groupId === groupId);
          const allMembersDeleted = members.every(m => selectedIds.includes(m.id));
          if (allMembersDeleted) {
              if (newTracks[groupId]) {
                  delete newTracks[groupId];
                  tracksModified = true;
              }
          }
      });

      const newGroups = { ...currentState.groups };
      groupsToCheck.forEach(groupId => {
           const members = currentState.entities.filter(e => e.groupId === groupId);
           const allMembersDeleted = members.every(m => selectedIds.includes(m.id));
           if (allMembersDeleted) {
               delete newGroups[groupId];
           }
      });

      pushState({
          ...currentState,
          entities: newEntities,
          groups: newGroups,
          animation: tracksModified ? { ...currentState.animation, tracks: newTracks } : currentState.animation,
          config: { ...currentState.config, lastModified: Date.now() }
      });
      
      setSelectedIds([]);
  };

  // --- Animation Handlers ---

  const handleAddAction = (ownerId: string, type: 'MOVE' | 'TURN' | 'WHEEL') => {
      const track: AnimationTrack = currentState.animation.tracks[ownerId] || { ownerId, actions: [] };
      
      // Calculate valid start time (prevent overlap)
      const duration = 2;
      let startTime = currentTime;
      const sortedActions = [...track.actions].sort((a, b) => a.startTime - b.startTime);
      
      // Find a slot. If current time overlaps, assume we want to append after the overlapping action.
      let finding = true;
      while (finding) {
          const overlap = sortedActions.find(a => {
              const sA = startTime;
              const eA = startTime + duration;
              const sB = a.startTime;
              const eB = a.startTime + a.duration;
              return sA < eB && eA > sB;
          });
          
          if (overlap) {
              startTime = overlap.startTime + overlap.duration;
          } else {
              finding = false;
          }
      }

      // Calculate state at START TIME to ensure continuity and prevent displacement
      const stateAtStart = getParadeStateAtTime(currentState, startTime);
      let currentX = 0, currentY = 0, currentRot = 0;

      if (currentState.groups[ownerId]) {
          // It's a group
          const members = stateAtStart.entities.filter(e => e.groupId === ownerId);
          // Find anchor (Officer or first)
          const anchor = members.find(m => m.type === EntityType.OFFICER) || members[0];
          if (anchor) {
              currentX = anchor.x;
              currentY = anchor.y;
              // Group rotation logic: 
              const grp = stateAtStart.groups[ownerId];
              currentRot = grp ? grp.rotation : 0;
          }
      } else {
          // It's an entity
          const ent = stateAtStart.entities.find(e => e.id === ownerId);
          if (ent) {
              currentX = ent.x;
              currentY = ent.y;
              currentRot = ent.rotation;
          }
      }
      
      // Guard against NaN
      if (!isFinite(currentX)) currentX = 0;
      if (!isFinite(currentY)) currentY = 0;
      if (!isFinite(currentRot)) currentRot = 0;

      const newAction: AnimationAction = {
          id: crypto.randomUUID(),
          type,
          startTime,
          duration,
          payload: {}
      };

      // Set defaults based on type AND current state
      if (type === 'MOVE') {
          newAction.payload.targetX = currentX + 5;
          newAction.payload.targetY = currentY;
          newAction.payload.movePathMode = 'ORTHOGONAL';
          newAction.payload.orthogonalOrder = 'X_THEN_Y';
      } else if (type === 'TURN') {
          // Default to current rotation + 90 so it visibly does something relative to now
          newAction.payload.targetRotation = (currentRot + 90) % 360;
      } else if (type === 'WHEEL') {
          newAction.payload.wheelAngle = 90;
          // Default to Center pivot to avoid wild swinging if TL is far from center
          newAction.payload.pivotCorner = 'CENTER'; 
      }

      const newTracks = {
          ...currentState.animation.tracks,
          [ownerId]: {
              ...track,
              actions: [...track.actions, newAction]
          }
      };

      handleStateChange({ 
          animation: { ...currentState.animation, tracks: newTracks }
      });
      setSelectedActionId(newAction.id);
  };

  const handleDeleteAction = (ownerId: string, actionId: string) => {
      const track: AnimationTrack | undefined = currentState.animation.tracks[ownerId];
      if (!track) return;
      
      const newTracks = {
          ...currentState.animation.tracks,
          [ownerId]: {
              ...track,
              actions: track.actions.filter(a => a.id !== actionId)
          }
      };
       handleStateChange({ 
          animation: { ...currentState.animation, tracks: newTracks }
      });
      if (selectedActionId === actionId) setSelectedActionId(null);
  };

  const handleDeleteSelectedAction = () => {
      if (!selectedActionId) return;
      // Find owner of current selection
      let ownerId = '';
      for (const [oid, t] of Object.entries(currentState.animation.tracks)) {
          const track = t as AnimationTrack;
          if (track.actions.some(a => a.id === selectedActionId)) {
              ownerId = oid;
              break;
          }
      }
      if (ownerId) handleDeleteAction(ownerId, selectedActionId);
  };

  const handleUpdateAction = (actionId: string, updates: Partial<AnimationAction>) => {
      // Find track
      let ownerId = '';
      let actionIndex = -1;
      
      Object.entries(currentState.animation.tracks).forEach(([oid, t]) => {
          const track = t as AnimationTrack;
          const idx = track.actions.findIndex(a => a.id === actionId);
          if (idx !== -1) {
              ownerId = oid;
              actionIndex = idx;
          }
      });

      if (!ownerId) return;
      const track = currentState.animation.tracks[ownerId];

      // Check Overlap if timing changes
      if (updates.startTime !== undefined || updates.duration !== undefined) {
          const proposed = { ...track.actions[actionIndex], ...updates };
          const hasOverlap = track.actions.some(a => {
              if (a.id === actionId) return false;
              const sA = proposed.startTime;
              const eA = proposed.startTime + proposed.duration;
              const sB = a.startTime;
              const eB = a.startTime + a.duration;
              return sA < eB && eA > sB; // Strict overlap check
          });
          
          if (hasOverlap) return; // Prevent update
      }

      const newActions = [...track.actions];
      // Merge payload deeply if provided, otherwise standard shallow merge
      if (updates.payload) {
          newActions[actionIndex] = {
              ...newActions[actionIndex],
              ...updates,
              payload: { ...newActions[actionIndex].payload, ...updates.payload }
          };
      } else {
          newActions[actionIndex] = { ...newActions[actionIndex], ...updates };
      }

      const newTracks = {
          ...currentState.animation.tracks,
          [ownerId]: { ...track, actions: newActions }
      };

      handleStateChange({ 
          animation: { ...currentState.animation, tracks: newTracks }
      });
  };
  
  const handleTrackReorder = (newOrder: string[]) => {
      handleStateChange({
          animation: { ...currentState.animation, trackOrder: newOrder }
      });
  };

  const handleSelectAction = (action: AnimationAction | null) => {
      setSelectedActionId(action ? action.id : null);
      
      if (action) {
          // Find the owner ID of this action to select the sprite
          const ownerId = Object.keys(currentState.animation.tracks).find(oid => 
              currentState.animation.tracks[oid].actions.some(a => a.id === action.id)
          );
          if (ownerId) {
              setSelectedIds([ownerId]);
          }
      }
  };

  // --- Group Logic ---
  const handleGroup = () => {
      if (selectedIds.length < 2) return;
      const groupId = crypto.randomUUID();
      const newGroup: GroupMetadata = {
          id: groupId,
          label: 'New Group',
          showLabel: true,
          type: 'GENERIC',
          rotation: 0
      };
      const newEntities = currentState.entities.map(ent => {
          if (selectedIds.includes(ent.id)) return { ...ent, groupId };
          return ent;
      });
      pushState({
          ...currentState,
          entities: newEntities,
          groups: { ...currentState.groups, [groupId]: newGroup },
          config: { ...currentState.config, lastModified: Date.now() }
      });
  };

  const handleUngroup = () => {
      const selectedEntities = currentState.entities.filter(e => selectedIds.includes(e.id));
      const newTracks = { ...currentState.animation.tracks };
      let tracksModified = false;
      const groupsToCheckForEmpty = new Set<string>();

      // 1. Process each selected individual
      selectedEntities.forEach(ent => {
          if (ent.groupId) {
              groupsToCheckForEmpty.add(ent.groupId);
              const groupTrack = newTracks[ent.groupId];
              
              // Bake animations if group had any
              if (groupTrack && groupTrack.actions.length > 0) {
                   if (!newTracks[ent.id]) {
                       newTracks[ent.id] = { ownerId: ent.id, actions: [] };
                   }
                   
                   groupTrack.actions.forEach(action => {
                        const endTime = action.startTime + action.duration;
                        const stateAtEnd = getParadeStateAtTime(currentState, endTime);
                        const memberEndState = stateAtEnd.entities.find(e => e.id === ent.id);
                        
                        if (memberEndState) {
                             const moveAction: AnimationAction = {
                                 id: crypto.randomUUID(),
                                 type: 'MOVE',
                                 startTime: action.startTime,
                                 duration: action.duration,
                                 payload: {
                                     targetX: memberEndState.x,
                                     targetY: memberEndState.y,
                                     movePathMode: action.payload.movePathMode,
                                     orthogonalOrder: action.payload.orthogonalOrder,
                                     waypoint: action.payload.waypoint
                                 }
                             };
                             newTracks[ent.id].actions.push(moveAction);

                             if (action.type === 'TURN' || action.type === 'WHEEL') {
                                 const turnAction: AnimationAction = {
                                     id: crypto.randomUUID(),
                                     type: 'TURN',
                                     startTime: action.startTime,
                                     duration: action.duration,
                                     payload: {
                                         targetRotation: memberEndState.rotation
                                     }
                                 };
                                 newTracks[ent.id].actions.push(turnAction);
                             }
                        }
                   });
                   tracksModified = true;
              }
          }
      });

      // 2. Remove groupId from selected entities
      const newEntities = currentState.entities.map(ent => {
          if (selectedIds.includes(ent.id)) {
              return { ...ent, groupId: undefined };
          }
          return ent;
      });

      // 3. Clean up empty groups
      const newGroups = { ...currentState.groups };
      groupsToCheckForEmpty.forEach(gid => {
          const membersLeft = newEntities.filter(e => e.groupId === gid);
          if (membersLeft.length === 0) {
              delete newGroups[gid];
              if (newTracks[gid]) {
                  delete newTracks[gid];
                  tracksModified = true;
              }
          }
      });

      pushState({
        ...currentState,
        entities: newEntities,
        groups: newGroups,
        animation: tracksModified ? { ...currentState.animation, tracks: newTracks } : currentState.animation,
        config: { ...currentState.config, lastModified: Date.now() }
      });
  };
  
  const handleUpdateGroup = (id: string, updates: Partial<GroupMetadata>) => {
      const currentGroup = currentState.groups[id];
      if (!currentGroup) return;

      const newMeta = { ...currentGroup, ...updates };
      if (updates.config && currentGroup.config) {
          newMeta.config = { ...currentGroup.config, ...updates.config };
      }
      
      let newEntities = [...currentState.entities];
      let hasRegenerated = false;

      const isRigidType = currentGroup.type === 'CONTINGENT' || currentGroup.type === 'COLOURS_PARTY';
      const isStructuralChange = isRigidType && (
          updates.config?.rows !== undefined || 
          updates.config?.cols !== undefined || 
          updates.config?.hasColoursSergeant !== undefined || 
          updates.config?.colourCount !== undefined ||
          updates.rotation !== undefined
      );

      // (Logic for Colour Count adjustment remains same)
      if (currentGroup.type === 'COLOURS_PARTY' && updates.config?.colourCount !== undefined) {
          const newCount = updates.config.colourCount;
          const currentColors = currentGroup.config?.flagColors || [];
          let newColors = [...currentColors];
          if (newCount > currentColors.length) {
              const toAdd = newCount - currentColors.length;
              for(let i=0; i<toAdd; i++) newColors.push('#EF4444');
          } else if (newCount < currentColors.length) {
              newColors = newColors.slice(0, newCount);
          }
          if (!newMeta.config) newMeta.config = {};
          newMeta.config.flagColors = newColors;
      }

      if (isStructuralChange) {
           hasRegenerated = true;
           const groupEntities = newEntities.filter(e => e.groupId === id);
           if (groupEntities.length === 0) return;
           const officer = groupEntities.find(e => e.type === EntityType.OFFICER);
           const anchorX = officer ? officer.x : groupEntities[0].x;
           const anchorY = officer ? officer.y : groupEntities[0].y;
           const rotation = newMeta.rotation; 
           newEntities = newEntities.filter(e => e.groupId !== id);

           // ... (Entity Regeneration Logic matches existing) ...
           if (newMeta.type === 'CONTINGENT' && newMeta.config) {
               const rows = newMeta.config.rows || 3;
               const cols = newMeta.config.cols || 9;
               const hasColoursSergeant = newMeta.config.hasColoursSergeant || false;
               const spacing = 1;
               newEntities.push({ id: crypto.randomUUID(), type: EntityType.OFFICER, label: '', x: anchorX, y: anchorY, rotation, groupId: id });
               const formationWidth = (cols - 1) * spacing;
               const startY = anchorY + 3;
               const startX = anchorX - (formationWidth / 2);
               for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        newEntities.push({ id: crypto.randomUUID(), type: EntityType.TROOPER, label: '', x: startX + (c * spacing), y: startY + (r * spacing), rotation, groupId: id });
                    }
               }
               if (hasColoursSergeant) {
                    newEntities.push({ id: crypto.randomUUID(), type: EntityType.TROOPER, label: 'Colours Sgt', x: startX - 1, y: startY, rotation, groupId: id });
                    newEntities.push({ id: crypto.randomUUID(), type: EntityType.TROOPER, label: 'Colours Sgt', x: startX + ((cols - 1) * spacing) + 1, y: startY, rotation, groupId: id });
               }
          } else if (newMeta.type === 'COLOURS_PARTY' && newMeta.config) {
               const count = newMeta.config.colourCount || 1;
               const spacing = 1.5;
               if (count === 1) {
                   newEntities.push({ id: crypto.randomUUID(), type: EntityType.COLOURS, label: 'Ensign', x: anchorX, y: anchorY, rotation, groupId: id });
                   newEntities.push({ id: crypto.randomUUID(), type: EntityType.TROOPER, label: 'Escort', x: anchorX - 1.5, y: anchorY, rotation, groupId: id });
                   newEntities.push({ id: crypto.randomUUID(), type: EntityType.TROOPER, label: 'Escort', x: anchorX + 1.5, y: anchorY, rotation, groupId: id });
                   newEntities.push({ id: crypto.randomUUID(), type: EntityType.RSM, label: 'CSM', x: anchorX, y: anchorY + 2, rotation, groupId: id });
               } else {
                   const width = (count - 1) * spacing;
                   const startX = anchorX - (width / 2);
                   for(let i=0; i<count; i++) newEntities.push({ id: crypto.randomUUID(), type: EntityType.COLOURS, label: `Ensign ${i+1}`, x: startX + (i * spacing), y: anchorY, rotation, groupId: id });
                   for(let i=0; i<count; i++) newEntities.push({ id: crypto.randomUUID(), type: EntityType.TROOPER, label: `Escort ${i+1}`, x: startX + (i * spacing), y: anchorY + 1, rotation, groupId: id });
                   newEntities.push({ id: crypto.randomUUID(), type: EntityType.RSM, label: 'CSM', x: anchorX, y: anchorY + 1 + 2, rotation, groupId: id });
               }
          }
          if (rotation !== 0) {
              const rad = (rotation * Math.PI) / 180;
              const cos = Math.cos(rad);
              const sin = Math.sin(rad);
              newEntities = newEntities.map(ent => {
                  if (ent.groupId === id && ent.id !== officer?.id) { 
                      const dx = ent.x - anchorX;
                      const dy = ent.y - anchorY;
                      return { ...ent, x: anchorX + (dx * cos - dy * sin), y: anchorY + (dx * sin + dy * cos) };
                  }
                  return ent;
              });
          }
      } else if (currentGroup.type === 'GENERIC' && updates.rotation !== undefined) {
           const oldRot = currentGroup.rotation || 0;
           const members = newEntities.filter(e => e.groupId === id);
           if (members.length > 0) {
               const minX = Math.min(...members.map(e => e.x));
               const maxX = Math.max(...members.map(e => e.x));
               const minY = Math.min(...members.map(e => e.y));
               const maxY = Math.max(...members.map(e => e.y));
               const centerX = (minX + maxX) / 2;
               const centerY = (minY + maxY) / 2;

               const deltaRot = (updates.rotation - oldRot) * (Math.PI / 180);
               const cos = Math.cos(deltaRot);
               const sin = Math.sin(deltaRot);
               
               newEntities = newEntities.map(ent => {
                   if (ent.groupId === id) {
                       const dx = ent.x - centerX;
                       const dy = ent.y - centerY;
                       return {
                           ...ent,
                           x: centerX + (dx * cos - dy * sin),
                           y: centerY + (dx * sin + dy * cos),
                           rotation: (ent.rotation + (updates.rotation! - oldRot)) % 360
                       };
                   }
                   return ent;
               });
           }
      }

      // CRITICAL FIX: Ensure selection is updated BEFORE pushing state to avoid Property Panel closing/resetting
      // We calculate new IDs and update selection immediately.
      // Since pushState updates history synchronously, next render will have both new entities and new selection.
      if (hasRegenerated) {
          const newGroupIds = newEntities.filter(e => e.groupId === id).map(e => e.id);
          setSelectedIds(newGroupIds);
      }
      
      pushState({
          ...currentState,
          entities: newEntities,
          groups: { ...currentState.groups, [id]: newMeta },
          config: { ...currentState.config, lastModified: Date.now() }
      });
  };

  const handleZoom = (delta: number) => {
      setScale(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  };

  // Revert to fit to screen
  const handleResetZoom = () => {
      centerCanvas();
  };

  const handleUndo = () => {
      if (historyIndex > 0) setHistoryIndex(prev => prev - 1);
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) setHistoryIndex(prev => prev + 1);
  };

  const handleSave = () => {
      saveParade(currentState);
      alert('Parade saved successfully!');
  };

  // --- Object Drop Handler ---
  const handleObjectDrop = (type: EntityType, x: number, y: number) => {
      if (type === EntityType.COLOURS) {
          setPendingDropLocation({ x, y });
          setColoursModalOpen(true);
      } else {
          // Immediate creation for non-configured entities
          createEntities(type, x, y);
      }
      setDroppedEntityType(null);
  };

  const handleColoursConfigConfirm = (count: number, colors: string[]) => {
      if (pendingDropLocation) {
          createEntities(EntityType.COLOURS, pendingDropLocation.x, pendingDropLocation.y, { count, colors });
      }
      setColoursModalOpen(false);
      setPendingDropLocation(null);
  };

  const createEntities = (type: EntityType, x: number, y: number, config?: any) => {
      const newEntities: Entity[] = [];
      let newGroups = { ...currentState.groups };
      const newSelectedIds: string[] = [];

      if (type === EntityType.CONTINGENT) {
        const rows = 3;
        const cols = 9;
        const spacing = 1; 
        const groupId = crypto.randomUUID();

        newGroups[groupId] = {
            id: groupId,
            label: 'Contingent',
            showLabel: false,
            type: 'CONTINGENT',
            rotation: 0,
            config: { rows, cols }
        };

        const formationWidth = (cols - 1) * spacing;
        const startX = x - (formationWidth / 2);
        const startY = y;

        // Officer
        const offId = crypto.randomUUID();
        newEntities.push({ id: offId, type: EntityType.OFFICER, label: '', x: x, y: y - 3, rotation: 0, groupId });
        newSelectedIds.push(offId);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tid = crypto.randomUUID();
                newEntities.push({ id: tid, type: EntityType.TROOPER, label: '', x: startX + (c * spacing), y: startY + (r * spacing), rotation: 0, groupId });
                newSelectedIds.push(tid);
            }
        }
    } else if (type === EntityType.COLOURS) {
        const groupId = crypto.randomUUID();
        const count = config?.count || 1;
        const colors = config?.colors || ['#EF4444'];
        
        newGroups[groupId] = {
            id: groupId,
            label: 'Colours Party',
            showLabel: false,
            type: 'COLOURS_PARTY',
            rotation: 0,
            config: { 
                colourCount: count,
                flagColors: colors
            }
        };

        const spacing = 1.5;
        let startX = x;
        if (count > 1) {
            const width = (count - 1) * spacing;
            startX = x - (width / 2);
        }

        // Ensigns
        for(let i=0; i<count; i++) {
            const eid = crypto.randomUUID();
            newEntities.push({ id: eid, type: EntityType.COLOURS, label: count > 1 ? `Ensign ${i+1}` : 'Ensign', x: startX + (i * spacing), y: y, rotation: 0, groupId });
            newSelectedIds.push(eid);
        }
        
        // Escorts (simplified logic: if 1 colour -> 2 escorts. if multiple -> flankers)
        // Replicating standard logic: 1 colour = L/R escort. Multiple = L/R escort for line.
        // Let's stick to standard party formation: Ensigns in line, Escorts flanking whole line?
        // Logic from previous: Flankers on each ensign? No, standard is usually line of colours with escorts.
        // Re-using the generation logic from updateGroup roughly:
        
        // Front Row: Escort, [Colours...], Escort
        // Using slightly wider spacing for escorts
        const escortLeftId = crypto.randomUUID();
        newEntities.push({ id: escortLeftId, type: EntityType.TROOPER, label: 'Escort', x: startX - 1.5, y: y, rotation: 0, groupId });
        newSelectedIds.push(escortLeftId);
        
        const escortRightId = crypto.randomUUID();
        newEntities.push({ id: escortRightId, type: EntityType.TROOPER, label: 'Escort', x: startX + ((count-1) * spacing) + 1.5, y: y, rotation: 0, groupId });
        newSelectedIds.push(escortRightId);

        // Rear: CSM
        const csmId = crypto.randomUUID();
        newEntities.push({ id: csmId, type: EntityType.RSM, label: 'CSM', x: x, y: y + 2, rotation: 0, groupId });
        newSelectedIds.push(csmId);

    } else {
        let label = '';
        if (type === EntityType.SALUTING_BASE) label = 'Saluting Base';
        else if (type === EntityType.ROSTRUM) label = 'Rostrum';
        else if (type === EntityType.REVIEWING_OFFICER) label = 'Reviewing Officer';
        else if (type === EntityType.HOST) label = 'Host';
        else if (type === EntityType.AWARD_TABLE) label = 'Award Table';
        else if (type === EntityType.ORDERLY) label = 'Orderly';

        const id = crypto.randomUUID();
        newEntities.push({
            id,
            type: type,
            label: label,
            x: x,
            y: y,
            rotation: 0
        });
        newSelectedIds.push(id);
    }

    pushState({
        ...currentState,
        entities: [...currentState.entities, ...newEntities],
        groups: newGroups,
        config: { ...currentState.config, lastModified: Date.now() }
    });
    setSelectedIds(newSelectedIds);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (isInput) return;
            if (selectedActionId) {
                 handleDeleteSelectedAction();
            } else {
                handleDelete();
            }
        }
        
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            if (isInput) return;
            e.preventDefault();
            e.shiftKey ? handleRedo() : handleUndo();
        }
        
        // Tool Toggle (Ctrl)
        if (e.key === 'Control' && !e.repeat) {
             setTool(prev => prev === 'PAN' ? 'SELECT' : 'PAN');
        }

        // Play/Pause (Space)
        if (e.key === ' ' && !isInput) {
             e.preventDefault();
             setIsPlaying(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [historyIndex, selectedIds, selectedActionId, tool, isPlaying, currentState]);

  const selectedEntities = currentState.entities.filter(ent => selectedIds.includes(ent.id));
  const selectedAction = selectedActionId 
    ? (Object.values(currentState.animation.tracks) as AnimationTrack[])
        .flatMap(t => t.actions)
        .find(a => a.id === selectedActionId) 
    : undefined;
    
  const lastModified = new Date(currentState.config.lastModified).toLocaleString();

  return (
    <div className="flex h-screen w-screen overflow-hidden text-white font-sans bg-gray-950">
      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setExportModalOpen(false)}
        parade={displayState}
      />
      
      <ColoursConfigModal 
        isOpen={isColoursModalOpen}
        onClose={() => { setColoursModalOpen(false); setPendingDropLocation(null); }}
        onConfirm={handleColoursConfigConfirm}
      />

      <SpritePanel 
        isOpen={isSpritePanelOpen}
        onToggle={() => setSpritePanelOpen(!isSpritePanelOpen)}
        onDragStart={setDroppedEntityType}
      />

      <div className="flex-1 flex flex-col relative bg-black overflow-hidden">
        {/* Header Bar */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 z-20 shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                <button 
                    onClick={onExit}
                    className="text-xs px-3 py-1 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700 hover:text-white text-gray-400 transition-colors"
                >
                    ← Exit
                </button>
                <h1 className="font-bold text-gray-200 tracking-wide">{currentState.config.title}</h1>
                <button 
                    onClick={() => setExportModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1 text-xs bg-blue-900/50 text-blue-300 border border-blue-800 rounded hover:bg-blue-800 hover:text-white transition-colors"
                >
                    <Download className="w-3 h-3" /> Export Layout
                </button>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Keyboard Shortcuts Tooltip */}
                <div className="group relative flex items-center">
                    <div className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-gray-800 cursor-help transition-colors">
                        <CircleHelp className="w-5 h-5" />
                    </div>
                    {/* Tooltip Content */}
                    <div className="absolute top-full right-0 mt-2 w-64 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-700 pb-1">Shortcuts</h3>
                        <div className="space-y-1.5 text-xs text-gray-300">
                            <div className="flex justify-between"><span>Pan Tool</span> <span className="font-mono text-gray-500">Hold Space</span></div>
                            <div className="flex justify-between"><span>Toggle Tool</span> <span className="font-mono text-gray-500">Ctrl</span></div>
                            <div className="flex justify-between"><span>Multi-Select</span> <span className="font-mono text-gray-500">Shift+Click</span></div>
                            <div className="flex justify-between"><span>Delete</span> <span className="font-mono text-gray-500">Del/Bksp</span></div>
                            <div className="flex justify-between"><span>Undo</span> <span className="font-mono text-gray-500">Ctrl+Z</span></div>
                            <div className="flex justify-between"><span>Redo</span> <span className="font-mono text-gray-500">Ctrl+Shift+Z</span></div>
                            <div className="flex justify-between"><span>Play/Pause</span> <span className="font-mono text-gray-500">Space</span></div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>Last Saved: {lastModified}</span>
                </div>
            </div>
        </div>

        <div className="flex-1 relative overflow-hidden bg-gray-950">
             <NotchBar 
                tool={tool} setTool={setTool}
                snapToGrid={snapToGrid} setSnapToGrid={setSnapToGrid}
                scale={scale}
                onZoom={handleZoom}
                onResetZoom={handleResetZoom}
                onCenterCanvas={centerCanvas}
                onUndo={handleUndo} 
                onRedo={handleRedo}
                onSave={handleSave}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
                showPaths={showPaths}
                setShowPaths={setShowPaths}
             />
             <ParadeCanvas 
                parade={displayState}
                selectedIds={selectedIds}
                snapToGrid={snapToGrid}
                scale={scale}
                panOffset={panOffset}
                setPanOffset={setPanOffset}
                onSelectionChange={setSelectedIds}
                onEntitiesChange={(ents, grps) => {
                    const updates: Partial<ParadeState> = { entities: ents };
                    if (grps) updates.groups = { ...currentState.groups, ...grps };
                    handleStateChange(updates);
                }}
                droppedEntityType={droppedEntityType}
                onDropComplete={() => setDroppedEntityType(null)}
                tool={tool}
                showPaths={showPaths}
                selectedActionId={selectedActionId}
                onUpdateAction={handleUpdateAction}
                isPlaying={isPlaying}
                onObjectDrop={handleObjectDrop}
             />
        </div>

        <TimelinePanel 
            parade={currentState}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onStop={() => { setIsPlaying(false); setCurrentTime(0); }}
            onSeek={setCurrentTime}
            onAddAction={handleAddAction}
            onUpdateAction={(oid, aid, u) => handleUpdateAction(aid, u)}
            onDeleteAction={handleDeleteAction}
            onSelectAction={handleSelectAction}
            selectedActionId={selectedActionId}
            onTrackReorder={handleTrackReorder}
        />
      </div>

      <PropertiesPanel 
        isOpen={isPropertiesPanelOpen}
        onToggle={() => setPropertiesPanelOpen(!isPropertiesPanelOpen)}
        selectedEntities={selectedEntities}
        groups={currentState.groups}
        onUpdate={handleUpdateEntities}
        onDelete={handleDelete}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
        onUpdateGroup={handleUpdateGroup}
        selectedAction={selectedAction}
        onUpdateAction={handleUpdateAction}
        onDeleteAction={handleDeleteSelectedAction}
      />
    </div>
  );
};


import { Entity, ParadeState, AnimationAction, GroupMetadata, AnchorPosition } from '../types';

// Helper to ease values
const lerp = (start: number, end: number, t: number) => {
  const s = Number.isFinite(start) ? start : 0;
  const e = Number.isFinite(end) ? end : s;
  const ratio = Math.max(0, Math.min(1, t));
  return s + (e - s) * ratio;
};

// Calculate the state of all entities at a specific time t
export const getParadeStateAtTime = (baseState: ParadeState, time: number): { entities: Entity[], groups: Record<string, GroupMetadata> } => {
    // 1. Deep copy initial state (Time = 0) to avoid mutating history
    let currentEntities = baseState.entities.map(e => ({ 
        ...e,
        x: Number.isFinite(e.x) ? e.x : 0,
        y: Number.isFinite(e.y) ? e.y : 0,
        rotation: Number.isFinite(e.rotation) ? e.rotation : 0
    }));
    let currentGroups = JSON.parse(JSON.stringify(baseState.groups));

    // 2. Identify all track owners
    const trackIds = Object.keys(baseState.animation.tracks);

    // 3. Process tracks
    trackIds.forEach(ownerId => {
        const track = baseState.animation.tracks[ownerId];
        if (!track || !track.actions.length) return;

        // Sort actions by start time
        const actions = [...track.actions].sort((a, b) => a.startTime - b.startTime);

        // Check if this owner is a Group
        const isGroup = !!baseState.groups[ownerId];

        if (isGroup) {
            applyGroupTransform(currentEntities, ownerId, actions, time);
            return;
        }

        // --- Single Entity Logic ---
        const entity = currentEntities.find(e => e.id === ownerId);
        if (!entity) return; // Track exists for non-existent entity, skip

        // Initialize trackers with the entity's base position (Time 0)
        let currentX = entity.x;
        let currentY = entity.y;
        let currentRot = entity.rotation;

        for (const action of actions) {
            // Optimization: If action starts after current time, we don't process it, 
            // BUT we must process all previous actions fully to get the correct start point for this frame.
            // However, since we re-calculate from Time 0 every frame, we must process everything up to `time`.
            if (time < action.startTime) break;

            const duration = Math.max(0.001, action.duration); // Prevent div by zero
            const progress = (time - action.startTime) / duration;
            const clampedProgress = Math.max(0, Math.min(1, progress));
            
            // Capture state at start of this action (inherited from previous actions)
            const startX = currentX;
            const startY = currentY;
            const startRot = currentRot;

            if (action.type === 'MOVE') {
                // Determine target, defaulting to start if undefined to prevent jumping to 0
                const targetX = Number.isFinite(action.payload.targetX) ? action.payload.targetX! : startX;
                const targetY = Number.isFinite(action.payload.targetY) ? action.payload.targetY! : startY;

                // Move Logic
                if (action.payload.waypoint) {
                    const wx = Number.isFinite(action.payload.waypoint.x) ? action.payload.waypoint.x : startX;
                    const wy = Number.isFinite(action.payload.waypoint.y) ? action.payload.waypoint.y : startY;
                    
                    const d1 = Math.sqrt(Math.pow(wx - startX, 2) + Math.pow(wy - startY, 2));
                    const d2 = Math.sqrt(Math.pow(targetX - wx, 2) + Math.pow(targetY - wy, 2));
                    const totalDist = d1 + d2;
                    
                    if (totalDist <= 0.001) {
                        currentX = targetX;
                        currentY = targetY;
                    } else {
                        const splitPoint = d1 / totalDist;
                        if (clampedProgress <= splitPoint) {
                            const p = splitPoint === 0 ? 1 : clampedProgress / splitPoint;
                            currentX = lerp(startX, wx, p);
                            currentY = lerp(startY, wy, p);
                        } else {
                            const p = (clampedProgress - splitPoint) / (1 - splitPoint);
                            currentX = lerp(wx, targetX, p);
                            currentY = lerp(wy, targetY, p);
                        }
                    }
                } else if (action.payload.movePathMode === 'DIRECT') {
                    currentX = lerp(startX, targetX, clampedProgress);
                    currentY = lerp(startY, targetY, clampedProgress);
                } else {
                    // Orthogonal
                    const distX = targetX - startX;
                    const distY = targetY - startY;
                    const totalDist = Math.abs(distX) + Math.abs(distY);
                    
                    if (totalDist <= 0.001) {
                        currentX = targetX;
                        currentY = targetY;
                    } else {
                        const fracX = Math.abs(distX) / totalDist;
                        if (action.payload.orthogonalOrder === 'Y_THEN_X') {
                             const fracY = Math.abs(distY) / totalDist;
                             if (clampedProgress < fracY) {
                                 currentX = startX;
                                 currentY = lerp(startY, targetY, clampedProgress / fracY);
                             } else {
                                 currentX = lerp(startX, targetX, (clampedProgress - fracY) / (1 - fracY));
                                 currentY = targetY;
                             }
                        } else {
                            // X Then Y
                            if (clampedProgress < fracX) {
                                currentX = lerp(startX, targetX, clampedProgress / fracX);
                                currentY = startY;
                            } else {
                                currentX = targetX;
                                currentY = lerp(startY, targetY, (clampedProgress - fracX) / (1 - fracX));
                            }
                        }
                    }
                }
            } else if (action.type === 'TURN') {
                const targetRot = Number.isFinite(action.payload.targetRotation) ? action.payload.targetRotation! : startRot;
                currentRot = lerp(startRot, targetRot, clampedProgress);
                // IMPORTANT: Do NOT touch currentX/currentY here. They retain values from `startX/startY`.
            } else if (action.type === 'WHEEL') {
                // Single entity wheeling (orbiting a point)
                 const angle = action.payload.wheelAngle || 90;
                 const rad = (angle * (Math.PI / 180)) * clampedProgress;
                 const cos = Math.cos(rad);
                 const sin = Math.sin(rad);

                 // Pivot defaults to entity center if not specified? 
                 // For single entity, wheel usually means rotate around a point.
                 // If pivotCorner is CENTER, it just rotates in place (like Turn).
                 // We need a pivot point relative to entity.
                 // Assuming pivot is (0,0) relative to entity for now unless we add 'Pivot Point' to payload.
                 // Effectively TURN for single entity unless we implement complex pivot logic.
                 // For safety, behave like TURN + rotation around self.
                 currentRot += angle * clampedProgress;
            }
        }

        // Write back final calculated state
        if (Number.isFinite(currentX)) entity.x = currentX;
        if (Number.isFinite(currentY)) entity.y = currentY;
        if (Number.isFinite(currentRot)) entity.rotation = currentRot;
    });

    return { entities: currentEntities, groups: currentGroups };
};

// Helper to apply group transformations
const applyGroupTransform = (entities: Entity[], groupId: string, actions: AnimationAction[], time: number) => {
    // Get group members in the mutable array
    const members = entities.filter(e => e.groupId === groupId);
    if (members.length === 0) return;

    // Track state of members relative to Time 0
    const memberState = new Map<string, { x: number, y: number, rot: number }>();
    members.forEach(e => {
        memberState.set(e.id, { 
            x: Number.isFinite(e.x) ? e.x : 0, 
            y: Number.isFinite(e.y) ? e.y : 0, 
            rot: Number.isFinite(e.rotation) ? e.rotation : 0 
        });
    });

    for (const action of actions) {
        if (time < action.startTime) break;

        const duration = Math.max(0.001, action.duration);
        const progress = Math.min(1, Math.max(0, (time - action.startTime) / duration));
        
        if (action.type === 'MOVE') {
             // Calculate Bounding Box of CURRENT state (start of this action)
             let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
             for (const s of memberState.values()) {
                 if (s.x < minX) minX = s.x;
                 if (s.x > maxX) maxX = s.x;
                 if (s.y < minY) minY = s.y;
                 if (s.y > maxY) maxY = s.y;
             }
             
             if (!Number.isFinite(minX)) { minX=0; maxX=0; minY=0; maxY=0; }
             
             const anchorType = action.payload.groupAnchor || 'TL';
             let startAnchorX = minX;
             let startAnchorY = minY;

             const midX = (minX + maxX) / 2;
             const midY = (minY + maxY) / 2;
             if (anchorType.includes('M') || anchorType === 'C') startAnchorX = midX;
             if (anchorType.includes('R')) startAnchorX = maxX;
             if (anchorType.includes('C') || anchorType.includes('CL') || anchorType.includes('CR')) startAnchorY = midY;
             if (anchorType.includes('B')) startAnchorY = maxY;

             const targetX = Number.isFinite(action.payload.targetX) ? action.payload.targetX! : startAnchorX;
             const targetY = Number.isFinite(action.payload.targetY) ? action.payload.targetY! : startAnchorY;

             let currentAnchorX = startAnchorX;
             let currentAnchorY = startAnchorY;
             
             // Reuse interpolation logic logic (simplified)
             if (action.payload.waypoint) {
                  const wx = Number.isFinite(action.payload.waypoint.x) ? action.payload.waypoint.x : startAnchorX;
                  const wy = Number.isFinite(action.payload.waypoint.y) ? action.payload.waypoint.y : startAnchorY;
                  
                  const d1 = Math.sqrt(Math.pow(wx - startAnchorX, 2) + Math.pow(wy - startAnchorY, 2));
                  const d2 = Math.sqrt(Math.pow(targetX - wx, 2) + Math.pow(targetY - wy, 2));
                  const total = d1 + d2;
                  if (total > 0.001) {
                      const split = d1/total;
                      if (progress <= split) {
                          const p = split===0?1:progress/split;
                          currentAnchorX = lerp(startAnchorX, wx, p);
                          currentAnchorY = lerp(startAnchorY, wy, p);
                      } else {
                          const p = (progress-split)/(1-split);
                          currentAnchorX = lerp(wx, targetX, p);
                          currentAnchorY = lerp(wy, targetY, p);
                      }
                  }
             } else if (action.payload.movePathMode === 'DIRECT') {
                 currentAnchorX = lerp(startAnchorX, targetX, progress);
                 currentAnchorY = lerp(startAnchorY, targetY, progress);
             } else {
                 // Orthogonal
                 const dx = targetX - startAnchorX;
                 const dy = targetY - startAnchorY;
                 const td = Math.abs(dx) + Math.abs(dy);
                 if (td > 0.001) {
                     const fx = Math.abs(dx)/td;
                     if (action.payload.orthogonalOrder === 'Y_THEN_X') {
                         const fy = Math.abs(dy)/td;
                         if (progress < fy) {
                             currentAnchorY = lerp(startAnchorY, targetY, progress/fy);
                         } else {
                             currentAnchorY = targetY;
                             currentAnchorX = lerp(startAnchorX, targetX, (progress-fy)/(1-fy));
                         }
                     } else {
                         if (progress < fx) {
                             currentAnchorX = lerp(startAnchorX, targetX, progress/fx);
                         } else {
                             currentAnchorX = targetX;
                             currentAnchorY = lerp(startAnchorY, targetY, (progress-fx)/(1-fx));
                         }
                     }
                 }
             }

             const deltaX = currentAnchorX - startAnchorX;
             const deltaY = currentAnchorY - startAnchorY;

             if (Number.isFinite(deltaX) && Number.isFinite(deltaY)) {
                for (const s of memberState.values()) {
                    s.x += deltaX;
                    s.y += deltaY;
                }
             }
        }
        else if (action.type === 'TURN') {
            const first = memberState.values().next().value;
            const startRot = first ? first.rot : 0;
            const targetRot = Number.isFinite(action.payload.targetRotation) ? action.payload.targetRotation! : startRot;
            const deltaRot = (targetRot - startRot) * progress;
            
            if (Number.isFinite(deltaRot)) {
                for (const s of memberState.values()) {
                    s.rot += deltaRot;
                }
            }
        }
        else if (action.type === 'WHEEL') {
            const angle = action.payload.wheelAngle || 90;
            const rad = (angle * (Math.PI / 180)) * progress;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            let pivotX = 0, pivotY = 0;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const s of memberState.values()) {
                minX = Math.min(minX, s.x);
                maxX = Math.max(maxX, s.x);
                minY = Math.min(minY, s.y);
                maxY = Math.max(maxY, s.y);
            }
            if (!Number.isFinite(minX)) { minX=0; maxX=0; minY=0; maxY=0; }

            if (action.payload.pivotCorner === 'CENTER') {
                 pivotX = (minX + maxX) / 2;
                 pivotY = (minY + maxY) / 2;
            } else if (action.payload.pivotCorner === 'BL') {
                 pivotX = minX; pivotY = maxY;
            } else if (action.payload.pivotCorner === 'BR') {
                 pivotX = maxX; pivotY = maxY;
            } else if (action.payload.pivotCorner === 'TR') {
                 pivotX = maxX; pivotY = minY;
            } else {
                 pivotX = minX; pivotY = minY;
            }

            for (const s of memberState.values()) {
                const dx = s.x - pivotX;
                const dy = s.y - pivotY;
                
                s.x = pivotX + (dx * cos - dy * sin);
                s.y = pivotY + (dx * sin + dy * cos);
                s.rot += angle * progress;
            }
        }
    }

    // Apply back
    members.forEach(m => {
        const state = memberState.get(m.id);
        if (state) {
            if(Number.isFinite(state.x)) m.x = state.x;
            if(Number.isFinite(state.y)) m.y = state.y;
            if(Number.isFinite(state.rot)) m.rotation = state.rot;
        }
    });
};

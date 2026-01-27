
import { Entity, ParadeState, AnimationAction, GroupMetadata } from '../types';

// Helper to ease values (Linear for now, can add ease-in-out later)
const lerp = (start: number, end: number, t: number) => {
  return start + (end - start) * Math.max(0, Math.min(1, t));
};

// Calculate the state of all entities at a specific time t
export const getParadeStateAtTime = (baseState: ParadeState, time: number): { entities: Entity[], groups: Record<string, GroupMetadata> } => {
    // 1. Deep copy initial state (Time = 0)
    let currentEntities = baseState.entities.map(e => ({ ...e }));
    let currentGroups = JSON.parse(JSON.stringify(baseState.groups));

    // 2. Identify all track owners (Groups or Individuals)
    const trackIds = Object.keys(baseState.animation.tracks);

    // 3. Process tracks
    trackIds.forEach(ownerId => {
        const track = baseState.animation.tracks[ownerId];
        const actions = [...track.actions].sort((a, b) => a.startTime - b.startTime);

        // Determine if owner is Group or Entity
        const isGroup = !!baseState.groups[ownerId];
        
        // Track the current logical position at the START of the next action
        // This is updated as we process completed actions.
        let currentX = isGroup ? 0 : (currentEntities.find(e => e.id === ownerId)?.x || 0);
        let currentY = isGroup ? 0 : (currentEntities.find(e => e.id === ownerId)?.y || 0);
        let currentRot = isGroup ? (currentGroups[ownerId]?.rotation || 0) : (currentEntities.find(e => e.id === ownerId)?.rotation || 0);

        // For Groups, we need special handling because "Position" is an abstract concept relative to members
        // The applyGroupTransform helper will handle member movement relative to their own start positions.
        if (isGroup) {
            applyGroupTransform(currentEntities, ownerId, baseState, time);
            return; // Done for group, continue to next track
        }

        // --- Single Entity Logic ---
        for (const action of actions) {
            // Check overlaps:
            // If time < action.startTime, this action hasn't started. 
            if (time < action.startTime) break;

            const progress = (time - action.startTime) / action.duration;
            const clampedProgress = Math.max(0, Math.min(1, progress));
            
            // Start State for THIS action is `currentX` (which holds end state of previous action)
            const startX = currentX;
            const startY = currentY;
            const startRot = currentRot;

            if (action.type === 'MOVE') {
                const targetX = action.payload.targetX ?? startX;
                const targetY = action.payload.targetY ?? startY;

                // Interpolate
                currentX = lerp(startX, targetX, clampedProgress);
                currentY = lerp(startY, targetY, clampedProgress);

            } else if (action.type === 'TURN') {
                const targetRot = action.payload.targetRotation ?? startRot;
                currentRot = lerp(startRot, targetRot, clampedProgress);
            }

            // If we are mid-action (progress < 1), this is the current active action.
            // We should stop applying subsequent actions because we are "in" this one.
            if (progress < 1) break;
        }

        // Apply calculated state to entity
        const entity = currentEntities.find(e => e.id === ownerId);
        if (entity) {
            entity.x = currentX;
            entity.y = currentY;
            entity.rotation = currentRot;
        }
    });

    return { entities: currentEntities, groups: currentGroups };
};

// Helper to apply group transformations
const applyGroupTransform = (entities: Entity[], groupId: string, baseState: ParadeState, time: number) => {
    const track = baseState.animation.tracks[groupId];
    if (!track) return;

    // Get group members in the mutable array
    const members = entities.filter(e => e.groupId === groupId);
    if (members.length === 0) return;

    // Actions sorted by time
    const actions = [...track.actions].sort((a, b) => a.startTime - b.startTime);

    // Track state of members. Initialized from base state.
    const memberState = new Map<string, { x: number, y: number, rot: number }>();
    baseState.entities.filter(e => e.groupId === groupId).forEach(e => {
        memberState.set(e.id, { x: e.x, y: e.y, rot: e.rotation });
    });

    // Helper to find Anchor (usually Officer/Leader) to calculate relative moves
    // We assume the anchor's position drives the group logic if targets are absolute
    const anchorId = members.find(m => m.type === 'OFFICER')?.id || members[0].id;

    for (const action of actions) {
        if (time < action.startTime) break;

        const progress = Math.min(1, Math.max(0, (time - action.startTime) / action.duration));
        
        if (action.type === 'MOVE') {
             // Calculate Delta for this specific action
             // We need the Anchor's position AT THE START of this action.
             // Since we update `memberState` sequentially, `memberState.get(anchorId)` currently holds the Start Position for this action.
             
             const currentAnchor = memberState.get(anchorId)!;
             const startX = currentAnchor.x;
             const startY = currentAnchor.y;
             
             // Target is absolute position of the Anchor
             const targetX = action.payload.targetX ?? startX;
             const targetY = action.payload.targetY ?? startY;

             // The total distance to move for this action
             const totalDeltaX = targetX - startX;
             const totalDeltaY = targetY - startY;

             // The amount to move RIGHT NOW based on progress
             const currentDeltaX = totalDeltaX * progress;
             const currentDeltaY = totalDeltaY * progress;

             for (const [id, s] of memberState.entries()) {
                 s.x += currentDeltaX;
                 s.y += currentDeltaY;
             }
        }
        else if (action.type === 'TURN') {
            const currentAnchor = memberState.get(anchorId)!;
            const startRot = currentAnchor.rot;
            const targetRot = action.payload.targetRotation ?? startRot;
            const deltaRot = (targetRot - startRot) * progress;
            
            for (const [id, s] of memberState.entries()) {
                s.rot += deltaRot;
            }
        }
        else if (action.type === 'WHEEL') {
            const angle = action.payload.wheelAngle || 90;
            const rad = (angle * (Math.PI / 180)) * progress;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            // Find Pivot based on CURRENT state (start of this action)
            // Note: Bounding box pivot calculation is expensive, simplified to Anchor or Min/Max
            let pivotX = 0, pivotY = 0;
            
            if (action.payload.pivotCorner === 'TL' || action.payload.pivotCorner === 'TR') {
                let minX = Infinity, maxX = -Infinity, minY = Infinity;
                for (const s of memberState.values()) {
                    minX = Math.min(minX, s.x);
                    maxX = Math.max(maxX, s.x);
                    minY = Math.min(minY, s.y);
                }
                pivotY = minY;
                pivotX = action.payload.pivotCorner === 'TL' ? minX : maxX;
            } else {
                // Default to Anchor/Center
                const anchor = memberState.get(anchorId)!;
                pivotX = anchor.x;
                pivotY = anchor.y;
            }

            for (const [id, s] of memberState.entries()) {
                const dx = s.x - pivotX;
                const dy = s.y - pivotY;
                
                s.x = pivotX + (dx * cos - dy * sin);
                s.y = pivotY + (dx * sin + dy * cos);
                s.rot += angle * progress;
            }
        }
        
        // If mid-action, stop processing subsequent actions
        if (progress < 1) break;
    }

    // Apply back to entity objects
    members.forEach(m => {
        const state = memberState.get(m.id);
        if (state) {
            m.x = state.x;
            m.y = state.y;
            m.rotation = state.rot;
        }
    });
};

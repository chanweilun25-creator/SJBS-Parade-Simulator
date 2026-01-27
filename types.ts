
export type TerrainType = 'ASPHALT' | 'GRASS' | 'SAND';

export enum EntityType {
  PC = 'PC',
  RSM = 'RSM',
  COLOURS = 'COLOURS',
  CONTINGENT = 'CONTINGENT', // Composite
  TROOPER = 'TROOPER', // Single unit
  OFFICER = 'OFFICER', // Single unit
  MARKER = 'MARKER',
  REVIEWING_OFFICER = 'REVIEWING_OFFICER',
  
  // Furniture
  SALUTING_BASE = 'SALUTING_BASE',
  ROSTRUM = 'ROSTRUM',
  SPEAKER = 'SPEAKER',
  MIXER = 'MIXER',
  AWARD_TABLE = 'AWARD_TABLE',
  TROPHY_CUP = 'TROPHY_CUP',
  TROPHY_PLAQUE = 'TROPHY_PLAQUE',
  TROPHY_SHIELD = 'TROPHY_SHIELD'
}

export interface Coordinates {
  x: number; // in paces
  y: number; // in paces
}

export interface Entity {
  id: string;
  type: EntityType;
  label: string;
  x: number; // paces
  y: number; // paces
  rotation: number; // degrees, 0 is North
  selected?: boolean;
  groupId?: string; // For grouped movement
  // Specific properties for composite entities
  config?: {
    ranks?: number;
    files?: number;
    color?: string;
  };
}

export interface GroupMetadata {
  id: string;
  label: string;
  showLabel: boolean;
  type?: 'CONTINGENT' | 'COLOURS_PARTY' | 'GENERIC';
  rotation: number; // Formation Bearing
  config?: {
    rows?: number; // For Contingent
    cols?: number; // For Contingent
    colourCount?: number; // For Colours Party
    hasColoursSergeant?: boolean; // For Contingent
    flagColors?: string[]; // For Colours Party
  };
}

// --- Animation Types ---

export type ActionType = 'MOVE' | 'TURN' | 'WHEEL';

export interface AnimationAction {
  id: string;
  type: ActionType;
  startTime: number; // Seconds
  duration: number; // Seconds
  payload: {
    // For Move
    targetX?: number;
    targetY?: number;
    
    // For Turn
    targetRotation?: number; // 0, 90, 180, 270
    
    // For Wheel
    wheelAngle?: number; // usually 90 or -90
    pivotCorner?: 'TL' | 'TR'; // Top-Left or Top-Right relative to formation
  };
}

export interface AnimationTrack {
  ownerId: string; // Entity ID or Group ID
  actions: AnimationAction[];
}

export interface AnimationState {
  duration: number; // Total timeline duration in seconds
  tracks: Record<string, AnimationTrack>; // Keyed by ownerId
  trackOrder?: string[]; // Array of ownerIds in display order
}

export interface ParadeConfig {
  id: string;
  title: string;
  width: number; // paces
  height: number; // paces
  terrain: TerrainType;
  lastModified: number;
}

export interface ParadeState {
  config: ParadeConfig;
  entities: Entity[];
  groups: Record<string, GroupMetadata>;
  animation: AnimationState;
}

export interface ViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

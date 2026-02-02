
import { TerrainType, EntityType } from './types';

// Spatial Accuracy
export const PIXELS_PER_PACE = 20; // 1 Pace = 20 Screen Pixels
export const GRID_MAJOR_INTERVAL = 5; // Bold line every 5 paces

// Canvas Defaults
export const DEFAULT_ZOOM = 1;
export const MIN_ZOOM = 0.01; // 1%
export const MAX_ZOOM = 5;    // 500%

// Entity Dimensions (in Paces)
// Requirement: All sprites should be of the same size.
const UNIFORM_SIZE = 0.9;

export const ENTITY_SIZE_MAP: Record<EntityType, number> = {
  [EntityType.PC]: UNIFORM_SIZE,
  [EntityType.RSM]: UNIFORM_SIZE,
  [EntityType.COLOURS]: UNIFORM_SIZE,
  [EntityType.TROOPER]: UNIFORM_SIZE,
  [EntityType.ORDERLY]: UNIFORM_SIZE,
  [EntityType.OFFICER]: UNIFORM_SIZE,
  [EntityType.MARKER]: UNIFORM_SIZE,
  [EntityType.REVIEWING_OFFICER]: UNIFORM_SIZE,
  [EntityType.HOST]: UNIFORM_SIZE,
  [EntityType.CONTINGENT]: UNIFORM_SIZE, // Only used for icon drag reference
  
  // Furniture
  [EntityType.SALUTING_BASE]: 6, // Wider
  [EntityType.ROSTRUM]: 1.5,
  [EntityType.SPEAKER]: 1,
  [EntityType.MIXER]: 2,
  [EntityType.AWARD_TABLE]: 3,
  [EntityType.TROPHY_CUP]: 0.5,
  [EntityType.TROPHY_PLAQUE]: 0.5,
  [EntityType.TROPHY_SHIELD]: 0.5,
};

// Colors
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  ASPHALT: '#374151', // tailwind gray-700
  GRASS: '#15803d',   // tailwind green-700
  SAND: '#e6ccb2',    // Lighter beige/sand color
};

export const SELECTION_COLOR = '#3b82f6'; // blue-500 (Used for entity highlights)
export const BOX_SELECT_BORDER = '#fbbf24'; // amber-400 (Yellow for box select)
export const BOX_SELECT_FILL = 'rgba(251, 191, 36, 0.2)'; // amber-400 with opacity

// Furniture Types Helper
export const FURNITURE_TYPES = new Set([
  EntityType.SALUTING_BASE,
  EntityType.ROSTRUM,
  EntityType.SPEAKER,
  EntityType.MIXER,
  EntityType.AWARD_TABLE,
  EntityType.TROPHY_CUP,
  EntityType.TROPHY_PLAQUE,
  EntityType.TROPHY_SHIELD
]);

export const isFurniture = (type: EntityType) => FURNITURE_TYPES.has(type);

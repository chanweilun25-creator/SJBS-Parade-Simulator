import { ParadeState } from '../types';

const STORAGE_KEY_PREFIX = 'parade_sim_save_';
const MAX_SLOTS = 3;

export const saveParade = (state: ParadeState) => {
  // Get existing saves to manage rotation
  const saves = getSavedParades();
  
  // Update if exists, or add new
  const existingIndex = saves.findIndex(s => s.config.id === state.config.id);
  
  let newSaves = [...saves];
  if (existingIndex >= 0) {
    newSaves[existingIndex] = state;
  } else {
    newSaves.unshift(state); // Add to top
    if (newSaves.length > MAX_SLOTS) {
      newSaves.pop(); // Remove oldest
    }
  }

  localStorage.setItem(`${STORAGE_KEY_PREFIX}index`, JSON.stringify(newSaves));
};

export const getSavedParades = (): ParadeState[] => {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}index`);
    const parsed: ParadeState[] = data ? JSON.parse(data) : [];
    
    // Migration: Ensure groups object exists
    return parsed.map(state => ({
      ...state,
      groups: state.groups || {}
    }));
  } catch (e) {
    console.error("Failed to load saves", e);
    return [];
  }
};

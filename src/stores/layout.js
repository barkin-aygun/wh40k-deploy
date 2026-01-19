import { writable, get } from 'svelte/store';

const STORAGE_KEY = 'warhammer-deployment-layout';

// Terrain size presets (width x height in inches)
export const TERRAIN_SIZES = [
  { label: '6" x 12"', width: 6, height: 12 },
  { label: '5" x 10"', width: 5, height: 10 },
  { label: '4" x 6"', width: 4, height: 6 }
];

// Generate unique ID
function generateId() {
  return 'terrain-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Create terrain store
function createTerrainStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    set,
    update,

    // Add a new terrain piece
    add(width, height) {
      update(terrains => [
        ...terrains,
        {
          id: generateId(),
          x: 30 - width / 2,  // Center horizontally
          y: 22 - height / 2, // Center vertically
          width,
          height,
          rotation: 0
        }
      ]);
    },

    // Update a terrain piece
    updateTerrain(id, changes) {
      update(terrains => terrains.map(t =>
        t.id === id ? { ...t, ...changes } : t
      ));
    },

    // Remove a terrain piece
    remove(id) {
      update(terrains => terrains.filter(t => t.id !== id));
    },

    // Clear all terrain
    clear() {
      set([]);
    },

    // Save to localStorage
    save() {
      const terrains = get({ subscribe });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(terrains));
    },

    // Load from localStorage
    load() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const terrains = JSON.parse(saved);
          set(terrains);
          return true;
        } catch (e) {
          console.error('Failed to load layout:', e);
          return false;
        }
      }
      return false;
    },

    // Check if there's a saved layout
    hasSaved() {
      return localStorage.getItem(STORAGE_KEY) !== null;
    }
  };
}

export const layoutTerrains = createTerrainStore();

// Currently selected terrain ID
export const selectedTerrainId = writable(null);

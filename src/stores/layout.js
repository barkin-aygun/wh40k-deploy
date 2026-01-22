import { writable, derived, get } from 'svelte/store';

const STORAGE_KEY = 'warhammer-deployment-layouts';

// Terrain size presets (width x height in inches)
export const TERRAIN_SIZES = [
  { label: '6" x 12"', width: 6, height: 12 },
  { label: '5" x 10"', width: 5, height: 10 },
  { label: '4" x 6"', width: 4, height: 6 }
];

// Wall shape presets
export const WALL_SHAPES = [
  { label: 'L 4x8', shape: 'L-4x8' },
  { label: 'L 4x8 ⌐', shape: 'L-4x8-mirror' },
  { label: 'C 4-8-4', shape: 'C-4-8-4' },
  { label: 'L 5x6', shape: 'L-5x6' },
  { label: 'L 5x6 ⌐', shape: 'L-5x6-mirror' },
  { label: 'L 4x6', shape: 'L-4x6' },
  { label: 'L 4x6 ⌐', shape: 'L-4x6-mirror' }
];

// Preset terrain layouts
export const TERRAIN_LAYOUT_PRESETS = [
  {
    name: 'Layout 1',
    terrains: [
      { id: "a", x: 28, y: 0, width: 4, height: 6, rotation: 0 },
      { id: "b", x: 28, y: 38, width: 4, height: 6, rotation: 0 },
      { id: "c", x: 6, y: 5, width: 6, height: 12, rotation: 0 },
      { id: "d", x: 48, y: 27, width: 6, height: 12, rotation: 0 },
      { id: "e", x: 16, y: 28, width: 6, height: 12, rotation: 0 },
      { id: "f", x: 7, y: 19, width: 6, height: 12, rotation: 90 },
      { id: "g", x: 38, y: 4, width: 6, height: 12, rotation: 0 },
      { id: "h", x: 47, y: 13, width: 6, height: 12, rotation: 90 },
      { id: "i", x: 32.74, y: 23.59, width: 5, height: 10, rotation: 135 },
      { id: "j", x: 35.06, y: 19.50, width: 4, height: 6, rotation: 45 },
      { id: "k", x: 22.07, y: 10.17, width: 5, height: 10, rotation: -45 },
      { id: "l", x: 20.72, y: 18.23, width: 4, height: 6, rotation: 45 }
    ],
    walls: [
      { id: "wa", x: 38, y: 6, shape: 'C-4-8-4', rotation: 0 },
      { id: "wb", x: 18, y: 30, shape: 'C-4-8-4', rotation: 180 },
      { id: "wc", x: 13.33, y: 20.15, shape: 'L-4x8-mirror', rotation: -90 },
      { id: "wd", x: 49.67, y: 15.93, shape: 'L-4x8-mirror', rotation: 90 },
      { id: "we", x: 48.20, y: 30.88, shape: 'L-4x8', rotation: 0 },
      { id: "wf", x: 7.84, y: 5.01, shape: 'L-4x8', rotation: 180 },
      { id: "wg", x: 27.06, y: 11.52, shape: 'L-4x8-mirror', rotation: -45 },
      { id: "wh", x: 35.81, y: 24.24, shape: 'L-4x8-mirror', rotation: 135 }
    ]
  },
  {
    name: 'Layout 2',
    terrains: [
      { id: "a", x: 31, y: 7, width: 4, height: 6, rotation: -90 },
      { id: "b", x: 25, y: 30, width: 4, height: 6, rotation: 90 },
      { id: "c", x: 5, y: 4, width: 6, height: 12, rotation: 0 },
      { id: "d", x: 49, y: 28, width: 6, height: 12, rotation: 0 },
      { id: "e", x: 46, y: 4, width: 6, height: 12, rotation: 0 },
      { id: "f", x: 16.46, y: 15.77, width: 6, height: 12, rotation: 132.1 },
      { id: "g", x: 53, y: 15, width: 4, height: 6, rotation: 90 },
      { id: "h", x: 8, y: 28, width: 6, height: 12, rotation: 0 },
      { id: "i", x: 3, y: 23, width: 4, height: 6, rotation: 90 },
      { id: "j", x: 32.62, y: 32.55, width: 5, height: 10, rotation: -90 },
      { id: "k", x: 22.48, y: 0.51, width: 5, height: 10, rotation: -90 },
      { id: "l", x: 37.5, y: 16.2, width: 6, height: 12, rotation: 132.1 }
    ],
    walls: [
      { id: "wa", x: 49, y: 32, shape: 'L-4x8', rotation: 0 },
      { id: "wb", x: 7, y: 4, shape: 'L-4x8', rotation: 180 },
      { id: "wc", x: 46, y: 8, shape: 'L-4x8', rotation: 0 },
      { id: "wd", x: 10, y: 28, shape: 'L-4x8', rotation: 180 },
      { id: "we", x: 35.07, y: 34.56, shape: 'L-5x6-mirror', rotation: -90 },
      { id: "wf", x: 29.09, y: 2.47, shape: 'L-5x6-mirror', rotation: 90 },
      { id: "wg", x: 17.86, y: 17.53, shape: 'C-4-8-4', rotation: 135 },
      { id: "wh", x: 37.24, y: 18.38, shape: 'C-4-8-4', rotation: -45 }
    ]
  },
  {
    name: 'Layout 3',
    terrains: [
      { id: "a", x: 11, y: 3, width: 4, height: 6, rotation: 90 },
      { id: "b", x: 45, y: 35, width: 4, height: 6, rotation: 90 },
      { id: "c", x: 25, y: 1, width: 6, height: 12, rotation: 90 },
      { id: "d", x: 29, y: 31, width: 6, height: 12, rotation: 90 },
      { id: "e", x: 7.74, y: 26.05, width: 6, height: 12, rotation: 125.31 },
      { id: "f", x: 46.34, y: 5.51, width: 6, height: 12, rotation: 121.72 },
      { id: "g", x: 5.14, y: 10.46, width: 6, height: 12, rotation: 41.51 },
      { id: "h", x: 48.67, y: 21.52, width: 6, height: 12, rotation: 41.51 },
      { id: "i", x: 19.59, y: 14.36, width: 5, height: 10, rotation: -38.13 },
      { id: "j", x: 20.69, y: 24.37, width: 4, height: 6, rotation: -39.33 },
      { id: "k", x: 35.34, y: 19.61, width: 5, height: 10, rotation: -38.13 },
      { id: "l", x: 35.31, y: 13.50, width: 4, height: 6, rotation: -39.33 }
    ],
    walls: [
      { id: "aa", x: 30, y: 32, shape: 'C-4-8-4', rotation: 90 },
      { id: "ab", x: 26, y: 4, shape: 'C-4-8-4', rotation: -90 },
      { id: "ac", x: 8.19, y: 11.64, shape: 'L-4x8', rotation: 222.46 },
      { id: "ad", x: 47.79, y: 24.30, shape: 'L-4x8', rotation: 41.26 },
      { id: "ae", x: 38.64, y: 20.09, shape: 'L-5x6-mirror', rotation: 141.31 },
      { id: "af", x: 25.26, y: 17.90, shape: 'L-5x6-mirror', rotation: -37.61 },
      { id: "ag", x: 14.37, y: 28.38, shape: 'L-4x8-mirror', rotation: -54.26 },
      { id: "ah", x: 48.75, y: 7.30, shape: 'L-4x8-mirror', rotation: 122.02 }
    ]
  },
  {
    name: 'Layout 4',
    terrains: [
      { id: "a", x: 15, y: 1, width: 6, height: 12, rotation: 90 },
      { id: "b", x: 8, y: 10, width: 4, height: 6, rotation: 0 },
      { id: "c", x: 4, y: 19, width: 4, height: 6, rotation: 0 },
      { id: "d", x: 7.50, y: 27.68, width: 6, height: 12, rotation: -48.57 },
      { id: "e", x: 46.53, y: 4.24, width: 6, height: 12, rotation: -48.57 },
      { id: "f", x: 52, y: 19, width: 4, height: 6, rotation: 0 },
      { id: "g", x: 48, y: 28, width: 4, height: 6, rotation: 0 },
      { id: "h", x: 39, y: 31, width: 6, height: 12, rotation: 90 },
      { id: "i", x: 33.03, y: 2.97, width: 6, height: 12, rotation: -37.25 },
      { id: "j", x: 20.96, y: 28.96, width: 6, height: 12, rotation: -37.25 },
      { id: "k", x: 16.93, y: 16.51, width: 5, height: 10, rotation: -41.85 },
      { id: "l", x: 37.96, y: 17.43, width: 5, height: 10, rotation: -41.85 }
    ],
    walls: [
      { id: "aa", x: 18, y: 4, shape: 'L-4x8', rotation: -90 },
      { id: "ab", x: 9.04, y: 29.01, shape: 'C-4-8-4', rotation: 131.97 },
      { id: "ac", x: 47, y: 7, shape: 'C-4-8-4', rotation: -48.54 },
      { id: "ad", x: 38, y: 32, shape: 'L-4x8', rotation: 90 },
      { id: "ae", x: 34.42, y: 7.12, shape: 'L-4x8', rotation: -37.53 },
      { id: "af", x: 21.57, y: 28.80, shape: 'L-4x8', rotation: 142.46 },
      { id: "ag", x: 15.70, y: 17.01, shape: 'L-5x6', rotation: 137.87 },
      { id: "ah", x: 39.17, y: 20.85, shape: 'L-5x6', rotation: -40.92 }
    ]
  },
  {
    name: 'Layout 5',
    terrains: [
      { id: "aa", x: 27, y: 1, width: 6, height: 12, rotation: 90 },
      { id: "ab", x: 36.53, y: 12.48, width: 5, height: 10, rotation: -90 },
      { id: "ac", x: 13, y: 3, width: 4, height: 6, rotation: 90 },
      { id: "ad", x: 43, y: 35, width: 4, height: 6, rotation: 90 },
      { id: "ae", x: 27, y: 31, width: 6, height: 12, rotation: 90 },
      { id: "af", x: 18.43, y: 21.49, width: 5, height: 10, rotation: -90 },
      { id: "ag", x: 1, y: 23, width: 4, height: 6, rotation: 90 },
      { id: "ah", x: 55, y: 15, width: 4, height: 6, rotation: 90 },
      { id: "ai", x: 7.83, y: 30.22, width: 6, height: 12, rotation: -60 },
      { id: "aj", x: 46.32, y: 1.58, width: 6, height: 12, rotation: -60 },
      { id: "ak", x: 8.74, y: 10.19, width: 6, height: 12, rotation: 65.22 },
      { id: "al", x: 45.22, y: 21.75, width: 6, height: 12, rotation: 65.22 }
    ],
    walls: [
      { id: "a1", x: 28, y: 32, shape: 'C-4-8-4', rotation: 90 },
      { id: "a2", x: 28, y: 4, shape: 'C-4-8-4', rotation: -90 },
      { id: "a3", x: 11.88, y: 12.29, shape: 'L-4x8', rotation: -114.74 },
      { id: "a4", x: 43.97, y: 23.59, shape: 'L-4x8', rotation: 64.22 },
      { id: "a5", x: 24.91, y: 23.52, shape: 'L-5x6-mirror', rotation: -90.37 },
      { id: "a6", x: 39.00, y: 14.51, shape: 'L-5x6-mirror', rotation: 89.90 },
      { id: "a7", x: 7.58, y: 30.57, shape: 'L-4x8', rotation: 120.93 },
      { id: "a8", x: 48.51, y: 5.28, shape: 'L-4x8', rotation: -59.06 }
    ]
  },
  {
    name: 'Layout 6',
    terrains: [
      { id: "aa", x: 13, y: 1, width: 6, height: 12, rotation: 90 },
      { id: "ab", x: 6, y: 10, width: 4, height: 6, rotation: 0 },
      { id: "ac", x: 25, y: 11, width: 4, height: 6, rotation: 90 },
      { id: "ad", x: 7.34, y: 27.57, width: 6, height: 12, rotation: -40.32 },
      { id: "ae", x: 46.69, y: 4.57, width: 6, height: 12, rotation: -41.90 },
      { id: "af", x: 31, y: 27, width: 4, height: 6, rotation: -90 },
      { id: "ag", x: 50, y: 28, width: 4, height: 6, rotation: 0 },
      { id: "ah", x: 41, y: 31, width: 6, height: 12, rotation: 90 },
      { id: "ai", x: 34, y: 4, width: 6, height: 12, rotation: 0 },
      { id: "aj", x: 20, y: 28, width: 6, height: 12, rotation: 0 },
      { id: "ak", x: 15.70, y: 15.03, width: 5, height: 10, rotation: -41.85 },
      { id: "al", x: 39.43, y: 19.24, width: 5, height: 10, rotation: -39.95 }
    ],
    walls: [
      { id: "a1", x: 16, y: 4, shape: 'L-4x8', rotation: -90 },
      { id: "a2", x: 9.04, y: 29.01, shape: 'C-4-8-4', rotation: 140.05 },
      { id: "a3", x: 47, y: 7.16, shape: 'C-4-8-4', rotation: -41.53 },
      { id: "a4", x: 40, y: 32, shape: 'L-4x8', rotation: 90 },
      { id: "a5", x: 34.15, y: 7.88, shape: 'L-4x8', rotation: 0 },
      { id: "a6", x: 22, y: 28, shape: 'L-4x8', rotation: 180 },
      { id: "a7", x: 14.47, y: 15.47, shape: 'L-5x6', rotation: 137.87 },
      { id: "a8", x: 40.53, y: 22.78, shape: 'L-5x6', rotation: -40.92 }
    ]
  },
  {
    name: 'Layout 7',
    terrains: [
      { id: "aa", x: 8, y: 8, width: 6, height: 12, rotation: 0 },
      { id: "ab", x: 6, y: 28, width: 6, height: 12, rotation: 0 },
      { id: "ac", x: 7, y: 39, width: 4, height: 6, rotation: 90 },
      { id: "ad", x: 18, y: 26, width: 5, height: 10, rotation: 0 },
      { id: "ae", x: 19, y: 20, width: 4, height: 6, rotation: 0 },
      { id: "af", x: 23, y: 3, width: 6, height: 12, rotation: 0 },
      { id: "ag", x: 31, y: 29, width: 6, height: 12, rotation: 0 },
      { id: "ah", x: 37, y: 18, width: 4, height: 6, rotation: 0 },
      { id: "ai", x: 37, y: 8, width: 5, height: 10, rotation: 0 },
      { id: "aj", x: 46, y: 24, width: 6, height: 12, rotation: 0 },
      { id: "ak", x: 48, y: 4, width: 6, height: 12, rotation: 0 },
      { id: "al", x: 49, y: -1, width: 4, height: 6, rotation: 90 }
    ],
    walls: [
      { id: "a1", x: 9, y: 10, shape: 'L-5x6', rotation: 180 },
      { id: "a2", x: 11.44, y: 31.97, shape: 'L-4x8-mirror', rotation: 0 },
      { id: "a3", x: 19, y: 20, shape: 'L-4x6', rotation: 180 },
      { id: "a4", x: 22.53, y: 30.02, shape: 'L-5x6-mirror', rotation: 0 },
      { id: "a5", x: 25, y: 5, shape: 'C-4-8-4', rotation: 180 },
      { id: "a6", x: 31, y: 31, shape: 'C-4-8-4', rotation: 0 },
      { id: "a7", x: 37, y: 18, shape: 'L-4x6', rotation: 0 },
      { id: "a8", x: 41.51, y: 8.09, shape: 'L-5x6-mirror', rotation: 180 },
      { id: "a9", x: 46, y: 28, shape: 'L-5x6', rotation: 0 },
      { id: "a10", x: 51.51, y: 4.01, shape: 'L-4x8-mirror', rotation: 180 }
    ]
  },
  {
    name: 'Layout 8',
    terrains: [
      { id: "aa", x: 23, y: 22, width: 4, height: 6, rotation: 0 },
      { id: "ab", x: 23, y: 28, width: 4, height: 6, rotation: 0 },
      { id: "ac", x: 33, y: 16, width: 4, height: 6, rotation: 0 },
      { id: "ad", x: 33, y: 10, width: 4, height: 6, rotation: 0 },
      { id: "ae", x: 41, y: 19, width: 6, height: 12, rotation: 0 },
      { id: "af", x: 13, y: 13, width: 6, height: 12, rotation: 0 },
      { id: "ag", x: 32, y: 32, width: 6, height: 12, rotation: 0 },
      { id: "ah", x: 22, y: 0, width: 6, height: 12, rotation: 0 },
      { id: "ai", x: 9.50, y: 27.68, width: 6, height: 12, rotation: -48.69 },
      { id: "aj", x: 44.51, y: 4.35, width: 6, height: 12, rotation: -48.69 },
      { id: "ak", x: 6.95, y: 4, width: 5, height: 10, rotation: 53.90 },
      { id: "al", x: 48, y: 30, width: 5, height: 10, rotation: 53.90 }
    ],
    walls: [
      { id: "a1", x: 32, y: 34, shape: 'C-4-8-4', rotation: 0 },
      { id: "a2", x: 24, y: 2, shape: 'C-4-8-4', rotation: 180 },
      { id: "a3", x: 44.68, y: 19.06, shape: 'L-4x8-mirror', rotation: 180 },
      { id: "a4", x: 18.43, y: 16.91, shape: 'L-4x8-mirror', rotation: 0 },
      { id: "a5", x: 46.38, y: 33.13, shape: 'L-5x6', rotation: 52.87 },
      { id: "a6", x: 8.55, y: 4.89, shape: 'L-5x6', rotation: -127.66 },
      { id: "a7", x: 16.00, y: 30.28, shape: 'L-4x8-mirror', rotation: -48.62 },
      { id: "a8", x: 46.91, y: 5.85, shape: 'L-4x8-mirror', rotation: 132.19 }
    ]
  }
];

// Generate unique ID
function generateId() {
  return 'terrain-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Get all saved layouts from localStorage
function getSavedLayouts() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved layouts:', e);
      return {};
    }
  }
  return {};
}

// Save layouts object to localStorage
function saveLayoutsToStorage(layouts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
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

    // Save current layout with a name
    save(name) {
      const terrains = get({ subscribe });
      const layouts = getSavedLayouts();
      layouts[name] = {
        terrains,
        savedAt: Date.now()
      };
      saveLayoutsToStorage(layouts);
    },

    // Load a layout by name
    load(name) {
      const layouts = getSavedLayouts();
      if (layouts[name]) {
        set(layouts[name].terrains);
        return true;
      }
      return false;
    },

    // Delete a saved layout
    deleteLayout(name) {
      const layouts = getSavedLayouts();
      delete layouts[name];
      saveLayoutsToStorage(layouts);
    },

    // Get list of saved layout names
    getSavedLayoutNames() {
      const layouts = getSavedLayouts();
      return Object.keys(layouts).map(name => ({
        name,
        savedAt: layouts[name].savedAt,
        terrainCount: layouts[name].terrains.length
      })).sort((a, b) => b.savedAt - a.savedAt);
    },

    // Check if there are any saved layouts
    hasSaved() {
      const layouts = getSavedLayouts();
      return Object.keys(layouts).length > 0;
    }
  };
}

export const layoutTerrains = createTerrainStore();

// Create wall store
function createWallStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    set,
    update,

    // Add a new wall piece
    add(shape) {
      update(walls => [
        ...walls,
        {
          id: 'wall-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          x: 30, // Center horizontally
          y: 22, // Center vertically
          shape,
          rotation: 0
        }
      ]);
    },

    // Update a wall piece
    updateWall(id, changes) {
      update(walls => walls.map(w =>
        w.id === id ? { ...w, ...changes } : w
      ));
    },

    // Remove a wall piece
    remove(id) {
      update(walls => walls.filter(w => w.id !== id));
    },

    // Clear all walls
    clear() {
      set([]);
    }
  };
}

export const layoutWalls = createWallStore();

// Debug mode terrain/walls (separate from main layout builder)
export const debugTerrains = createTerrainStore();
export const debugWalls = createWallStore();
export const debugSelectedTerrainId = writable(null);
export const debugSelectedWallId = writable(null);

// Parse shape string to get base type and default segments
export function parseWallShape(shapeType) {
  const mirrored = shapeType.includes('-mirror');
  const baseShape = shapeType.replace('-mirror', '');

  if (baseShape.startsWith('L-')) {
    // L-4x8 -> [4, 8]
    const match = baseShape.match(/L-(\d+)x(\d+)/);
    if (match) {
      return {
        type: 'L',
        segments: [parseInt(match[1]), parseInt(match[2])],
        mirrored
      };
    }
  } else if (baseShape.startsWith('C-')) {
    // C-4-8-4 -> [4, 8, 4]
    const match = baseShape.match(/C-(\d+)-(\d+)-(\d+)/);
    if (match) {
      return {
        type: 'C',
        segments: [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])],
        mirrored
      };
    }
  }

  return { type: 'L', segments: [4, 8], mirrored: false };
}

// Get wall vertices based on shape type or custom segments (relative to origin 0,0)
export function getWallVertices(shapeType, customSegments = null) {
  const WALL_THICKNESS = 0.5;
  const t = WALL_THICKNESS;

  const parsed = parseWallShape(shapeType);
  const segments = customSegments || parsed.segments;
  const mirrored = parsed.mirrored;

  if (parsed.type === 'L') {
    const [width, height] = segments;
    if (mirrored) {
      return [
        { x: 0, y: 0 },
        { x: t, y: 0 },
        { x: t, y: height },
        { x: -width + t, y: height },
        { x: -width + t, y: height - t },
        { x: 0, y: height - t }
      ];
    } else {
      return [
        { x: 0, y: 0 },
        { x: t, y: 0 },
        { x: t, y: height - t },
        { x: width, y: height - t },
        { x: width, y: height },
        { x: 0, y: height }
      ];
    }
  } else if (parsed.type === 'C') {
    const [topWidth, height, bottomWidth] = segments;
    const width = Math.max(topWidth, bottomWidth);
    // C shape as a simple concave polygon tracing the filled area
    // Traces outer edge, then inner edge to form a C opening to the right
    return [
      { x: 0, y: 0 },           // bottom-left corner
      { x: bottomWidth, y: 0 }, // bottom-right corner
      { x: bottomWidth, y: t }, // inner bottom-right
      { x: t, y: t },           // inner bottom-left
      { x: t, y: height - t },  // inner top-left
      { x: topWidth, y: height - t },  // inner top-right
      { x: topWidth, y: height },      // top-right corner
      { x: 0, y: height }       // top-left corner (closes back to start)
    ];
  }

  return [];
}

// Rotate and translate wall vertices
// Must match the rotation used in WallPiece.svelte (rotate around bounding box center)
export function transformWallVertices(vertices, x, y, rotation) {
  if (vertices.length === 0) return [];

  // Calculate bounding box to find center (same as WallPiece.svelte)
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  // Center of unrotated shape in world coordinates
  const centerX = x + minX + width / 2;
  const centerY = y + minY + height / 2;

  const angleRad = (rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // First translate vertices to world position, then rotate around center
  return vertices.map(v => {
    // Vertex position in world coordinates (before rotation)
    const worldX = x + v.x;
    const worldY = y + v.y;

    // Rotate around center
    const dx = worldX - centerX;
    const dy = worldY - centerY;

    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos
    };
  });
}

// Derived store for all wall polygons (for LoS checking)
export const allLayoutWallPolygons = derived(layoutWalls, ($walls) => {
  return $walls.map(wall =>
    transformWallVertices(getWallVertices(wall.shape, wall.segments), wall.x, wall.y, wall.rotation)
  );
});

// Currently selected terrain ID
export const selectedTerrainId = writable(null);

// Currently selected wall ID
export const selectedWallId = writable(null);

// Saved layouts list (reactive)
export const savedLayoutsList = writable([]);

// Save current layout (terrains + walls + models)
// Note: models need to be passed in since they're in a different store
export function saveLayout(name, models = []) {
  const terrains = get(layoutTerrains);
  const walls = get(layoutWalls);
  const layouts = getSavedLayouts();
  layouts[name] = {
    terrains,
    walls,
    models,  // Include models
    savedAt: Date.now()
  };
  saveLayoutsToStorage(layouts);
}

// Load a layout by name
// Returns { terrains, walls, models } or null
export function loadLayout(name) {
  const layouts = getSavedLayouts();
  if (layouts[name]) {
    layoutTerrains.set(layouts[name].terrains || []);
    layoutWalls.set(layouts[name].walls || []);
    return {
      terrains: layouts[name].terrains || [],
      walls: layouts[name].walls || [],
      models: layouts[name].models || []
    };
  }
  return null;
}

// Delete a saved layout
export function deleteLayout(name) {
  const layouts = getSavedLayouts();
  delete layouts[name];
  saveLayoutsToStorage(layouts);
}

// Get list of saved layout names
export function getSavedLayoutNames() {
  const layouts = getSavedLayouts();
  return Object.keys(layouts).map(name => ({
    name,
    savedAt: layouts[name].savedAt,
    terrainCount: (layouts[name].terrains || []).length,
    wallCount: (layouts[name].walls || []).length,
    modelCount: (layouts[name].models || []).length
  })).sort((a, b) => b.savedAt - a.savedAt);
}

// Refresh the saved layouts list
export function refreshSavedLayouts() {
  savedLayoutsList.set(getSavedLayoutNames());
}

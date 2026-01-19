import { writable, derived } from 'svelte/store';
import { getLWallVerticesRotated, getRotatedRectVertices } from '../lib/visibility/index.js';

// Battlefield dimensions in inches
export const BATTLEFIELD = {
  width: 60,
  height: 44
};

// 32mm = 1.2598 inches, radius = 0.63 inches
export const BASE_32MM_RADIUS = 0.63;

// Store for unit positions
export const units = writable([
  { id: 'unit1', x: 10, y: 22, radius: BASE_32MM_RADIUS, color: '#3b82f6' },
  { id: 'unit2', x: 50, y: 22, radius: BASE_32MM_RADIUS, color: '#ef4444' }
]);

// Store for terrain pieces (array with rotation support)
export const terrains = writable([
  {
    id: 'terrain1',
    x: 20,
    y: 16,
    width: 6,
    height: 12,
    rotation: 0 // degrees
  },
  {
    id: 'terrain2',
    x: 34,
    y: 10,
    width: 6,
    height: 12,
    rotation: 45
  },
  {
    id: 'terrain3',
    x: 44,
    y: 20,
    width: 6,
    height: 12,
    rotation: -30
  }
]);

// Derived store for all wall vertices (updates when any terrain moves/rotates)
export const allWalls = derived(terrains, ($terrains) => {
  return $terrains.map(t => getLWallVerticesRotated(t));
});

// Derived store for all terrain rectangles as polygons (for LOS checking)
export const allTerrainPolygons = derived(terrains, ($terrains) => {
  return $terrains.map(t => ({
    id: t.id,
    vertices: getRotatedRectVertices(t)
  }));
});

// Debug mode toggle
export const debugMode = writable(false);

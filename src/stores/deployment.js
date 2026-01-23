import { writable, get } from 'svelte/store';
import { COLORS } from '../lib/colors.js';

const STORAGE_KEY = 'warhammer-deployment-zones';

// Convert mm to inches
const MM_TO_INCH = 1 / 25.4;

// Objective marker sizes
export const OBJECTIVE_RADIUS = 40 * MM_TO_INCH / 2; // 40mm diameter = ~0.787" radius
export const OBJECTIVE_CONTROL_RADIUS = 3 + 20 * MM_TO_INCH; // 3" + 20mm = ~3.787" radius

// Generate unique ID
function generateId(prefix = 'item') {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Create deployment zones store
function createZonesStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    set,
    update,

    // Add a new zone
    add(zone) {
      const id = generateId('zone');
      update(zones => [...zones, { id, ...zone }]);
      return id;
    },

    // Update a zone
    updateZone(id, changes) {
      update(zones => zones.map(z =>
        z.id === id ? { ...z, ...changes } : z
      ));
    },

    // Remove a zone
    remove(id) {
      update(zones => zones.filter(z => z.id !== id));
    },

    // Clear all zones
    clear() {
      set([]);
    }
  };
}

// Create objectives store
function createObjectivesStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    set,
    update,

    // Add a new objective at grid position
    add(x, y, isPrimary = false) {
      const id = generateId('obj');
      // Snap to nearest inch
      const snappedX = Math.round(x);
      const snappedY = Math.round(y);
      update(objectives => [...objectives, { id, x: snappedX, y: snappedY, isPrimary }]);
      return id;
    },

    // Update an objective
    updateObjective(id, changes) {
      update(objectives => objectives.map(o =>
        o.id === id ? { ...o, ...changes } : o
      ));
    },

    // Remove an objective
    remove(id) {
      update(objectives => objectives.filter(o => o.id !== id));
    },

    // Clear all objectives
    clear() {
      set([]);
    }
  };
}

export const deploymentZones = createZonesStore();
export const objectives = createObjectivesStore();

// Currently selected zone/objective ID
export const selectedZoneId = writable(null);
export const selectedObjectiveId = writable(null);

// Preset deployment configurations
export const DEPLOYMENT_PRESETS = [
  {
    name: 'Dawn of War',
    zones: [
      {
        name: 'Player 1',
        color: COLORS.player1.zone,
        borderColor: COLORS.player1.primary,
        // Rectangle: bottom 12" strip
        path: [
          { type: 'M', x: 0, y: 32 },
          { type: 'L', x: 60, y: 32 },
          { type: 'L', x: 60, y: 44 },
          { type: 'L', x: 0, y: 44 },
          { type: 'Z' }
        ]
      },
      {
        name: 'Player 2',
        color: COLORS.player2.zone,
        borderColor: COLORS.player2.primary,
        // Rectangle: top 12" strip
        path: [
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 60, y: 0 },
          { type: 'L', x: 60, y: 12 },
          { type: 'L', x: 0, y: 12 },
          { type: 'Z' }
        ]
      }
    ],
    objectives: [
      { x: 30, y: 22, isPrimary: true },
      { x: 10, y: 22, isPrimary: false },
      { x: 50, y: 22, isPrimary: false },
      { x: 30, y: 6, isPrimary: false },
      { x: 30, y: 38, isPrimary: false }
    ]
  },
  {
    name: 'Hammer and Anvil',
    zones: [
      {
        name: 'Player 1',
        color: COLORS.player1.zone,
        borderColor: COLORS.player1.primary,
        // Rectangle: left 18" strip
        path: [
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 18, y: 0 },
          { type: 'L', x: 18, y: 44 },
          { type: 'L', x: 0, y: 44 },
          { type: 'Z' }
        ]
      },
      {
        name: 'Player 2',
        color: COLORS.player2.zone,
        borderColor: COLORS.player2.primary,
        // Rectangle: right 18" strip
        path: [
          { type: 'M', x: 42, y: 0 },
          { type: 'L', x: 60, y: 0 },
          { type: 'L', x: 60, y: 44 },
          { type: 'L', x: 42, y: 44 },
          { type: 'Z' }
        ]
      }
    ],
    objectives: [
      { x: 30, y: 22, isPrimary: true },
      { x: 30, y: 6, isPrimary: false },
      { x: 30, y: 38, isPrimary: false },
      { x: 10, y: 22, isPrimary: false },
      { x: 50, y: 22, isPrimary: false }
    ]
  },
  {
    name: 'Tipping Point',
    zones: [
      {
        name: 'Player 1',
        color: COLORS.player1.zone,
        borderColor: COLORS.player1.primary,
        // Rectangle: left 12/20 steps
        path: [
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 12, y: 0 },
          { type: 'L', x: 12, y: 22 },
          { type: 'L', x: 20, y: 22 },
          { type: 'L', x: 20, y: 44 },
          { type: 'L', x: 0, y: 44 },
          { type: 'Z' }
        ]
      },
      {
        name: 'Player 2',
        color: COLORS.player2.zone,
        borderColor: COLORS.player2.primary,
        path: [
          { type: 'M', x: 40, y: 0 },
          { type: 'L', x: 60, y: 0 },
          { type: 'L', x: 60, y: 44 },
          { type: 'L', x: 48, y: 44 },
          { type: 'L', x: 48, y: 22 },
          { type: 'L', x: 40, y: 22 },
          { type: 'Z' }
        ]
      }
    ],
    objectives: [
      { x: 30, y: 22, isPrimary: true },
      { x: 14, y: 34, isPrimary: false },
      { x: 22, y: 8, isPrimary: false },
      { x: 38, y: 36, isPrimary: false },
      { x: 46, y: 10, isPrimary: false }
    ]
  },
  {
    name: 'Search and Destroy',
    zones: [
      {
        name: 'Player 1',
        color: COLORS.player1.zone,
        borderColor: COLORS.player1.primary,
        // Bottom-left corner with quarter circle arc (9" radius from corner)
        path: [
          { type: 'M', x: 0, y: 22 },
          { type: 'L', x: 21, y: 22 },
          { type: 'A', rx: 9, ry: 9, rotation: 0, largeArc: 0, sweep: 0, x: 30, y: 31 },
          { type: 'L', x: 30, y: 44},
          { type: 'L', x: 0, y: 44},
          { type: 'Z' }
        ]
      },
      {
        name: 'Player 2',
        color: COLORS.player2.zone,
        borderColor: COLORS.player2.primary,
        // Top-right corner with quarter circle arc (9" radius from corner)
        path: [
          { type: 'M', x: 30, y: 0 },
          { type: 'L', x: 30, y: 13 },
          { type: 'A', rx: 9, ry: 9, rotation: 0, largeArc: 0, sweep: 1, x: 39, y: 22 },
          { type: 'L', x: 60, y: 22},
          { type: 'L', x: 60, y: 0},
          { type: 'Z' }
        ]
      }
    ],
    objectives: [
      { x: 30, y: 22, isPrimary: true },
      { x: 14, y: 10, isPrimary: false },
      { x: 46, y: 34, isPrimary: false },
      { x: 14, y: 34, isPrimary: false },
      { x: 46, y: 10, isPrimary: false }
    ]
  },
  {
    name: 'Sweeping Engagement',
    zones: [
      {
        name: 'Player 1',
        color: COLORS.player1.zone,
        borderColor: COLORS.player1.primary,
        // Diagonal bottom-left
        path: [
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 0, y: 8 },
          { type: 'L', x: 30, y: 8 },
          { type: 'L', x: 30, y: 14 },
          { type: 'L', x: 60, y: 14 },
          { type: 'L', x: 60, y: 0 },
          { type: 'Z' }
        ]
      },
      {
        name: 'Player 2',
        color: COLORS.player2.zone,
        borderColor: COLORS.player2.primary,
        // Diagonal top-right
        path: [
          { type: 'M', x: 0, y: 44 },
          { type: 'L', x: 60, y: 44 },
          { type: 'L', x: 60, y: 36 },
          { type: 'L', x: 30, y: 36 },
          { type: 'L', x: 30, y: 30 },
          { type: 'L', x: 0, y: 30 },
          { type: 'Z' }
        ]
      }
    ],
    objectives: [
      { x: 30, y: 22, isPrimary: true },
      { x: 10, y: 18, isPrimary: false },
      { x: 50, y: 26, isPrimary: false },
      { x: 18, y: 38, isPrimary: false },
      { x: 42, y: 6, isPrimary: false }
    ]
  },
  {
    name: 'Crucible of Battle',
    zones: [
      {
        name: 'Player 1',
        color: COLORS.player1.zone,
        borderColor: COLORS.player1.primary,
        // Left Diagonal
        path: [
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 30, y: 44 },
          { type: 'L', x: 0, y: 44 },
          { type: 'Z' }
        ]
      },
      {
        name: 'Player 2',
        color: COLORS.player2.zone,
        borderColor: COLORS.player2.primary,
        path: [
          { type: 'M', x: 60, y: 44 },
          { type: 'L', x: 30, y: 0 },
          { type: 'L', x: 60, y: 0 },
          { type: 'Z' }
        ]
      }
    ],
    objectives: [
      { x: 30, y: 22, isPrimary: true },
      { x: 20, y: 8, isPrimary: false },
      { x: 40, y: 36, isPrimary: false },
      { x: 14, y: 34, isPrimary: false },
      { x: 46, y: 10, isPrimary: false }
    ]
  }
];

// Convert path array to SVG path string
export function pathToSvgD(path) {
  return path.map(cmd => {
    switch (cmd.type) {
      case 'M':
        return `M ${cmd.x} ${cmd.y}`;
      case 'L':
        return `L ${cmd.x} ${cmd.y}`;
      case 'A':
        return `A ${cmd.rx} ${cmd.ry} ${cmd.rotation} ${cmd.largeArc} ${cmd.sweep} ${cmd.x} ${cmd.y}`;
      case 'Z':
        return 'Z';
      default:
        return '';
    }
  }).join(' ');
}

// Load a preset
export function loadPreset(presetName) {
  const preset = DEPLOYMENT_PRESETS.find(p => p.name === presetName);
  if (!preset) return false;

  deploymentZones.clear();
  objectives.clear();

  preset.zones.forEach(zone => {
    deploymentZones.add(zone);
  });

  preset.objectives.forEach(obj => {
    objectives.add(obj.x, obj.y, obj.isPrimary);
  });

  return true;
}

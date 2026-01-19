import { writable, derived, get } from 'svelte/store';

// Convert mm to inches
const MM_TO_INCH = 1 / 25.4;

// Base size definitions
export const BASE_SIZES = {
  circles: [
    { type: '25mm', radius: (25 * MM_TO_INCH) / 2, label: '25mm' },
    { type: '28mm', radius: (28 * MM_TO_INCH) / 2, label: '28mm' },
    { type: '32mm', radius: (32 * MM_TO_INCH) / 2, label: '32mm' },
    { type: '40mm', radius: (40 * MM_TO_INCH) / 2, label: '40mm' },
    { type: '50mm', radius: (50 * MM_TO_INCH) / 2, label: '50mm' },
    { type: '60mm', radius: (60 * MM_TO_INCH) / 2, label: '60mm' },
    { type: '80mm', radius: (80 * MM_TO_INCH) / 2, label: '80mm' }
  ],
  ovals: [
    { type: '90x25mm', width: 90 * MM_TO_INCH, height: 25 * MM_TO_INCH, label: '90×25mm' },
    { type: '105x70mm', width: 105 * MM_TO_INCH, height: 70 * MM_TO_INCH, label: '105×70mm' },
    { type: '120x90mm', width: 120 * MM_TO_INCH, height: 90 * MM_TO_INCH, label: '120×90mm' }
  ]
};

// Helper function to get base size info by type
export function getBaseSize(baseType) {
  const circle = BASE_SIZES.circles.find(b => b.type === baseType);
  if (circle) return circle;
  const oval = BASE_SIZES.ovals.find(b => b.type === baseType);
  return oval;
}

// Helper function to check if base is oval
export function isOvalBase(baseType) {
  return BASE_SIZES.ovals.some(b => b.type === baseType);
}

// Generate unique ID
function generateId() {
  return 'model-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Create models store
function createModelsStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    set,
    update,

    // Add a new model
    add(baseType, playerId, x, y) {
      const id = generateId();
      const model = {
        id,
        baseType,
        playerId,
        x,
        y,
        rotation: 0
      };
      update(models => [...models, model]);
      return id;
    },

    // Update a model
    updateModel(id, changes) {
      update(models => models.map(m =>
        m.id === id ? { ...m, ...changes } : m
      ));
    },

    // Remove a model
    remove(id) {
      update(models => models.filter(m => m.id !== id));
    },

    // Remove all models for a player
    removeByPlayer(playerId) {
      update(models => models.filter(m => m.playerId !== playerId));
    },

    // Clear all models
    clear() {
      set([]);
    }
  };
}

export const models = createModelsStore();

// Derived stores for filtering by player
export const player1Models = derived(models, $models =>
  $models.filter(m => m.playerId === 1)
);

export const player2Models = derived(models, $models =>
  $models.filter(m => m.playerId === 2)
);

// Selected model ID
export const selectedModelId = writable(null);

// Get selected model
export const selectedModel = derived(
  [models, selectedModelId],
  ([$models, $selectedModelId]) => {
    if (!$selectedModelId) return null;
    return $models.find(m => m.id === $selectedModelId);
  }
);

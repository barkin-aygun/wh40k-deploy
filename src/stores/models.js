import { writable, derived, get } from 'svelte/store';
import { history, debugHistory } from './history.js';

// Convert mm to inches
const MM_TO_INCH = 1 / 25.4;

// Base size definitions
export const BASE_SIZES = {
  circles: [
    { type: '25mm', radius: (25 * MM_TO_INCH) / 2, label: '25mm' },
    { type: '28.5mm', radius: (28.5 * MM_TO_INCH) / 2, label: '28mm.5' },
    { type: '32mm', radius: (32 * MM_TO_INCH) / 2, label: '32mm' },
    { type: '40mm', radius: (40 * MM_TO_INCH) / 2, label: '40mm' },
    { type: '50mm', radius: (50 * MM_TO_INCH) / 2, label: '50mm' },
    { type: '60mm', radius: (60 * MM_TO_INCH) / 2, label: '60mm' },
    { type: '80mm', radius: (80 * MM_TO_INCH) / 2, label: '80mm' },
    { type: '90mm', radius: (90 * MM_TO_INCH) / 2, label: '90mm' },
    { type: '100mm', radius: (100 * MM_TO_INCH) / 2, label: '100mm' },
    { type: '130mm', radius: (130 * MM_TO_INCH) / 2, label: '130mm' },
    { type: '160mm', radius: (160 * MM_TO_INCH) / 2, label: '160mm' }
    
  ],
  ovals: [
    { type: '60x35.5mm', width: 60 * MM_TO_INCH, height: 35.5 * MM_TO_INCH, label: '60×35.5mm' },
    { type: '75x42mm', width: 75 * MM_TO_INCH, height: 42 * MM_TO_INCH, label: '75×42mm' },
    { type: '90x52.5mm', width: 90 * MM_TO_INCH, height: 52.5 * MM_TO_INCH, label: '90×52.5mm' },
    { type: '105x70mm', width: 105 * MM_TO_INCH, height: 70 * MM_TO_INCH, label: '105×70mm' },
    { type: '120x90mm', width: 120 * MM_TO_INCH, height: 90 * MM_TO_INCH, label: '120×90mm' },
    { type: '150x95mm', width: 150 * MM_TO_INCH, height: 95 * MM_TO_INCH, label: '150×95mm' },
    { type: '170x109mm', width: 170 * MM_TO_INCH, height: 109 * MM_TO_INCH, label: '170×109mm' }
  ]
};

// Helper function to get base size info by type
export function getBaseSize(baseType, model = null) {
  const circle = BASE_SIZES.circles.find(b => b.type === baseType);
  if (circle) return circle;
  const oval = BASE_SIZES.ovals.find(b => b.type === baseType);
  if (oval) return oval;

  // For rectangular bases, return custom dimensions from the model
  if (isRectangularBase(baseType) && model) {
    return {
      type: baseType,
      width: model.customWidth,
      height: model.customHeight,
      label: `${model.customWidth.toFixed(1)}"×${model.customHeight.toFixed(1)}"`
    };
  }

  return null;
}

// Helper function to check if base is oval
export function isOvalBase(baseType) {
  return BASE_SIZES.ovals.some(b => b.type === baseType);
}

// Helper function to check if base is rectangular
export function isRectangularBase(baseType) {
  return baseType && baseType.startsWith('rect-');
}

// Generate unique ID
function generateId() {
  return 'model-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Create models store
function createModelsStore(historyStore) {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    set,
    update,

    // Add a new model
    add(baseType, playerId, x, y, customSize = null, skipHistory = false) {
      const id = generateId();
      const model = {
        id,
        baseType,
        playerId,
        x,
        y,
        rotation: 0
      };

      // For rectangular bases, store custom dimensions
      if (customSize && customSize.width && customSize.height) {
        model.customWidth = customSize.width;
        model.customHeight = customSize.height;
      }

      update(models => [...models, model]);

      // Track in history
      if (!skipHistory && historyStore) {
        historyStore.push({
          type: 'add',
          modelId: id,
          model: { ...model }
        });
      }

      return id;
    },

    // Update a model
    updateModel(id, changes, skipHistory = false) {
      let before = null;
      let actionType = null;

      // Get current state before update
      if (!skipHistory && historyStore) {
        const models = get({ subscribe });
        const model = models.find(m => m.id === id);
        if (model) {
          before = { ...model };

          // Determine action type
          if ('x' in changes || 'y' in changes) {
            actionType = 'move';
          } else if ('rotation' in changes) {
            actionType = 'rotate';
          }
        }
      }

      update(models => models.map(m =>
        m.id === id ? { ...m, ...changes } : m
      ));

      // Track in history (only for move/rotate)
      if (!skipHistory && historyStore && actionType && before) {
        const models = get({ subscribe });
        const after = models.find(m => m.id === id);

        historyStore.push({
          type: actionType,
          modelId: id,
          before: actionType === 'move'
            ? { x: before.x, y: before.y }
            : { rotation: before.rotation },
          after: actionType === 'move'
            ? { x: after.x, y: after.y }
            : { rotation: after.rotation }
        });
      }
    },

    // Remove a model
    remove(id, skipHistory = false) {
      let removedModel = null;

      if (!skipHistory && historyStore) {
        const models = get({ subscribe });
        removedModel = models.find(m => m.id === id);
      }

      update(models => models.filter(m => m.id !== id));

      // Track in history
      if (!skipHistory && historyStore && removedModel) {
        historyStore.push({
          type: 'remove',
          modelId: id,
          model: { ...removedModel }
        });
      }
    },

    // Remove all models for a player
    removeByPlayer(playerId) {
      update(models => models.filter(m => m.playerId !== playerId));
    },

    // Clear all models
    clear() {
      set([]);
      if (historyStore) {
        historyStore.clear();
      }
    },

    // Undo last action
    undo() {
      if (!historyStore) return;
      const action = historyStore.undo();
      if (!action) return;

      switch (action.type) {
        case 'add':
          // Undo add by removing the model
          this.remove(action.modelId, true);
          break;

        case 'remove':
          // Undo remove by adding the model back
          update(models => [...models, action.model]);
          break;

        case 'move':
          // Undo move by restoring previous position
          this.updateModel(action.modelId, action.before, true);
          break;

        case 'rotate':
          // Undo rotate by restoring previous rotation
          this.updateModel(action.modelId, action.before, true);
          break;
      }
    },

    // Redo last undone action
    redo() {
      if (!historyStore) return;
      const action = historyStore.redo();
      if (!action) return;

      switch (action.type) {
        case 'add':
          // Redo add by adding the model back
          update(models => [...models, action.model]);
          break;

        case 'remove':
          // Redo remove by removing the model
          this.remove(action.modelId, true);
          break;

        case 'move':
          // Redo move by applying new position
          this.updateModel(action.modelId, action.after, true);
          break;

        case 'rotate':
          // Redo rotate by applying new rotation
          this.updateModel(action.modelId, action.after, true);
          break;
      }
    }
  };
}

export const models = createModelsStore(history);

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

// Debug mode models (separate from deployment models)
export const debugModels = createModelsStore(debugHistory);
export const debugSelectedModelId = writable(null);
export const debugSelectedModel = derived(
  [debugModels, debugSelectedModelId],
  ([$debugModels, $debugSelectedModelId]) => {
    if (!$debugSelectedModelId) return null;
    return $debugModels.find(m => m.id === $debugSelectedModelId);
  }
);

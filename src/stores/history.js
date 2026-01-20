import { writable, get } from 'svelte/store';

/**
 * History store for undo/redo functionality
 * Tracks model add, remove, move, and rotate operations
 */

function createHistoryStore() {
  const { subscribe, set, update } = writable({
    past: [],
    future: []
  });

  return {
    subscribe,

    /**
     * Record a new action in history
     * @param {Object} action - { type: 'add'|'remove'|'move'|'rotate', modelId, before, after }
     */
    push(action) {
      update(state => ({
        past: [...state.past, action],
        future: [] // Clear future when new action is taken
      }));
    },

    /**
     * Undo the last action
     * @returns {Object|null} The action that was undone, or null if nothing to undo
     */
    undo() {
      let undoneAction = null;
      update(state => {
        if (state.past.length === 0) return state;

        const past = [...state.past];
        undoneAction = past.pop();

        return {
          past,
          future: [undoneAction, ...state.future]
        };
      });
      return undoneAction;
    },

    /**
     * Redo the last undone action
     * @returns {Object|null} The action that was redone, or null if nothing to redo
     */
    redo() {
      let redoneAction = null;
      update(state => {
        if (state.future.length === 0) return state;

        const future = [...state.future];
        redoneAction = future.shift();

        return {
          past: [...state.past, redoneAction],
          future
        };
      });
      return redoneAction;
    },

    /**
     * Check if undo is available
     */
    canUndo() {
      return get({ subscribe }).past.length > 0;
    },

    /**
     * Check if redo is available
     */
    canRedo() {
      return get({ subscribe }).future.length > 0;
    },

    /**
     * Clear all history
     */
    clear() {
      set({ past: [], future: [] });
    }
  };
}

export const history = createHistoryStore();
export const debugHistory = createHistoryStore();

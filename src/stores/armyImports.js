/**
 * Army Imports Store
 * Manages imported army list metadata
 */

import { writable, get } from 'svelte/store';

const STORAGE_KEY = 'warhammer-imported-armies';

// Load initial data from localStorage
function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Failed to load army imports from storage:', err);
    return [];
  }
}

// Save to localStorage
function saveToStorage(imports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(imports));
  } catch (err) {
    console.error('Failed to save army imports to storage:', err);
  }
}

// Generate unique ID
function generateId() {
  return 'import-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Create the armyImports store
function createArmyImportsStore() {
  const { subscribe, set, update } = writable(loadFromStorage());

  return {
    subscribe,

    /**
     * Add a new import
     * @param {string} name - Import name
     * @param {string} rawText - Raw army list text
     * @param {object} parsedData - Parsed data
     * @param {number} playerId - Player ID (1 or 2)
     * @returns {string} Import ID
     */
    addImport(name, rawText, parsedData, playerId) {
      const id = generateId();
      const importData = {
        id,
        name: name || 'Unnamed Army',
        timestamp: Date.now(),
        rawText,
        parsedData,
        faction: parsedData.FACTION_KEYWORD || 'Unknown',
        totalPoints: parsedData.TOTAL_ARMY_POINTS || '0pts',
        playerId
      };

      update(imports => {
        const updated = [...imports, importData];
        saveToStorage(updated);
        return updated;
      });

      return id;
    },

    /**
     * Remove an import
     * @param {string} id - Import ID
     */
    removeImport(id) {
      update(imports => {
        const updated = imports.filter(imp => imp.id !== id);
        saveToStorage(updated);
        return updated;
      });
    },

    /**
     * Get a specific import
     * @param {string} id - Import ID
     * @returns {object|null}
     */
    getImport(id) {
      const imports = get({ subscribe });
      return imports.find(imp => imp.id === id) || null;
    },

    /**
     * Clear all imports
     */
    clear() {
      set([]);
      saveToStorage([]);
    }
  };
}

export const armyImports = createArmyImportsStore();

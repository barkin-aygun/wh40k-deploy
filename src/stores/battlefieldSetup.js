import { writable, derived } from 'svelte/store';
import { TERRAIN_LAYOUT_PRESETS } from './layout.js';

// Selected deployment and layout
export const selectedDeployment = writable(null);
export const selectedLayoutName = writable(null);
export const selectedLayoutType = writable(null); // 'preset' or 'saved'

// Derived store for loaded terrain based on selection
export const loadedTerrain = derived(
  [selectedLayoutName, selectedLayoutType],
  ([$selectedLayoutName, $selectedLayoutType]) => {
    if (!$selectedLayoutName) {
      return { terrains: [], walls: [] };
    }

    if ($selectedLayoutType === 'preset') {
      const preset = TERRAIN_LAYOUT_PRESETS.find(p => p.name === $selectedLayoutName);
      return preset ? { terrains: preset.terrains || [], walls: preset.walls || [] } : { terrains: [], walls: [] };
    } else if ($selectedLayoutType === 'saved') {
      const saved = localStorage.getItem('warhammer-deployment-layouts');
      if (saved) {
        try {
          const layouts = JSON.parse(saved);
          if (layouts[$selectedLayoutName]) {
            return {
              terrains: layouts[$selectedLayoutName].terrains || [],
              walls: layouts[$selectedLayoutName].walls || []
            };
          }
        } catch (e) {
          console.error('Failed to load layout:', e);
        }
      }
    }

    return { terrains: [], walls: [] };
  }
);

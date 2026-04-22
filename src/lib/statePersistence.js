import { get } from 'svelte/store';
import { selectedDeployment, selectedLayoutName, selectedLayoutType } from '../stores/battlefieldSetup.js';
import { models } from '../stores/models.js';
import { history } from '../stores/history.js';
import { DEPLOYMENT_PRESETS } from '../stores/deployment.js';
import { TERRAIN_LAYOUT_PRESETS } from '../stores/layout.js';

const SAVE_KEY = 'procinctum-state';
const CUSTOM_LAYOUTS_KEY = 'warhammer-deployment-layouts';

function buildStateObject(loadedTerrain) {
  const deployment = get(selectedDeployment);
  const layoutName = get(selectedLayoutName);
  const layoutType = get(selectedLayoutType);
  const modelList = get(models);

  return {
    version: 1,
    deployment: deployment
      ? { name: deployment.name, zones: deployment.zones, objectives: deployment.objectives }
      : null,
    terrain: {
      layoutName,
      layoutType,
      terrains: loadedTerrain.terrains,
      walls: loadedTerrain.walls
    },
    models: modelList
  };
}

export function saveState(loadedTerrain) {
  const state = { ...buildStateObject(loadedTerrain), savedAt: new Date().toISOString() };
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function restoreState() {
  const saved = localStorage.getItem(SAVE_KEY);
  if (!saved) return false;
  try {
    applyState(JSON.parse(saved));
    return true;
  } catch (err) {
    console.error('Failed to restore state:', err);
    return false;
  }
}

export function exportToFile(loadedTerrain, filename) {
  const state = { ...buildStateObject(loadedTerrain), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function applyState(state) {
  if (!state.version) {
    alert('Invalid file: missing version');
    return;
  }

  // Apply deployment
  if (state.deployment) {
    const preset = DEPLOYMENT_PRESETS.find(p => p.name === state.deployment.name);
    if (preset) {
      selectedDeployment.set(preset);
    } else if (state.deployment.zones && state.deployment.objectives) {
      selectedDeployment.set({
        name: state.deployment.name || 'Imported',
        zones: state.deployment.zones,
        objectives: state.deployment.objectives
      });
    }
  } else {
    selectedDeployment.set(null);
  }

  // Apply terrain/layout
  if (state.terrain) {
    const { layoutName, layoutType, terrains, walls } = state.terrain;
    const customLayouts = _getCustomLayouts();

    if (layoutType === 'preset' && layoutName) {
      const preset = TERRAIN_LAYOUT_PRESETS.find(p => p.name === layoutName);
      if (preset) {
        selectedLayoutName.set(layoutName);
        selectedLayoutType.set('preset');
      } else {
        _storeAndSelectLayout(customLayouts, `imported-${Date.now()}`, terrains, walls);
      }
    } else if (layoutType === 'saved' && layoutName) {
      if (customLayouts[layoutName]) {
        selectedLayoutName.set(layoutName);
        selectedLayoutType.set('saved');
      } else {
        // Embed the terrain data under the original name
        _storeAndSelectLayout(customLayouts, layoutName, terrains, walls);
      }
    } else if (terrains || walls) {
      _storeAndSelectLayout(customLayouts, `imported-${Date.now()}`, terrains, walls);
    } else {
      selectedLayoutName.set(null);
      selectedLayoutType.set(null);
    }
  } else {
    selectedLayoutName.set(null);
    selectedLayoutType.set(null);
  }

  // Apply models
  if (state.models && Array.isArray(state.models)) {
    models.set(state.models);
    history.clear();
  }
}

function _getCustomLayouts() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_LAYOUTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function _storeAndSelectLayout(customLayouts, name, terrains, walls) {
  if (!terrains && !walls) return;
  customLayouts[name] = { terrains: terrains || [], walls: walls || [] };
  localStorage.setItem(CUSTOM_LAYOUTS_KEY, JSON.stringify(customLayouts));
  selectedLayoutName.set(name);
  selectedLayoutType.set('saved');
}

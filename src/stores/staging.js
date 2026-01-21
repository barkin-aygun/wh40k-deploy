/**
 * Staging Area Store
 * Manages models in the staging area before deployment to battlefield
 */

import { writable, derived, get } from 'svelte/store';
import { models } from './models.js';

// Staging models store
export const stagingModels = writable([]);

// Staging units store
export const stagingUnits = writable([]);

/**
 * Add models and units to staging area
 * @param {Array} newModels - Array of model objects
 * @param {string} importId - Import ID this came from
 */
export function addStagingModels(newModels, importId) {
  // Group models by unitId
  const unitGroups = {};
  newModels.forEach(model => {
    const unitId = model.unitId || 'ungrouped';
    if (!unitGroups[unitId]) {
      unitGroups[unitId] = [];
    }
    unitGroups[unitId].push(model);
  });

  // Create unit objects
  const newUnits = [];
  for (const unitId in unitGroups) {
    const unitModels = unitGroups[unitId];
    const firstModel = unitModels[0];

    newUnits.push({
      id: unitId,
      name: firstModel.unitName || 'Unknown Unit',
      playerId: firstModel.playerId,
      modelIds: unitModels.map(m => m.id),
      importId
    });
  }

  // Add to stores
  stagingModels.update(existing => [...existing, ...newModels]);
  stagingUnits.update(existing => [...existing, ...newUnits]);
}

/**
 * Remove a model from staging
 * @param {string} modelId - Model ID
 */
export function removeStagingModel(modelId) {
  stagingModels.update(models => models.filter(m => m.id !== modelId));

  // Also update units to remove this modelId
  stagingUnits.update(units => {
    return units.map(unit => ({
      ...unit,
      modelIds: unit.modelIds.filter(id => id !== modelId)
    })).filter(unit => unit.modelIds.length > 0); // Remove empty units
  });
}

/**
 * Remove an entire unit from staging
 * @param {string} unitId - Unit ID
 */
export function removeStagingUnit(unitId) {
  const units = get(stagingUnits);
  const unit = units.find(u => u.id === unitId);

  if (unit) {
    // Remove all models in this unit
    stagingModels.update(models =>
      models.filter(m => !unit.modelIds.includes(m.id))
    );

    // Remove the unit
    stagingUnits.update(units => units.filter(u => u.id !== unitId));
  }
}

/**
 * Deploy models from staging to main battlefield
 * @param {Array} modelIds - Array of model IDs to deploy
 * @param {number} targetX - Target X position on battlefield
 * @param {number} targetY - Target Y position on battlefield
 */
export function deployToMain(modelIds, targetX = 30, targetY = 22) {
  const staging = get(stagingModels);
  const modelsToDeploy = staging.filter(m => modelIds.includes(m.id));

  if (modelsToDeploy.length === 0) return;

  // Calculate offset for multi-model deployment
  const SPACING = 2;
  let offsetX = 0;
  let offsetY = 0;

  // Deploy each model to main battlefield
  modelsToDeploy.forEach((model, index) => {
    const deployedModel = {
      ...model,
      x: targetX + offsetX,
      y: targetY + offsetY,
      inStaging: false
    };

    // Add to main models store
    models.update(existing => [...existing, deployedModel]);

    // Update offset for next model
    offsetX += SPACING;
    if ((index + 1) % 5 === 0) { // New row every 5 models
      offsetX = 0;
      offsetY += SPACING;
    }
  });

  // Remove from staging
  stagingModels.update(models =>
    models.filter(m => !modelIds.includes(m.id))
  );

  // Clean up empty units
  stagingUnits.update(units => {
    return units.map(unit => ({
      ...unit,
      modelIds: unit.modelIds.filter(id => !modelIds.includes(id))
    })).filter(unit => unit.modelIds.length > 0);
  });
}

/**
 * Clear all staging models and units
 */
export function clearStaging() {
  stagingModels.set([]);
  stagingUnits.set([]);
}

/**
 * Get models for a specific unit
 * @param {string} unitId - Unit ID
 * @returns {Array} Models in this unit
 */
export function getModelsForUnit(unitId) {
  const units = get(stagingUnits);
  const unit = units.find(u => u.id === unitId);

  if (!unit) return [];

  const staging = get(stagingModels);
  return staging.filter(m => unit.modelIds.includes(m.id));
}

// Derived stores for filtering by player
export const player1StagingModels = derived(stagingModels, $models =>
  $models.filter(m => m.playerId === 1)
);

export const player2StagingModels = derived(stagingModels, $models =>
  $models.filter(m => m.playerId === 2)
);

export const player1StagingUnits = derived(stagingUnits, $units =>
  $units.filter(u => u.playerId === 1)
);

export const player2StagingUnits = derived(stagingUnits, $units =>
  $units.filter(u => u.playerId === 2)
);

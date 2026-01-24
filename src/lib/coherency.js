/**
 * Unit Coherency Checking for Warhammer 40K
 *
 * Rules:
 * - Units with 6 or fewer models: each model must be within 2" of at least 1 other model
 * - Units with 7+ models: each model must be within 2" of at least 2 other models
 * - The entire unit must form a single connected group (no splitting into subgroups)
 *
 * Distance is measured from base edge to base edge (closest points).
 */

import { getBaseSize, isOvalBase, isRectangularBase } from '../stores/models.js';

const COHERENCY_DISTANCE = 2; // inches

/**
 * Calculate the minimum distance between two model bases (edge to edge)
 * Returns the closest distance between the edges of two bases
 */
export function getModelDistance(modelA, modelB) {
  const centerDist = Math.sqrt(
    Math.pow(modelA.x - modelB.x, 2) + Math.pow(modelA.y - modelB.y, 2)
  );

  // Get effective radii for distance calculation
  const radiusA = getEffectiveRadius(modelA);
  const radiusB = getEffectiveRadius(modelB);

  // Edge-to-edge distance
  return Math.max(0, centerDist - radiusA - radiusB);
}

/**
 * Get an effective radius for a model's base for distance calculations
 * For circles: the actual radius
 * For ovals: the smaller radius (conservative estimate)
 * For rectangles: half the smaller dimension (conservative estimate)
 */
function getEffectiveRadius(model) {
  const baseSize = getBaseSize(model.baseType, model);

  if (!baseSize) return 0.5; // fallback

  if (isRectangularBase(model.baseType)) {
    return Math.min(model.customWidth, model.customHeight) / 2;
  } else if (isOvalBase(model.baseType)) {
    return Math.min(baseSize.width, baseSize.height) / 2;
  } else {
    return baseSize.radius;
  }
}

/**
 * Build an adjacency list for models within coherency distance
 * @param {Array} unitModels - Array of model objects
 * @returns {Map} - Map of modelId -> Set of adjacent model IDs
 */
function buildAdjacencyList(unitModels) {
  const adjacency = new Map();

  // Initialize empty sets for all models
  for (const model of unitModels) {
    adjacency.set(model.id, new Set());
  }

  // Check all pairs and add edges for models within 2"
  for (let i = 0; i < unitModels.length; i++) {
    for (let j = i + 1; j < unitModels.length; j++) {
      const distance = getModelDistance(unitModels[i], unitModels[j]);
      if (distance <= COHERENCY_DISTANCE) {
        adjacency.get(unitModels[i].id).add(unitModels[j].id);
        adjacency.get(unitModels[j].id).add(unitModels[i].id);
      }
    }
  }

  return adjacency;
}

/**
 * Find all connected components in the unit using BFS
 * @param {Array} unitModels - Array of model objects
 * @param {Map} adjacency - Adjacency list
 * @returns {Array} - Array of Sets, each containing model IDs in a connected component
 */
function findConnectedComponents(unitModels, adjacency) {
  const visited = new Set();
  const components = [];

  for (const model of unitModels) {
    if (visited.has(model.id)) continue;

    // BFS to find all models in this component
    const component = new Set();
    const queue = [model.id];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      component.add(currentId);

      // Add all unvisited neighbors to queue
      for (const neighborId of adjacency.get(currentId)) {
        if (!visited.has(neighborId)) {
          queue.push(neighborId);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Check coherency for a single unit (array of models)
 *
 * @param {Array} unitModels - Array of model objects belonging to the same unit
 * @returns {Object} - { isCoherent: boolean, violations: Map<modelId, violationInfo> }
 */
export function checkUnitCoherency(unitModels) {
  // Single model units are always coherent
  if (unitModels.length <= 1) {
    return { isCoherent: true, violations: new Map() };
  }

  const requiredNearby = unitModels.length >= 7 ? 2 : 1;
  const adjacency = buildAdjacencyList(unitModels);
  const components = findConnectedComponents(unitModels, adjacency);

  const violations = new Map();

  // If there's more than one connected component, the unit is split
  const isConnected = components.length === 1;

  // Find the largest component (the "main" group)
  let largestComponent = components[0];
  for (const component of components) {
    if (component.size > largestComponent.size) {
      largestComponent = component;
    }
  }

  for (const model of unitModels) {
    const neighborCount = adjacency.get(model.id).size;
    const isInMainComponent = largestComponent.has(model.id);

    // A model violates coherency if:
    // 1. It doesn't have enough neighbors (based on unit size)
    // 2. OR it's not in the main connected component (unit is split)
    const hasEnoughNeighbors = neighborCount >= requiredNearby;
    const isModelCoherent = hasEnoughNeighbors && isInMainComponent;

    if (!isModelCoherent) {
      violations.set(model.id, {
        model,
        requiredCount: requiredNearby,
        actualCount: neighborCount,
        isDisconnected: !isInMainComponent,
        componentSize: components.find(c => c.has(model.id))?.size || 0
      });
    }
  }

  return {
    isCoherent: violations.size === 0,
    violations,
    componentCount: components.length
  };
}

/**
 * Check coherency for all units in a models array
 *
 * @param {Array} allModels - Array of all model objects
 * @returns {Map} - Map of modelId -> { inCoherency: boolean, requiredCount, actualCount, ... }
 */
export function checkAllUnitsCoherency(allModels) {
  const coherencyStatus = new Map();

  // Group models by unitId
  const unitGroups = new Map();

  for (const model of allModels) {
    if (model.unitId) {
      if (!unitGroups.has(model.unitId)) {
        unitGroups.set(model.unitId, []);
      }
      unitGroups.get(model.unitId).push(model);
    }
    // Models without unitId are not part of a unit, so no coherency check needed
  }

  // Check coherency for each unit
  for (const [unitId, unitModels] of unitGroups) {
    const result = checkUnitCoherency(unitModels);
    const requiredNearby = unitModels.length >= 7 ? 2 : 1;

    // Mark each model's coherency status
    for (const model of unitModels) {
      const violation = result.violations.get(model.id);
      coherencyStatus.set(model.id, {
        inCoherency: !violation,
        requiredCount: requiredNearby,
        actualCount: violation ? violation.actualCount : requiredNearby,
        unitSize: unitModels.length,
        isDisconnected: violation?.isDisconnected || false,
        componentCount: result.componentCount
      });
    }
  }

  return coherencyStatus;
}

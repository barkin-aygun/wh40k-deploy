/**
 * Line of Sight calculations for Warhammer deployment
 * Supports multiple terrain pieces with rotation
 */

import {
  circlePerimeterPoints,
  ellipsePerimeterPoints,
  rectPerimeterPoints,
  circleOverlapsPolygon,
  circleWhollyInPolygon,
  lineIntersectsPolygon,
  findConnectedTerrainGroups,
  getTerrainGroupMembers,
  pointInPolygon
} from './geometry.js';

const NUM_SAMPLE_POINTS = 16;

/**
 * Get perimeter points for a model (circle, ellipse, or rectangle)
 * @param {Object} model - Model with either {x, y, radius} or {x, y, rx, ry, rotation} or {x, y, width, height, rotation, isRectangle}
 * @returns {Array} Array of perimeter points
 */
function getModelPerimeterPoints(model) {
  if (model.isRectangle && model.width !== undefined && model.height !== undefined) {
    // Rectangle
    return rectPerimeterPoints(model.x, model.y, model.width, model.height, model.rotation || 0, NUM_SAMPLE_POINTS);
  } else if (model.radius !== undefined) {
    // Circle
    return circlePerimeterPoints(model.x, model.y, model.radius, NUM_SAMPLE_POINTS);
  } else if (model.rx !== undefined && model.ry !== undefined) {
    // Ellipse
    return ellipsePerimeterPoints(model.x, model.y, model.rx, model.ry, model.rotation || 0, NUM_SAMPLE_POINTS);
  } else {
    // Fallback: treat as circle with default radius
    return circlePerimeterPoints(model.x, model.y, 0.5, NUM_SAMPLE_POINTS);
  }
}

/**
 * Check if a model (circle or ellipse) overlaps a polygon (any part touching)
 * @param {Object} model - Model with either {x, y, radius} or {x, y, rx, ry, rotation}
 * @param {Array} vertices - Polygon vertices
 * @returns {boolean} True if model overlaps polygon
 */
function modelOverlapsPolygon(model, vertices) {
  // For simplicity, check if any perimeter point is inside the polygon
  // Or if center is inside
  // This is an approximation; true overlap test would be more complex
  const points = getModelPerimeterPoints(model);
  for (const point of points) {
    if (pointInPolygon(point, vertices)) {
      return true;
    }
  }
  // Check center
  if (pointInPolygon({ x: model.x, y: model.y }, vertices)) {
    return true;
  }
  return false;
}

/**
 * Check if a model is wholly contained within a polygon (all parts inside)
 * @param {Object} model - Model with either {x, y, radius} or {x, y, rx, ry, rotation} or {x, y, width, height, rotation, isRectangle}
 * @param {Array} vertices - Polygon vertices
 * @returns {boolean} True if model is wholly within polygon
 */
function modelWhollyInPolygon(model, vertices) {
  // Check center first - if center is outside, model can't be wholly inside
  if (!pointInPolygon({ x: model.x, y: model.y }, vertices)) {
    return false;
  }

  // Check all perimeter points - all must be inside
  const points = getModelPerimeterPoints(model);
  for (const point of points) {
    if (!pointInPolygon(point, vertices)) {
      return false;
    }
  }
  return true;
}


/**
 * Check if model A can see model B
 * Rules:
 * - Can see if ANY straight line from any part of A to any part of B is unobstructed
 * - Terrain footprints block vision UNLESS:
 *   - Viewer (A) is WHOLLY WITHIN that terrain (can see out), OR
 *   - Target (B) has ANY part on that terrain (can be seen into)
 * - Walls always block vision (even if model is on terrain)
 *
 * @param {Object} modelA - Viewing model (circle: {x, y, radius}, ellipse: {x, y, rx, ry, rotation}, rect: {x, y, width, height, rotation, isRectangle})
 * @param {Object} modelB - Target model (same formats as modelA)
 * @param {Array} terrainPolygons - Array of {id, vertices} for each terrain footprint
 * @param {Array} walls - Array of wall polygons (each is array of vertices)
 * @returns {Object} { canSee: boolean, rays: Array } rays included for debug visualization
 */
export function checkLineOfSight(modelA, modelB, terrainPolygons, walls) {
  const pointsA = getModelPerimeterPoints(modelA);
  const pointsB = getModelPerimeterPoints(modelB);

  // Find connected terrain groups (terrains sharing edges are treated as one footprint)
  const terrainToGroup = findConnectedTerrainGroups(terrainPolygons);

  // Determine which terrains to ignore for LOS:
  // - Viewer (A) must be WHOLLY WITHIN a terrain to ignore it for outgoing LOS
  // - Target (B) only needs ANY part on terrain to ignore it for incoming LOS
  // If either condition is met, ignore that terrain AND all terrains connected to it
  const terrainsToIgnore = new Set();
  for (const terrain of terrainPolygons) {
    const viewerWhollyInTerrain = modelWhollyInPolygon(modelA, terrain.vertices);
    const targetOnTerrain = modelOverlapsPolygon(modelB, terrain.vertices);
    if (viewerWhollyInTerrain || targetOnTerrain) {
      // Add this terrain and all connected terrains to ignore set
      const groupMembers = getTerrainGroupMembers(terrain.id, terrainToGroup, terrainPolygons);
      for (const memberId of groupMembers) {
        terrainsToIgnore.add(memberId);
      }
    }
  }

  const rays = [];
  let canSee = false;
  let firstClearRay = null;

  // Check all ray combinations
  for (const pA of pointsA) {
    for (const pB of pointsB) {
      const ray = { from: pA, to: pB, blocked: false, blockedBy: null };

      // Check terrain blocking (skip terrains either model is touching)
      let blockedByTerrain = false;
      for (const terrain of terrainPolygons) {
        if (!terrainsToIgnore.has(terrain.id)) {
          if (lineIntersectsPolygon(pA, pB, terrain.vertices)) {
            ray.blocked = true;
            ray.blockedBy = 'terrain';
            blockedByTerrain = true;
            break;
          }
        }
      }

      if (blockedByTerrain) {
        rays.push(ray);
        continue;
      }

      // Check wall blocking
      let blockedByWall = false;
      for (const wall of walls) {
        if (lineIntersectsPolygon(pA, pB, wall)) {
          ray.blocked = true;
          ray.blockedBy = 'wall';
          blockedByWall = true;
          break;
        }
      }

      if (!blockedByWall) {
        ray.blocked = false;
        if (!canSee) {
          firstClearRay = ray; // Store the first clear ray we find
        }
        canSee = true;
      }

      rays.push(ray);
    }
  }

  return { canSee, rays, firstClearRay, terrainsIgnored: Array.from(terrainsToIgnore) };
}

/**
 * Quick check without collecting rays (for performance when debug is off)
 */
export function canSee(modelA, modelB, terrainPolygons, walls) {
  const pointsA = getModelPerimeterPoints(modelA);
  const pointsB = getModelPerimeterPoints(modelB);

  // Find connected terrain groups (terrains sharing edges are treated as one footprint)
  const terrainToGroup = findConnectedTerrainGroups(terrainPolygons);

  // Determine which terrains to ignore for LOS:
  // - Viewer (A) must be WHOLLY WITHIN a terrain to ignore it for outgoing LOS
  // - Target (B) only needs ANY part on terrain to ignore it for incoming LOS
  // If either condition is met, ignore that terrain AND all terrains connected to it
  const terrainsToIgnore = new Set();
  for (const terrain of terrainPolygons) {
    const viewerWhollyInTerrain = modelWhollyInPolygon(modelA, terrain.vertices);
    const targetOnTerrain = modelOverlapsPolygon(modelB, terrain.vertices);
    if (viewerWhollyInTerrain || targetOnTerrain) {
      // Add this terrain and all connected terrains to ignore set
      const groupMembers = getTerrainGroupMembers(terrain.id, terrainToGroup, terrainPolygons);
      for (const memberId of groupMembers) {
        terrainsToIgnore.add(memberId);
      }
    }
  }

  for (const pA of pointsA) {
    for (const pB of pointsB) {
      // Check terrain blocking (skip terrains either model is touching)
      let blocked = false;
      for (const terrain of terrainPolygons) {
        if (!terrainsToIgnore.has(terrain.id)) {
          if (lineIntersectsPolygon(pA, pB, terrain.vertices)) {
            blocked = true;
            break;
          }
        }
      }

      if (blocked) continue;

      // Check wall blocking (always applies, even if on terrain)
      for (const wall of walls) {
        if (lineIntersectsPolygon(pA, pB, wall)) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        return true; // Found a clear line of sight
      }
    }
  }

  return false;
}

/**
 * Check if any model in unit A can see any model in unit B
 * Returns true on first successful LOS (early exit for performance)
 *
 * @param {Array} unitAModels - Array of models in unit A
 * @param {Array} unitBModels - Array of models in unit B
 * @param {Array} terrainPolygons - Array of {id, vertices} for each terrain footprint
 * @param {Array} walls - Array of wall polygons
 * @returns {boolean} True if any model in A can see any model in B
 */
export function unitCanSeeUnit(unitAModels, unitBModels, terrainPolygons, walls) {
  for (const modelA of unitAModels) {
    for (const modelB of unitBModels) {
      if (canSee(modelA, modelB, terrainPolygons, walls)) {
        return true; // Early exit on first clear LOS
      }
    }
  }
  return false;
}

/**
 * Check if any model in unit A can see any model in unit B (with debug data)
 * Returns full ray data for visualization
 *
 * @param {Array} unitAModels - Array of models in unit A
 * @param {Array} unitBModels - Array of models in unit B
 * @param {Array} terrainPolygons - Array of {id, vertices} for each terrain footprint
 * @param {Array} walls - Array of wall polygons
 * @returns {Object} { canSee: boolean, firstClearResult: Object, allResults: Array }
 */
export function checkUnitToUnitLineOfSight(unitAModels, unitBModels, terrainPolygons, walls) {
  const allResults = [];
  let firstClearResult = null;
  let unitCanSeeFlag = false;

  for (const modelA of unitAModels) {
    for (const modelB of unitBModels) {
      const result = checkLineOfSight(modelA, modelB, terrainPolygons, walls);
      allResults.push({
        modelA,
        modelB,
        ...result
      });

      if (result.canSee && !unitCanSeeFlag) {
        unitCanSeeFlag = true;
        firstClearResult = result;
      }
    }
  }

  return {
    canSee: unitCanSeeFlag,
    firstClearResult,
    allResults
  };
}

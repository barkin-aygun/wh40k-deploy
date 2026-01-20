/**
 * Line of Sight calculations for Warhammer deployment
 * Supports multiple terrain pieces with rotation
 */

import {
  circlePerimeterPoints,
  ellipsePerimeterPoints,
  rectPerimeterPoints,
  circleOverlapsPolygon,
  lineIntersectsPolygon,
  findConnectedTerrainGroups,
  getTerrainGroupMembers
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
 * Check if a model (circle or ellipse) overlaps a polygon
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

// Simple point in polygon test
function pointInPolygon(point, vertices) {
  const n = vertices.length;
  let sign = null;

  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];

    const cross = (v2.x - v1.x) * (point.y - v1.y) - (v2.y - v1.y) * (point.x - v1.x);

    if (cross !== 0) {
      const currentSign = cross > 0;
      if (sign === null) {
        sign = currentSign;
      } else if (sign !== currentSign) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if model A can see model B
 * Rules:
 * - Can see if ANY straight line from any part of A to any part of B is unobstructed
 * - Terrain footprints block vision UNLESS viewer (A) has ANY part on that terrain
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

  // For each terrain, check if EITHER model touches it
  // If so, ignore that terrain AND all terrains connected to it (sharing edges)
  const terrainsToIgnore = new Set();
  for (const terrain of terrainPolygons) {
    const viewerOnTerrain = modelOverlapsPolygon(modelA, terrain.vertices);
    const targetOnTerrain = modelOverlapsPolygon(modelB, terrain.vertices);
    if (viewerOnTerrain || targetOnTerrain) {
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

  // For each terrain, check if EITHER model touches it
  // If so, ignore that terrain AND all terrains connected to it (sharing edges)
  const terrainsToIgnore = new Set();
  for (const terrain of terrainPolygons) {
    const viewerOnTerrain = modelOverlapsPolygon(modelA, terrain.vertices);
    const targetOnTerrain = modelOverlapsPolygon(modelB, terrain.vertices);
    if (viewerOnTerrain || targetOnTerrain) {
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

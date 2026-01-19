/**
 * Line of Sight calculations for Warhammer deployment
 * Supports multiple terrain pieces with rotation
 */

import {
  circlePerimeterPoints,
  circleOverlapsPolygon,
  lineIntersectsPolygon
} from './geometry.js';

const NUM_SAMPLE_POINTS = 16;

/**
 * Check if model A can see model B
 * Rules:
 * - Can see if ANY straight line from any part of A to any part of B is unobstructed
 * - Terrain footprints block vision UNLESS viewer (A) has ANY part on that terrain
 * - Walls always block vision (even if model is on terrain)
 *
 * @param {Object} modelA - Viewing model {x, y, radius}
 * @param {Object} modelB - Target model {x, y, radius}
 * @param {Array} terrainPolygons - Array of {id, vertices} for each terrain footprint
 * @param {Array} walls - Array of wall polygons (each is array of vertices)
 * @returns {Object} { canSee: boolean, rays: Array } rays included for debug visualization
 */
export function checkLineOfSight(modelA, modelB, terrainPolygons, walls) {
  const pointsA = circlePerimeterPoints(modelA.x, modelA.y, modelA.radius, NUM_SAMPLE_POINTS);
  const pointsB = circlePerimeterPoints(modelB.x, modelB.y, modelB.radius, NUM_SAMPLE_POINTS);

  // For each terrain, check if EITHER model touches it (if so, that terrain doesn't block)
  const terrainsToIgnore = new Set();
  for (const terrain of terrainPolygons) {
    const viewerOnTerrain = circleOverlapsPolygon(modelA.x, modelA.y, modelA.radius, terrain.vertices);
    const targetOnTerrain = circleOverlapsPolygon(modelB.x, modelB.y, modelB.radius, terrain.vertices);
    if (viewerOnTerrain || targetOnTerrain) {
      terrainsToIgnore.add(terrain.id);
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
  const pointsA = circlePerimeterPoints(modelA.x, modelA.y, modelA.radius, NUM_SAMPLE_POINTS);
  const pointsB = circlePerimeterPoints(modelB.x, modelB.y, modelB.radius, NUM_SAMPLE_POINTS);

  // For each terrain, check if EITHER model touches it
  const terrainsToIgnore = new Set();
  for (const terrain of terrainPolygons) {
    const viewerOnTerrain = circleOverlapsPolygon(modelA.x, modelA.y, modelA.radius, terrain.vertices);
    const targetOnTerrain = circleOverlapsPolygon(modelB.x, modelB.y, modelB.radius, terrain.vertices);
    if (viewerOnTerrain || targetOnTerrain) {
      terrainsToIgnore.add(terrain.id);
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

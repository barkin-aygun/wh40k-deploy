/**
 * 2D Geometry utilities for line of sight calculations
 */

/**
 * Check if two line segments intersect using the CCW (counter-clockwise) method
 * @param {Object} p1 - First point of segment 1 {x, y}
 * @param {Object} p2 - Second point of segment 1 {x, y}
 * @param {Object} p3 - First point of segment 2 {x, y}
 * @param {Object} p4 - Second point of segment 2 {x, y}
 * @returns {boolean} True if segments intersect
 */
export function lineSegmentsIntersect(p1, p2, p3, p4) {
  // Calculate orientations
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  // General case: segments straddle each other
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Special cases: collinear points
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;

  return false;
}

/**
 * Calculate the cross product to determine orientation
 * Returns positive if counter-clockwise, negative if clockwise, 0 if collinear
 */
function direction(p1, p2, p3) {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

/**
 * Check if point p lies on segment (p1, p2) when collinear
 */
function onSegment(p1, p2, p) {
  return (
    Math.min(p1.x, p2.x) <= p.x && p.x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.y, p2.y) <= p.y && p.y <= Math.max(p1.y, p2.y)
  );
}

/**
 * Check if a circle is wholly contained within a rectangle
 * @param {number} cx - Circle center x
 * @param {number} cy - Circle center y
 * @param {number} r - Circle radius
 * @param {Object} rect - Rectangle {x, y, width, height}
 * @returns {boolean} True if circle is wholly within rectangle
 */
export function circleWhollyInRect(cx, cy, r, rect) {
  return (
    cx - r >= rect.x &&
    cx + r <= rect.x + rect.width &&
    cy - r >= rect.y &&
    cy + r <= rect.y + rect.height
  );
}

/**
 * Generate evenly spaced points around a circle's circumference
 * @param {number} cx - Circle center x
 * @param {number} cy - Circle center y
 * @param {number} r - Circle radius
 * @param {number} numPoints - Number of points to generate
 * @returns {Array} Array of {x, y} points
 */
export function circlePerimeterPoints(cx, cy, r, numPoints = 16) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    });
  }
  return points;
}

/**
 * Check if a line segment intersects a rectangle
 * @param {Object} p1 - First point of segment {x, y}
 * @param {Object} p2 - Second point of segment {x, y}
 * @param {Object} rect - Rectangle {x, y, width, height}
 * @returns {boolean} True if segment intersects rectangle
 */
export function lineIntersectsRect(p1, p2, rect) {
  // Rectangle edges
  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };

  // Check intersection with each edge
  if (lineSegmentsIntersect(p1, p2, topLeft, topRight)) return true;      // Top
  if (lineSegmentsIntersect(p1, p2, topRight, bottomRight)) return true;  // Right
  if (lineSegmentsIntersect(p1, p2, bottomRight, bottomLeft)) return true; // Bottom
  if (lineSegmentsIntersect(p1, p2, bottomLeft, topLeft)) return true;    // Left

  // Check if line is entirely inside rectangle
  if (pointInRect(p1, rect) && pointInRect(p2, rect)) return true;

  return false;
}

/**
 * Check if a point is inside a rectangle
 */
function pointInRect(p, rect) {
  return (
    p.x >= rect.x && p.x <= rect.x + rect.width &&
    p.y >= rect.y && p.y <= rect.y + rect.height
  );
}

/**
 * Check if a line segment intersects a polygon
 * @param {Object} p1 - First point of segment {x, y}
 * @param {Object} p2 - Second point of segment {x, y}
 * @param {Array} vertices - Array of polygon vertices [{x, y}, ...]
 * @returns {boolean} True if segment intersects polygon
 */
export function lineIntersectsPolygon(p1, p2, vertices) {
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    if (lineSegmentsIntersect(p1, p2, v1, v2)) {
      return true;
    }
  }
  return false;
}

/**
 * Rotate a point around a center point
 * @param {Object} point - Point to rotate {x, y}
 * @param {Object} center - Center of rotation {x, y}
 * @param {number} angleDeg - Rotation angle in degrees
 * @returns {Object} Rotated point {x, y}
 */
export function rotatePoint(point, center, angleDeg) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

/**
 * Get the center of a terrain piece
 */
export function getTerrainCenter(terrain) {
  return {
    x: terrain.x + terrain.width / 2,
    y: terrain.y + terrain.height / 2
  };
}

/**
 * Get the vertices of a rotated rectangle (terrain footprint)
 * @param {Object} terrain - Terrain {x, y, width, height, rotation}
 * @returns {Array} Array of 4 vertices forming the rotated rectangle
 */
export function getRotatedRectVertices(terrain) {
  const center = getTerrainCenter(terrain);
  const rotation = terrain.rotation || 0;

  // Unrotated corners
  const corners = [
    { x: terrain.x, y: terrain.y },                                    // top-left
    { x: terrain.x + terrain.width, y: terrain.y },                    // top-right
    { x: terrain.x + terrain.width, y: terrain.y + terrain.height },   // bottom-right
    { x: terrain.x, y: terrain.y + terrain.height }                    // bottom-left
  ];

  // Rotate each corner around center
  return corners.map(corner => rotatePoint(corner, center, rotation));
}

/**
 * Get the vertices of an L-shaped wall given terrain position
 * Wall is at bottom-left corner of terrain, 4" horizontal, 8" vertical, 0.5" thick
 * @param {Object} terrain - Terrain {x, y, width, height}
 * @returns {Array} Array of 6 vertices forming the L-shape
 */
export function getLWallVertices(terrain) {
  const WALL_THICKNESS = 0.5;
  const HORIZONTAL_LENGTH = 4;
  const VERTICAL_LENGTH = 8;

  // Bottom-left corner of terrain
  const cornerX = terrain.x;
  const cornerY = terrain.y + terrain.height;

  return [
    { x: cornerX, y: cornerY },                                        // bottom-left
    { x: cornerX, y: cornerY - VERTICAL_LENGTH },                      // top of vertical
    { x: cornerX + WALL_THICKNESS, y: cornerY - VERTICAL_LENGTH },     // inner top
    { x: cornerX + WALL_THICKNESS, y: cornerY - WALL_THICKNESS },      // inner corner
    { x: cornerX + HORIZONTAL_LENGTH, y: cornerY - WALL_THICKNESS },   // inner right
    { x: cornerX + HORIZONTAL_LENGTH, y: cornerY }                     // bottom-right
  ];
}

/**
 * Get the vertices of an L-shaped wall with rotation support
 * @param {Object} terrain - Terrain {x, y, width, height, rotation}
 * @returns {Array} Array of 6 vertices forming the rotated L-shape
 */
export function getLWallVerticesRotated(terrain) {
  const vertices = getLWallVertices(terrain);
  const center = getTerrainCenter(terrain);
  const rotation = terrain.rotation || 0;

  return vertices.map(v => rotatePoint(v, center, rotation));
}

/**
 * Check if a point is inside a convex polygon using cross product method
 * @param {Object} point - Point to check {x, y}
 * @param {Array} vertices - Polygon vertices in order [{x, y}, ...]
 * @returns {boolean} True if point is inside polygon
 */
export function pointInPolygon(point, vertices) {
  const n = vertices.length;
  let sign = null;

  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];

    // Cross product of edge vector and point vector
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
 * Check if a circle is wholly contained within a polygon
 * Tests if all perimeter points of the circle are inside the polygon
 * @param {number} cx - Circle center x
 * @param {number} cy - Circle center y
 * @param {number} r - Circle radius
 * @param {Array} vertices - Polygon vertices [{x, y}, ...]
 * @returns {boolean} True if circle is wholly within polygon
 */
export function circleWhollyInPolygon(cx, cy, r, vertices) {
  // Check center and 8 points around the circumference
  const testPoints = [
    { x: cx, y: cy },
    { x: cx + r, y: cy },
    { x: cx - r, y: cy },
    { x: cx, y: cy + r },
    { x: cx, y: cy - r },
    { x: cx + r * 0.707, y: cy + r * 0.707 },
    { x: cx - r * 0.707, y: cy + r * 0.707 },
    { x: cx + r * 0.707, y: cy - r * 0.707 },
    { x: cx - r * 0.707, y: cy - r * 0.707 }
  ];

  return testPoints.every(p => pointInPolygon(p, vertices));
}

/**
 * Calculate the shortest distance from a point to a line segment
 * @param {Object} p - Point {x, y}
 * @param {Object} v1 - Segment start {x, y}
 * @param {Object} v2 - Segment end {x, y}
 * @returns {number} Distance from point to segment
 */
function pointToSegmentDistance(p, v1, v2) {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Segment is a point
    return Math.sqrt((p.x - v1.x) ** 2 + (p.y - v1.y) ** 2);
  }

  // Project point onto line, clamped to segment
  let t = ((p.x - v1.x) * dx + (p.y - v1.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = v1.x + t * dx;
  const projY = v1.y + t * dy;

  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * Check if a circle overlaps (touches or intersects) a polygon
 * True if ANY part of the circle is on the polygon
 * @param {number} cx - Circle center x
 * @param {number} cy - Circle center y
 * @param {number} r - Circle radius
 * @param {Array} vertices - Polygon vertices [{x, y}, ...]
 * @returns {boolean} True if circle overlaps polygon
 */
export function circleOverlapsPolygon(cx, cy, r, vertices) {
  // Check if center is inside polygon
  if (pointInPolygon({ x: cx, y: cy }, vertices)) {
    return true;
  }

  // Check if any polygon vertex is inside the circle
  for (const v of vertices) {
    const dist = Math.sqrt((v.x - cx) ** 2 + (v.y - cy) ** 2);
    if (dist <= r) {
      return true;
    }
  }

  // Check if any polygon edge intersects the circle
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    if (pointToSegmentDistance({ x: cx, y: cy }, v1, v2) <= r) {
      return true;
    }
  }

  return false;
}

/**
 * PNG export utility for battlefield visualization.
 * Exports terrain, walls, and models without the grid.
 */

import { EXPORT_COLORS } from './exportColors.js';
import { getWallVertices, transformWallVertices } from '../stores/layout.js';
import { getBaseSize, isOvalBase, isRectangularBase } from '../stores/models.js';
import { BATTLEFIELD } from '../stores/elements.js';
import { pathToSvgD, OBJECTIVE_RADIUS, OBJECTIVE_CONTROL_RADIUS } from '../stores/deployment.js';

// Export settings - adjust these for quality/size tradeoff
const EXPORT_SETTINGS = {
  // Pixels per inch in the base SVG (higher = larger file, better quality)
  pixelsPerInch: 50,
  // Additional scale factor applied when converting to PNG (2 = 2x resolution)
  pngScale: 2,
  // Model name font size multipliers (relative to base size)
  fontSizeMultiplier: {
    circle: 0.8,      // 80% of radius
    oval: 0.6,        // 60% of smaller radius
    rectangle: 0.35   // 35% of smaller dimension
  }
};

/**
 * Get rotated rectangle vertices for terrain
 */
function getRotatedRectVertices(terrain) {
  const { x, y, width, height, rotation } = terrain;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const angleRad = (rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Corner offsets from center
  const corners = [
    { dx: -width / 2, dy: -height / 2 },
    { dx: width / 2, dy: -height / 2 },
    { dx: width / 2, dy: height / 2 },
    { dx: -width / 2, dy: height / 2 }
  ];

  return corners.map(({ dx, dy }) => ({
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos
  }));
}

/**
 * Build deployment zone SVG element
 */
function buildZoneSvg(zone) {
  const colors = EXPORT_COLORS.deploymentZone;
  const pathD = pathToSvgD(zone.path);

  return `<path
    d="${pathD}"
    fill="${zone.borderColor}"
    fill-opacity="${colors.fillOpacity}"
    stroke="${zone.borderColor}"
    stroke-width="${colors.strokeWidth}"
    stroke-dasharray="${colors.strokeDasharray}"
  />`;
}

/**
 * Build objective SVG element
 */
function buildObjectiveSvg(objective) {
  const colors = objective.isPrimary ? EXPORT_COLORS.objective.primary : EXPORT_COLORS.objective.secondary;
  const controlColors = EXPORT_COLORS.objective.controlRadius;
  const centerColors = EXPORT_COLORS.objective.centerDot;

  // Control radius circle (outer dashed circle)
  const controlCircle = `<circle
    cx="${objective.x}"
    cy="${objective.y}"
    r="${OBJECTIVE_CONTROL_RADIUS}"
    fill="${colors.fill}"
    fill-opacity="${controlColors.fillOpacity}"
    stroke="${colors.fill}"
    stroke-width="${controlColors.strokeWidth}"
    stroke-dasharray="${controlColors.strokeDasharray}"
  />`;

  // Objective marker (solid circle)
  const markerCircle = `<circle
    cx="${objective.x}"
    cy="${objective.y}"
    r="${OBJECTIVE_RADIUS}"
    fill="${colors.fill}"
    stroke="${colors.stroke}"
    stroke-width="${colors.strokeWidth}"
  />`;

  // Center dot
  const centerDot = `<circle
    cx="${objective.x}"
    cy="${objective.y}"
    r="${centerColors.radius}"
    fill="${centerColors.fill}"
  />`;

  return controlCircle + markerCircle + centerDot;
}

/**
 * Build terrain SVG element
 */
function buildTerrainSvg(terrain) {
  const { x, y, width, height, rotation } = terrain;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const colors = EXPORT_COLORS.terrain;

  return `<rect
    x="${x}"
    y="${y}"
    width="${width}"
    height="${height}"
    transform="rotate(${rotation}, ${cx}, ${cy})"
    fill="${colors.fill}"
    stroke="${colors.stroke}"
    stroke-width="${colors.strokeWidth}"
  />`;
}

/**
 * Build wall SVG element
 */
function buildWallSvg(wall) {
  const vertices = getWallVertices(wall.shape, wall.segments);
  const transformedVertices = transformWallVertices(vertices, wall.x, wall.y, wall.rotation);

  if (transformedVertices.length === 0) return '';

  const pathData = transformedVertices.map((v, i) =>
    `${i === 0 ? 'M' : 'L'} ${v.x} ${v.y}`
  ).join(' ') + ' Z';

  const colors = EXPORT_COLORS.wall;

  return `<path
    d="${pathData}"
    fill="${colors.fill}"
    stroke="${colors.stroke}"
    stroke-width="${colors.strokeWidth}"
  />`;
}

/**
 * Build model SVG element (circle, oval, or rectangle)
 */
function buildModelSvg(model) {
  const baseSize = getBaseSize(model.baseType, model);
  const isOval = isOvalBase(model.baseType);
  const isRect = isRectangularBase(model.baseType);
  const colors = model.playerId === 1 ? EXPORT_COLORS.player1 : EXPORT_COLORS.player2;
  const nameColors = EXPORT_COLORS.modelName;

  let shapeSvg = '';
  let labelFontSize = 0;

  if (isRect) {
    const width = model.customWidth || 0;
    const height = model.customHeight || 0;
    const cx = model.x;
    const cy = model.y;
    labelFontSize = Math.min(width, height) * EXPORT_SETTINGS.fontSizeMultiplier.rectangle;

    shapeSvg = `<g transform="rotate(${model.rotation || 0}, ${cx}, ${cy})">
      <rect
        x="${cx - width / 2}"
        y="${cy - height / 2}"
        width="${width}"
        height="${height}"
        fill="${colors.fill}"
        stroke="${colors.stroke}"
        stroke-width="${colors.strokeWidth}"
      />
    </g>`;
  } else if (isOval) {
    const rx = baseSize.width / 2;
    const ry = baseSize.height / 2;
    labelFontSize = Math.min(rx, ry) * EXPORT_SETTINGS.fontSizeMultiplier.oval;

    shapeSvg = `<g transform="rotate(${model.rotation || 0}, ${model.x}, ${model.y})">
      <ellipse
        cx="${model.x}"
        cy="${model.y}"
        rx="${rx}"
        ry="${ry}"
        fill="${colors.fill}"
        stroke="${colors.stroke}"
        stroke-width="${colors.strokeWidth}"
      />
    </g>`;
  } else {
    const radius = baseSize?.radius || 0.5;
    labelFontSize = radius * EXPORT_SETTINGS.fontSizeMultiplier.circle;

    shapeSvg = `<circle
      cx="${model.x}"
      cy="${model.y}"
      r="${radius}"
      fill="${colors.fill}"
      stroke="${colors.stroke}"
      stroke-width="${colors.strokeWidth}"
    />`;
  }

  // Add name label if present
  let nameSvg = '';
  if (model.name) {
    nameSvg = `<text
      x="${model.x}"
      y="${model.y}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="${labelFontSize}"
      font-weight="${nameColors.fontWeight}"
      fill="${nameColors.fill}"
      stroke="${nameColors.stroke}"
      stroke-width="${nameColors.strokeWidth}"
      paint-order="stroke"
    >${escapeXml(model.name)}</text>`;
  }

  return shapeSvg + nameSvg;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build complete SVG string for export
 */
function buildExportSvg(terrains, walls, models, deployment = null) {
  const width = BATTLEFIELD.width;
  const height = BATTLEFIELD.height;
  const bgColor = EXPORT_COLORS.battlefield.fill;
  const ppi = EXPORT_SETTINGS.pixelsPerInch;

  const terrainsSvg = terrains.map(buildTerrainSvg).join('\n    ');
  const wallsSvg = walls.map(buildWallSvg).join('\n    ');
  const modelsSvg = models.map(buildModelSvg).join('\n    ');

  // Deployment zones and objectives (if provided)
  const zonesSvg = deployment?.zones ? deployment.zones.map(buildZoneSvg).join('\n    ') : '';
  const objectivesSvg = deployment?.objectives ? deployment.objectives.map(buildObjectiveSvg).join('\n    ') : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * ppi}" height="${height * ppi}">
  <!-- Battlefield background -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="${bgColor}" />

  <!-- Deployment zones -->
  <g id="deployment-zones">
    ${zonesSvg}
  </g>

  <!-- Objectives -->
  <g id="objectives">
    ${objectivesSvg}
  </g>

  <!-- Terrain pieces -->
  <g id="terrains">
    ${terrainsSvg}
  </g>

  <!-- Wall pieces -->
  <g id="walls">
    ${wallsSvg}
  </g>

  <!-- Model bases -->
  <g id="models">
    ${modelsSvg}
  </g>
</svg>`;
}

/**
 * Convert SVG string to PNG blob
 */
function svgToPng(svgString, scale = 1) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob'));
        }
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };

    img.src = url;
  });
}

/**
 * Export battlefield as PNG
 * @param {Array} terrains - Array of terrain objects from layoutTerrains store
 * @param {Array} walls - Array of wall objects from layoutWalls store
 * @param {Array} models - Array of model objects (optional, from models store)
 * @param {string} filename - Output filename (without extension)
 * @param {Object} deployment - Deployment data with zones and objectives (optional)
 */
export async function exportBattlefieldPng(terrains, walls, models = [], filename = 'battlefield', deployment = null) {
  try {
    const svgString = buildExportSvg(terrains, walls, models, deployment);
    const pngBlob = await svgToPng(svgString, EXPORT_SETTINGS.pngScale);

    // Trigger download
    const url = URL.createObjectURL(pngBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Failed to export PNG:', error);
    throw error;
  }
}

/**
 * Export battlefield as SVG (for users who prefer vector format)
 * @param {Array} terrains - Array of terrain objects
 * @param {Array} walls - Array of wall objects
 * @param {Array} models - Array of model objects (optional)
 * @param {string} filename - Output filename (without extension)
 */
export function exportBattlefieldSvg(terrains, walls, models = [], filename = 'battlefield') {
  const svgString = buildExportSvg(terrains, walls, models);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}

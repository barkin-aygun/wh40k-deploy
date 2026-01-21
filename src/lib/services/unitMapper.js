/**
 * Unit Mapper Service
 * Maps parsed army list units to model objects with base sizes
 */

import { getUnitBaseSize, getFactions, getUnitsForFaction } from '../../stores/units.js';
import { parseQuantity } from './armyParser.js';

/**
 * Map parsed units to model objects
 * @param {object} parsedData - Normalized parsed army data
 * @param {number} playerId - Player ID (1 or 2)
 * @returns {{matched: Array, unmatched: Array}}
 */
export function mapParsedUnitsToModels(parsedData, playerId) {
  const faction = parsedData.FACTION_KEYWORD;
  const units = parsedData.UNITS || [];

  const matched = [];
  const unmatched = [];

  // Track unit names for duplicate handling
  const unitNameCounts = {};

  for (const unit of units) {
    const unitName = unit.name || '';
    const quantity = parseQuantity(unit.quantity);

    // Get base size from unitBases.json
    let baseInfo = getUnitBaseSize(faction, unitName);

    // If not found, try fuzzy matching in current faction
    if (!baseInfo) {
      const fuzzyMatch = fuzzyMatchUnit(unitName, faction);
      if (fuzzyMatch) {
        baseInfo = getUnitBaseSize(faction, fuzzyMatch);
      }
    }

    // If still not found, search all factions
    if (!baseInfo) {
      const { faction: foundFaction, unitName: foundUnitName } = searchAllFactions(unitName);
      if (foundFaction && foundUnitName) {
        baseInfo = getUnitBaseSize(foundFaction, foundUnitName);
      }
    }

    if (baseInfo) {
      // Track duplicate unit names
      if (!unitNameCounts[unitName]) {
        unitNameCounts[unitName] = 0;
      }
      unitNameCounts[unitName]++;

      const unitSuffix = unitNameCounts[unitName] > 1 ? ` #${unitNameCounts[unitName]}` : '';
      const displayName = `${unitName}${unitSuffix}`;

      // Create models for this unit
      const models = createModelsForUnit(
        baseInfo,
        quantity,
        playerId,
        displayName,
        unit
      );

      matched.push(...models);
    } else {
      // Add to unmatched list with unique ID
      unmatched.push({
        id: 'unmatched-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        unitName,
        quantity,
        points: unit.points,
        section: unit.section
      });
    }
  }

  // Calculate staging positions for matched models
  const modelsWithPositions = calculateStagingPositions(matched);

  return {
    matched: modelsWithPositions,
    unmatched
  };
}

/**
 * Create model objects for a unit
 * @param {object} baseInfo - Base size information from unitBases.json
 * @param {number} quantity - Number of models
 * @param {number} playerId - Player ID
 * @param {string} displayName - Unit display name
 * @param {object} unitData - Original unit data
 * @returns {Array} Array of model objects
 */
function createModelsForUnit(baseInfo, quantity, playerId, displayName, unitData) {
  const models = [];
  const unitId = generateUnitId();
  const baseType = baseInfo.baseType;

  // Generate label (initials or full name based on base size)
  const label = generateModelLabel(displayName, baseType);

  for (let i = 0; i < quantity; i++) {
    const modelId = generateModelId();
    const model = {
      id: modelId,
      baseType,
      playerId,
      x: 0, // Will be set by calculateStagingPositions
      y: 0,
      rotation: 0,
      unitId,
      unitName: displayName,
      name: label, // Display label (initials for small bases, full name for large)
      imported: true,
      inStaging: true
    };

    // Handle hull/vehicle bases
    if (baseType === 'hull') {
      model.baseType = 'rect-custom';
      model.customWidth = baseInfo.hullDimensions?.width || 5.5;
      model.customHeight = baseInfo.hullDimensions?.height || 3;
    }

    models.push(model);
  }

  return models;
}

/**
 * Calculate staging area positions for models
 * @param {Array} models - Array of model objects
 * @returns {Array} Models with updated positions
 */
export function calculateStagingPositions(models) {
  const SPACING = 2; // 2" spacing between models
  const STAGING_X_START = 2; // Start 2" from left
  const STAGING_Y_START = 2; // Start 2" from top
  const MAX_COLS = 6; // Max models per row (fits in 30" wide viewBox)

  // Group models by unitId
  const unitGroups = {};
  models.forEach(model => {
    const unitId = model.unitId || 'ungrouped';
    if (!unitGroups[unitId]) {
      unitGroups[unitId] = [];
    }
    unitGroups[unitId].push(model);
  });

  let currentX = STAGING_X_START;
  let currentY = STAGING_Y_START;
  let colCount = 0;

  // Place each unit group
  for (const unitId in unitGroups) {
    const unitModels = unitGroups[unitId];

    for (const model of unitModels) {
      model.x = currentX;
      model.y = currentY;

      currentX += SPACING;
      colCount++;

      // Move to next row if we've reached max columns
      if (colCount >= MAX_COLS) {
        currentX = STAGING_X_START;
        currentY += SPACING;
        colCount = 0;
      }
    }

    // Add spacing between units (start new row)
    if (colCount > 0) {
      currentX = STAGING_X_START;
      currentY += SPACING;
      colCount = 0;
    }
  }

  return models;
}

/**
 * Fuzzy match a unit name to database entries
 * @param {string} unitName - Unit name to match
 * @param {string} faction - Faction name
 * @returns {string|null} Matched unit name or null
 */
export function fuzzyMatchUnit(unitName, faction) {
  const unitsInFaction = getUnitsForFaction(faction);
  if (!unitsInFaction || unitsInFaction.length === 0) {
    return null;
  }

  const normalized = normalizeUnitName(unitName);

  // Try exact match first (case-insensitive)
  for (const dbUnit of unitsInFaction) {
    if (normalizeUnitName(dbUnit) === normalized) {
      return dbUnit;
    }
  }

  // Try plural variations
  const singularized = normalized.replace(/s$/, '');
  const pluralized = normalized + 's';

  for (const dbUnit of unitsInFaction) {
    const dbNormalized = normalizeUnitName(dbUnit);
    if (dbNormalized === singularized || dbNormalized === pluralized) {
      return dbUnit;
    }
  }

  // Try partial match (unit name contains or is contained in db name)
  for (const dbUnit of unitsInFaction) {
    const dbNormalized = normalizeUnitName(dbUnit);
    if (normalized.includes(dbNormalized) || dbNormalized.includes(normalized)) {
      return dbUnit;
    }
  }

  // Try word-based matching (all words in search appear in db entry)
  const searchWords = normalized.split(/\s+/).filter(w => w.length > 2);
  if (searchWords.length > 0) {
    for (const dbUnit of unitsInFaction) {
      const dbNormalized = normalizeUnitName(dbUnit);
      if (searchWords.every(word => dbNormalized.includes(word))) {
        return dbUnit;
      }
    }
  }

  return null;
}

/**
 * Search all factions for a unit
 * @param {string} unitName - Unit name to search for
 * @returns {{faction: string|null, unitName: string|null}} Matched faction and unit name
 */
function searchAllFactions(unitName) {
  const allFactions = getFactions();
  const normalized = normalizeUnitName(unitName);

  // Try exact match in all factions
  for (const faction of allFactions) {
    const unitsInFaction = getUnitsForFaction(faction);
    if (!unitsInFaction) continue;

    for (const dbUnit of unitsInFaction) {
      if (normalizeUnitName(dbUnit) === normalized) {
        return { faction, unitName: dbUnit };
      }
    }
  }

  // Try fuzzy matching in all factions
  for (const faction of allFactions) {
    const fuzzyMatch = fuzzyMatchUnit(unitName, faction);
    if (fuzzyMatch) {
      return { faction, unitName: fuzzyMatch };
    }
  }

  return { faction: null, unitName: null };
}

/**
 * Normalize a unit name for comparison
 * @param {string} name - Unit name
 * @returns {string} Normalized name
 */
function normalizeUnitName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Generate unique unit ID
 * @returns {string}
 */
function generateUnitId() {
  return 'unit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate a display label for a model based on base size
 * @param {string} unitName - Full unit name
 * @param {string} baseType - Base type (e.g., '32mm', '50mm', 'rect-custom')
 * @returns {string} Label to display on the model
 */
function generateModelLabel(unitName, baseType) {
  if (!unitName) return '';

  // Extract base size in mm for circles
  const sizeMatch = baseType.match(/(\d+)mm/);
  const baseSizeMm = sizeMatch ? parseInt(sizeMatch[1], 10) : null;

  // For small bases (< 50mm), use initials
  // For large bases (>= 50mm) or rectangles, use full name
  if (baseSizeMm && baseSizeMm < 50) {
    return generateInitials(unitName);
  }

  return unitName;
}

/**
 * Generate initials from a unit name
 * @param {string} name - Full name
 * @returns {string} Initials
 */
function generateInitials(name) {
  if (!name) return '';

  // Remove # suffixes like " #2"
  const cleanName = name.replace(/\s*#\d+$/, '');

  // Split on spaces and get first letter of each word
  const words = cleanName.split(/\s+/).filter(w => w.length > 0);

  // Take first letter of first 3 words maximum
  const initials = words
    .slice(0, 3)
    .map(word => word[0].toUpperCase())
    .join('');

  return initials;
}

/**
 * Generate unique model ID
 * @returns {string}
 */
function generateModelId() {
  return 'model-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

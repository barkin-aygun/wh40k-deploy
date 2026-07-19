/**
 * Army List Parser Service
 * Wrapper around 40kCompactor library for parsing army lists (11th edition only)
 */

import {
  detectFormat,
  parseV11List,
  parseGwAppV11,
  parseWarOrganV11,
  parseNRWTCCompact,
  parseNRWTC,
  parseNRGW
} from '40k-compactor/modules/parsers.js';
import skippableWargearMap from '40k-compactor/skippable_wargear.json' with { type: 'json' };

const PARSERS = {
  V11_GENERIC: parseV11List,
  GW_APP_V11: parseGwAppV11,
  WAR_ORGAN_V11: parseWarOrganV11,
  NR_WTC_COMPACT: parseNRWTCCompact,
  NR_WTC: parseNRWTC,
  NR_GW: parseNRGW
};

/**
 * Parse an army list from text
 * @param {string} text - Raw army list text
 * @returns {Promise<{format: string, data: object}>}
 */
export async function parseArmyList(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid army list text');
  }

  const lines = text.split('\n');

  // Detect the format
  const format = detectFormat(lines);

  const parser = PARSERS[format];
  if (!parser) {
    throw new Error('Unable to detect army list format. Supported formats: 11th Edition GW App, War Organ, New Recruit (WTC, WTC-Compact, GW/NR)');
  }

  let parsedData;
  try {
    parsedData = parser(lines, skippableWargearMap);
  } catch (err) {
    console.error('Parse error:', err);
    throw new Error(`Failed to parse ${format} format: ${err.message}`);
  }

  // Normalize the parsed data structure
  const normalized = normalizeArmyData(parsedData);

  return {
    format,
    data: normalized
  };
}

/**
 * Normalize parsed data (the library's {metadata, units[]} shape) into a
 * consistent structure. "Attached Units" groups are flattened so each
 * character/bodyguard unit appears as its own flat entry, matching how every
 * other section's units are represented.
 * @param {object} parsedData - Raw parsed data from 40kCompactor
 * @returns {object} Normalized data
 */
function normalizeArmyData(parsedData) {
  const metadata = parsedData.metadata || {};

  const units = [];
  for (const unit of parsedData.units || []) {
    if (unit.isAttached && Array.isArray(unit.attachedParts)) {
      units.push(...unit.attachedParts.map(part => ({ ...part, section: part.category || unit.category })));
    } else {
      units.push({ ...unit, section: unit.category });
    }
  }

  const detachment = Array.isArray(metadata.detachments) && metadata.detachments.length
    ? metadata.detachments.join(' and ')
    : (metadata.detachment || '');
  const totalPoints = metadata.pointsTotal || metadata.totalPoints || 0;
  const pointsLimit = metadata.pointsLimit || 0;

  return {
    FACTION_KEYWORD: metadata.faction || 'Unknown',
    DETACHMENT: detachment,
    TOTAL_ARMY_POINTS: pointsLimit ? `${totalPoints} / ${pointsLimit}pts` : `${totalPoints}pts`,
    LIST_TITLE: metadata.title || metadata.armyName || '',
    UNITS: units
  };
}

/**
 * Extract unit count from quantity string (e.g., "3x" -> 3)
 * @param {string} quantity - Quantity string
 * @returns {number}
 */
export function parseQuantity(quantity) {
  if (!quantity) return 1;
  const match = String(quantity).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

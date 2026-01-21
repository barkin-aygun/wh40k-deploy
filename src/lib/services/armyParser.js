/**
 * Army List Parser Service
 * Wrapper around 40kCompactor library for parsing army lists
 */

import {
  detectFormat,
  parseGwApp,
  parseWtc,
  parseWtcCompact,
  parseNrGw,
  parseNrNr,
  parseLf
} from '40k-compactor';

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

  if (format === 'UNKNOWN') {
    throw new Error('Unable to detect army list format. Supported formats: GW App, WTC, WTC Compact, NR-GW, NR-NR, ListForge');
  }

  let parsedData;

  try {
    // Parse based on detected format
    switch (format) {
      case 'GW_APP':
        parsedData = parseGwApp(lines);
        break;
      case 'WTC':
        parsedData = parseWtc(lines);
        break;
      case 'WTC_COMPACT':
        parsedData = parseWtcCompact(lines);
        break;
      case 'NR_GW':
        parsedData = parseNrGw(lines);
        break;
      case 'NRNR':
        parsedData = parseNrNr(lines);
        break;
      case 'LF':
        parsedData = parseLf(lines);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (err) {
    console.error('Parse error:', err);
    throw new Error(`Failed to parse ${format} format: ${err.message}`);
  }

  // Normalize the parsed data structure
  const normalized = normalizeArmyData(parsedData, format);

  return {
    format,
    data: normalized
  };
}

/**
 * Normalize parsed data from different formats into a consistent structure
 * @param {object} parsedData - Raw parsed data from 40kCompactor
 * @param {string} format - Detected format
 * @returns {object} Normalized data
 */
function normalizeArmyData(parsedData, format) {
  const summary = parsedData.SUMMARY || {};

  // Collect all units from different sections
  const units = [];

  // Common sections to check
  const sections = [
    'CHARACTER',
    'CHARACTERS',
    'BATTLELINE',
    'OTHER DATASHEETS',
    'ALLIED UNITS',
    'DEDICATED TRANSPORTS'
  ];

  for (const section of sections) {
    if (parsedData[section] && Array.isArray(parsedData[section])) {
      units.push(...parsedData[section].map(unit => ({
        ...unit,
        section
      })));
    }
  }

  return {
    FACTION_KEYWORD: summary.FACTION_KEYWORD || summary.FACTION_KEY || 'Unknown',
    DETACHMENT: summary.DETACHMENT || '',
    TOTAL_ARMY_POINTS: summary.TOTAL_ARMY_POINTS || '0pts',
    LIST_TITLE: summary.LIST_TITLE || '',
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

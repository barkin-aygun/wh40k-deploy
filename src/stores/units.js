/**
 * Unit base size data store
 * Provides access to unit base information from unitBases.json
 */

import unitBasesData from '../data/unitBases.json';

/**
 * Get all faction names
 * @returns {string[]} Array of faction names
 */
export function getFactions() {
  return Object.keys(unitBasesData);
}

/**
 * Get all unit names for a faction
 * @param {string} faction - Faction name
 * @returns {string[]} Array of unit names
 */
export function getUnitsForFaction(faction) {
  const factionData = unitBasesData[faction];
  if (!factionData) return [];
  return Object.keys(factionData);
}

/**
 * Get base size info for a specific unit
 * @param {string} faction - Faction name
 * @param {string} unitName - Unit name
 * @returns {object|null} Base info object or null if not found
 */
export function getUnitBaseSize(faction, unitName) {
  const factionData = unitBasesData[faction];
  if (!factionData) return null;
  return factionData[unitName] || null;
}

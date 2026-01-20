import { writable, derived } from 'svelte/store';
import unitBasesData from '../data/unitBases.json';

// Store containing all unit base data
export const unitBases = writable(unitBasesData);

// Get all available factions
export function getFactions() {
  return Object.keys(unitBasesData);
}

// Get all units for a specific faction
export function getUnitsForFaction(faction) {
  if (!unitBasesData[faction]) {
    return [];
  }
  return Object.keys(unitBasesData[faction]);
}

// Get base size information for a specific faction and unit
export function getUnitBaseSize(faction, unitName) {
  if (!unitBasesData[faction] || !unitBasesData[faction][unitName]) {
    return null;
  }
  return unitBasesData[faction][unitName];
}

// Derived store: list of all factions
export const factions = derived(unitBases, $unitBases => {
  return Object.keys($unitBases);
});

// Create a derived store for units of a selected faction
export function createUnitsForFaction(factionStore) {
  return derived([unitBases, factionStore], ([$unitBases, $faction]) => {
    if (!$faction || !$unitBases[$faction]) {
      return [];
    }
    return Object.keys($unitBases[$faction]);
  });
}

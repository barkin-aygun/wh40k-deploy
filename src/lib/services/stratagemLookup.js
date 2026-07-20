/**
 * Stratagem lookup — sourced from the community-owned @alpaca-software/40kdc-data
 * package (see scripts/gen-stratagems.mjs), not BSData. That project deliberately
 * doesn't store GW's copyrighted rule text, so most stratagems here carry only
 * metadata (CP cost, phase, timing, type, targeting) — `text` is empty unless
 * 40kdc-data had a structured Ability DSL definition to render into English.
 */

import stratagemData from '../../data/stratagems11e.js';
import { normalizeFactionKey } from './wargearDictionary.js';

// Must match scripts/gen-stratagems.mjs's slugify() exactly — both need to
// land on the same slug 40kdc-data uses for faction_id/detachment_id.
function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’‘‛′]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The 10 universal stratagems every army can use, regardless of faction. */
export function getCoreStratagems() {
  return stratagemData.core || [];
}

/**
 * Detachment-specific stratagems for a list's detachment string — may combine
 * several ("Advanced Acquisition Cadre and Kauyon"), each contributing its own.
 */
export function getDetachmentStratagems(faction, detachmentString) {
  const factionSlug = slugify(normalizeFactionKey(faction));
  const aliasedSlug = stratagemData.factionAliases?.[factionSlug] || factionSlug;
  const byDetachment = stratagemData.factions?.[aliasedSlug];
  if (!byDetachment) return [];

  const dstr = slugify(detachmentString || '');
  if (!dstr) return [];

  const out = [];
  for (const [detSlug, list] of Object.entries(byDetachment)) {
    // Guard against trivially-short slugs causing spurious matches.
    if (detSlug.length >= 4 && dstr.includes(detSlug)) out.push(...list);
  }
  return out;
}

/** Roster-level stratagems (not per-unit): core + this list's detachment ones. */
export function buildRosterStratagems(normalized) {
  return {
    core: getCoreStratagems(),
    detachment: getDetachmentStratagems(normalized.faction, normalized.detachment),
  };
}

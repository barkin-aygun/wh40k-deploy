/**
 * Datasheet lookup — combines the static datasheet (stats, abilities,
 * keywords, weapon profiles, enhancement text) with what a specific unit in an
 * expanded army list actually has equipped, producing a render-ready datasheet.
 * Data source: @alpaca-software/40kdc-data (see scripts/gen-datasheets.mjs).
 *
 * Pairs with armyExpander.js: feed it normalized.units[] entries.
 */

import details from '../../data/datasheetDetails11e.js';
import { normKey, normalizeFactionKey, SM_CHAPTERS } from './wargearDictionary.js';

function pluralVariants(nameLower) {
  const v = new Set([nameLower]);
  v.add(nameLower.endsWith('s') ? nameLower.slice(0, -1) : nameLower + 's');
  return v;
}

/** Find a value in a {faction: {key: value}} map, own-faction first, then cross-faction. */
function lookupWithFallback(map, faction, name) {
  if (!name) return null;
  const nameLower = name.toString().toLowerCase().trim();
  const variants = pluralVariants(nameLower);

  const tryBucket = (bucket) => {
    if (!bucket) return null;
    for (const v of variants) if (bucket[v]) return bucket[v];
    const wants = new Set([...variants].map(normKey));
    for (const k of Object.keys(bucket)) if (wants.has(normKey(k))) return bucket[k];
    return null;
  };
  const bucketFor = (leaf) => {
    const key = Object.keys(map).find((k) => normKey(k) === normKey(leaf));
    return key ? map[key] : null;
  };

  const leaf = normalizeFactionKey(faction);
  const own = tryBucket(bucketFor(leaf));
  if (own) return own;

  // Cross-faction fallback (e.g. a generic "Space Marines" header running a
  // Chapter-unique character like Azrael, whose datasheet only lives under
  // "Dark Angels"; or the reverse — Chapter header, core-SM generic unit).
  for (const f of Object.keys(map)) {
    const hit = tryBucket(map[f]);
    if (hit) return hit;
  }
  return null;
}

/** Static datasheet: { name, factionKeyword, keywords[], abilities[], stats[] }. */
export function getDatasheet(faction, unitName) {
  return lookupWithFallback(details.datasheets || {}, faction, unitName);
}

/** Weapon stat profile: { name, typeName, profiles: [{mode, chars}] }. */
export function getWeaponProfile(faction, itemName) {
  return lookupWithFallback(details.weaponProfiles || {}, faction, itemName);
}

/** Enhancement text/points: { name, text, points }. Searches every detachment
 *  bucket under the faction (cross-faction too) since by lookup time the
 *  expander has already resolved the enhancement to its canonical full name. */
export function getEnhancementDetail(faction, enhancementName) {
  if (!enhancementName) return null;
  const want = normKey(enhancementName);
  const map = details.detachmentEnhancementDetails || {};
  const leaf = normKey(normalizeFactionKey(faction));

  const searchBuckets = (factionKeys) => {
    for (const fk of factionKeys) {
      const dets = map[fk];
      if (!dets) continue;
      for (const det of Object.values(dets)) {
        for (const [key, val] of Object.entries(det)) {
          if (normKey(key) === want || normKey(val.name) === want) return val;
        }
      }
    }
    return null;
  };

  const ownKey = Object.keys(map).find((k) => normKey(k) === leaf);
  if (ownKey) {
    const hit = searchBuckets([ownKey]);
    if (hit) return hit;
  }
  return searchBuckets(Object.keys(map));
}

/** Faction-wide Army Rule: { name, text } | null. Own faction only — unlike
 *  getDatasheet's cross-faction fallback, a blind scan across factions would
 *  risk attributing the wrong faction's rule, so an unmatched faction (e.g. a
 *  sub-faction whose datasheets live entirely under a parent bucket) is left
 *  unresolved rather than guessed. */
export function getArmyRule(faction) {
  const map = details.armyRules || {};
  const fkey = Object.keys(map).find((k) => normKey(k) === normKey(normalizeFactionKey(faction)));
  return fkey ? map[fkey] : null;
}

/**
 * Detachment rule(s) for a list's detachment string — may combine several
 * ("Advanced Acquisition Cadre and Kauyon"), each contributing its own rule.
 * @returns {Array<{name, ruleName, ruleText}>}
 */
export function getDetachmentRules(faction, detachmentString) {
  const map = details.detachmentRules || {};
  const dstr = normKey(detachmentString || '');
  if (!dstr) return [];

  const fkey = Object.keys(map).find((k) => normKey(k) === normKey(normalizeFactionKey(faction)));
  const dets = fkey ? map[fkey] : null;
  if (!dets) return [];

  const out = [];
  for (const [det, val] of Object.entries(dets)) {
    // Guard against trivially-short detachment keys causing spurious matches.
    if (normKey(det).length >= 4 && dstr.includes(normKey(det))) out.push(val);
  }
  return out;
}

/** Roster-level rules (not per-unit): the faction's Army Rule plus this list's
 *  detachment rule(s). */
export function buildRosterRules(normalized) {
  return {
    armyRule: getArmyRule(normalized.faction),
    detachmentRules: getDetachmentRules(normalized.faction, normalized.detachment),
  };
}

function resolveWargearList(faction, list) {
  return (list || []).map((w) => ({
    name: w.name,
    quantity: w.quantity ?? 1,
    profile: getWeaponProfile(faction, w.name),
  }));
}

/**
 * Build a render-ready datasheet for one unit from expandArmyList's
 * normalized.units[] shape.
 * @param {string} faction
 * @param {object} unit - one entry of normalized.units
 * @returns {object} { ...unit, found, factionKeyword, keywords, stats,
 *   abilities, wargear (with resolved profiles), models (ditto),
 *   enhancements (with resolved text) }
 */
export function buildUnitDatasheet(faction, unit) {
  const sheet = getDatasheet(faction, unit.name);
  const enhancements = (unit.enhancements || []).map((e) => {
    const detail = getEnhancementDetail(faction, e.name);
    // A real enhancement never costs 0 points, so a parsed 0 means "the source
    // text had no inline point suffix" — prefer the authoritative corpus value.
    const points = e.points || detail?.points || null;
    return { name: e.name, points, text: detail?.text || '' };
  });

  return {
    name: unit.name,
    quantity: unit.quantity,
    points: unit.points,
    warlord: unit.warlord,
    attachment: unit.attachment,
    section: unit.section,
    found: !!sheet,
    factionKeyword: sheet?.factionKeyword || faction,
    keywords: sheet?.keywords || [],
    stats: sheet?.stats || [],
    abilities: sheet?.abilities || [],
    enhancements,
    wargear: resolveWargearList(faction, unit.wargear),
    models: (unit.models || []).map((m) => ({
      name: m.name,
      quantity: m.quantity,
      wargear: resolveWargearList(faction, m.wargear),
    })),
  };
}

/** Build datasheets for every unit in a normalized army list. */
export function buildArmyDatasheets(normalized) {
  return (normalized.units || []).map((u) => buildUnitDatasheet(normalized.faction, u));
}

export { SM_CHAPTERS };

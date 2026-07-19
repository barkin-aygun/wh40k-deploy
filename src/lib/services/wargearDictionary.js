/**
 * Wargear abbreviation dictionary + reverse index for the army expander.
 *
 * The 40kCompactor generates abbreviations *algorithmically* from full item names
 * (there is no lookup table). To reverse them we replicate that exact algorithm,
 * pre-compute every abbreviation a known full name could produce, and index them.
 *
 * Abbreviation rules (mirrored from 40k-compactor/modules/abbreviations.js):
 *   - Strip parentheticals, turn hyphens into spaces, drop quote/punctuation.
 *   - Single word  -> first two letters uppercased ("Plasma" -> "PL").
 *   - Multi word   -> per word: "and" -> "&", "of" -> "o", else first letter uppercased
 *                     ("Icon of Khorne" -> "IoK").
 *   - On collision the compactor expands conflicting words one letter at a time
 *     ("Power fist"/"Power weapon" -> "PoFi"/"PoWe"). We generate those stepped
 *     forms too so either the base or an expanded form resolves.
 */

import datasheets from '../../data/datasheets11e.js'; // BSData/wh40k-11e — primary corpus
import wargearNames from '../../data/wargearNames.js'; // skippable-seed + curated — supplement

// Compact-format exports often label a Chapter's army with the generic "Space
// Marines" faction (the header/detachment names the Chapter, not this field).
// BSData keeps each Chapter (and its named characters/relics, e.g. Azrael,
// "The Lion Helm") in its own faction file, so a "Space Marines" army's corpus
// must also pull every Chapter's items in — otherwise chapter-specific relics
// are invisible to the dictionary and same-abbreviation items from an unrelated
// bucket win by default (e.g. "LW" wrongly resolving to a Space Wolves name).
export const SM_CHAPTERS = [
  'Black Templars', 'Blood Angels', 'Dark Angels', 'Deathwatch', 'Imperial Fists',
  'Iron Hands', 'Raven Guard', 'Salamanders', 'Space Wolves', 'Ultramarines', 'White Scars',
];

const AND = 'and';
const OF = 'of';

/** Base abbreviation exactly as 40k-compactor's makeBaseAbbreviation. */
export function makeBaseAbbreviation(name) {
  if (!name) return null;
  const cleaned = name
    .replace(/\(.*?\)/g, '')
    .replace(/[-]/g, ' ')
    .replace(/["'`.,;:?!]/g, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts
    .map((p) => {
      const low = p.toLowerCase();
      if (low === AND) return '&';
      if (low === OF) return 'o';
      return p[0].toUpperCase();
    })
    .join('');
}

/** Stepped abbreviation exactly as 40k-compactor's makeAbbrevWithStep. */
export function makeAbbrevWithStep(name, step = 0) {
  if (!name) return '';
  const cleaned = name
    .replace(/\(.*?\)/g, '')
    .replace(/[-]/g, ' ')
    .replace(/["'`.,;:?!]/g, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    const w = parts[0];
    const head = w.slice(0, 1).toUpperCase();
    const extra = w.slice(1, 1 + Math.max(1, step)).toLowerCase();
    return head + extra || w.slice(0, 2).toUpperCase();
  }
  return parts
    .map((p) => {
      const low = p.toLowerCase();
      if (low === AND) return '&';
      if (low === OF) return 'o';
      const head = p.slice(0, 1).toUpperCase();
      const extra = p.slice(1, 1 + Math.max(0, step)).toLowerCase();
      return head + extra;
    })
    .join('');
}

/** Every abbreviation form a full name could plausibly render as (base + steps 0..MAX).
 *  The compactor expands one letter per word per collision round; 5 covers even a
 *  unit fielding many same-initial options (e.g. several drones). */
const MAX_STEP = 5;
export function candidateAbbreviations(name) {
  const set = new Set();
  // Some exporters drop the stop-word "the" ("Herald of the Sacred Slaughter" ->
  // HoSS, not HoTSS), so index both the literal name and a "the"-dropped variant.
  const variants = new Set([name]);
  const noThe = name.replace(/\bthe\b/gi, ' ').replace(/\s+/g, ' ').trim();
  if (noThe && noThe !== name) variants.add(noThe);

  for (const v of variants) {
    const base = makeBaseAbbreviation(v);
    if (base) set.add(base);
    for (let s = 0; s <= MAX_STEP; s++) {
      const a = makeAbbrevWithStep(v, s);
      if (a) set.add(a);
    }
  }
  return set;
}

// Among case/punctuation variants of one name, pick the GW-style form: fewest
// capitals (sentence case), then shortest, then alphabetical — deterministic.
function canonicalCasing(names) {
  const upper = (s) => (s.match(/[A-Z]/g) || []).length;
  return [...names].sort(
    (a, b) => upper(a) - upper(b) || a.length - b.length || (a < b ? -1 : 1),
  )[0];
}

// Cache reverse indexes per faction key so repeated expands are cheap.
const _indexCache = new Map();

// Runtime augmentation: callers (e.g. a datasheet database) can register better,
// more complete corpora that take priority over the seed dictionary.
const _runtime = { common: new Set(), factions: new Map() /* leafLower -> Set */ };

/**
 * Register additional full item names, ideally sourced from datasheet data.
 * Faction-scoped names are treated as more authoritative than the generic
 * `common` bucket when disambiguating a colliding abbreviation.
 * @param {string|null} faction  Faction (leaf or "Family - Faction"); null => common.
 * @param {string[]} names
 */
export function registerWargearNames(faction, names) {
  if (!Array.isArray(names) || !names.length) return;
  if (!faction) {
    for (const n of names) if (n) _runtime.common.add(n.toString().trim());
  } else {
    const leaf = normalizeFactionKey(faction).toLowerCase();
    if (!_runtime.factions.has(leaf)) _runtime.factions.set(leaf, new Set());
    const set = _runtime.factions.get(leaf);
    for (const n of names) if (n) set.add(n.toString().trim());
  }
  _indexCache.clear(); // corpus changed; rebuild lazily
}

// Normalize for comparison: strip diacritics, unify curly apostrophes to ASCII,
// lowercase. Matches the compactor's own key normalization so "T’au" == "T'au".
export function normKey(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‛′]/g, "'")
    .toLowerCase()
    // BSData mixes British/American spelling ("Ancient in Terminator Armor" vs
    // the GW app's "Armour"); fold the common "-our" -> "-or" difference so
    // both match ("armour"/"armor", "colour"/"color", "honour"/"honor").
    .replace(/our\b/g, 'or')
    .trim();
}

export function normalizeFactionKey(faction) {
  if (!faction) return '';
  // Compact/parsed factions can arrive as "Chaos - World Eaters"; take the leaf.
  return faction.toString().split(' - ').pop().trim();
}

function factionEntry(source, factionLeaf) {
  const fmap = source.factions || {};
  const want = normKey(factionLeaf);
  const key = Object.keys(fmap).find((k) => normKey(k) === want);
  return key ? fmap[key] : null;
}

// Item tiers, highest wins collision tie-breaks: real weapons > other wargear
// (upgrades) > relic/ability-modelled items (last resort — BSData sometimes
// represents a wargear-granting relic as an Abilities profile, e.g. Azrael's
// "The Lion Helm", which would otherwise be invisible to the dictionary).
const TIER_WEAPON = 2;
const TIER_WARGEAR = 1;
const TIER_ABILITY = 0;

/**
 * Corpus entries as { name, specific, tier }.
 *   specific = faction-scoped (beats generic on collisions)
 */
function corpusForFaction(factionLeaf) {
  const entries = [];
  const seen = new Set();
  const push = (name, specific, tier) => {
    if (!name) return;
    const key = `${name}::${specific}::${tier}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ name, specific, tier });
  };

  // BSData (tiered: {weapons, wargear, abilities}).
  const dsCommon = datasheets.common || {};
  for (const n of dsCommon.weapons || []) push(n, false, TIER_WEAPON);
  for (const n of dsCommon.wargear || []) push(n, false, TIER_WARGEAR);
  const dsF = factionEntry(datasheets, factionLeaf);
  if (dsF) {
    for (const n of dsF.weapons || []) push(n, true, TIER_WEAPON);
    for (const n of dsF.wargear || []) push(n, true, TIER_WARGEAR);
    for (const n of dsF.abilities || []) push(n, true, TIER_ABILITY);
  }
  // Generic "Space Marines" header: also pull in every Chapter's corpus, marked
  // non-specific so a genuine core-SM item still wins ties over a chapter relic.
  if (normKey(factionLeaf) === normKey('Space Marines')) {
    for (const chapter of SM_CHAPTERS) {
      const cf = factionEntry(datasheets, chapter);
      if (!cf) continue;
      for (const n of cf.weapons || []) push(n, false, TIER_WEAPON);
      for (const n of cf.wargear || []) push(n, false, TIER_WARGEAR);
      for (const n of cf.abilities || []) push(n, false, TIER_ABILITY);
    }
  }

  // Skippable seed + curated common (flat name lists) — treated as wargear tier.
  for (const n of wargearNames.common || []) push(n, false, TIER_WARGEAR);
  const wnF = factionEntry(wargearNames, factionLeaf);
  if (Array.isArray(wnF)) for (const n of wnF) push(n, true, TIER_WARGEAR);

  // Runtime additions (highest-quality, e.g. datasheet loadouts) — weapon tier.
  for (const n of _runtime.common) push(n, false, TIER_WEAPON);
  const rt = _runtime.factions.get(factionLeaf.toLowerCase());
  if (rt) for (const n of rt) push(n, true, TIER_WEAPON);

  return entries;
}

function enhancementsForFaction(factionLeaf) {
  const emap = wargearNames.enhancements || {};
  const key = Object.keys(emap).find((k) => k.toLowerCase() === factionLeaf.toLowerCase());
  return key ? emap[key] : [];
}

/**
 * Build (or fetch cached) reverse index for a faction.
 * @returns {{ get(abbr): {name, ambiguous, options}|null }}
 */
// Squash a name to its bare letters+digits, lowercased — how a "PascalCase, no
// spaces" exporter would render it ("Close Combat Weapon" -> "closecombatweapon").
function squash(name) {
  return (name || '').toString().replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

// Narrow a candidate pool to a single winner using the same priority ladder
// (unit context -> base-exact -> tier -> faction-specific -> case-collapse),
// shared by both abbreviation lookup and squashed-literal-name lookup.
function resolvePool(entries, queryForBaseExact, allowedNames) {
  const options = entries.map((e) => e.name);
  if (entries.length === 1) return { name: entries[0].name, ambiguous: false, options: [] };

  // 0) Unit context: if we know the items this unit can take, keep only those.
  let pool = entries;
  if (allowedNames && allowedNames.size) {
    const inUnit = pool.filter((e) => allowedNames.has(e.name.toLowerCase()));
    if (inUnit.length) pool = inUnit;
  }
  // 1) Prefer candidates whose *base* abbreviation equals the token (what the
  //    compactor emits when there is no collision). Skipped for literal-name
  //    lookups (queryForBaseExact null) since there's no abbreviation to match.
  if (queryForBaseExact) {
    const exact = pool.filter((e) => makeBaseAbbreviation(e.name) === queryForBaseExact);
    if (exact.length) pool = exact;
  }
  // 2) Prefer higher-tier candidates (weapon > wargear > ability-modelled relic).
  const maxTier = Math.max(...pool.map((e) => e.tier));
  pool = pool.filter((e) => e.tier === maxTier);
  // 3) Prefer faction-specific names over the generic bucket.
  const specific = pool.filter((e) => e.specific);
  if (specific.length) pool = specific;

  // Collapse candidates that are the same item in different casing/punctuation
  // (BSData carries e.g. "Neo-volkite Pistol" and "Neo-volkite pistol").
  const groups = new Map(); // normKey -> [names]
  for (const e of pool) {
    const k = normKey(e.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e.name);
  }
  if (groups.size === 1) {
    return { name: canonicalCasing([...groups.values()][0]), ambiguous: false, options };
  }
  return { name: null, ambiguous: true, options };
}

export function getReverseIndex(faction) {
  const leaf = normalizeFactionKey(faction);
  if (_indexCache.has(leaf)) return _indexCache.get(leaf);

  const multimap = new Map(); // abbr -> Map<fullName, { specific, tier }>
  const squashMap = new Map(); // squashedLiteral -> Map<fullName, { specific, tier }>
  const add = (name, specific, tier) => {
    for (const ab of candidateAbbreviations(name)) {
      if (!multimap.has(ab)) multimap.set(ab, new Map());
      const m = multimap.get(ab);
      const prev = m.get(name);
      // A name keeps the best specific/tier status any source granted it.
      m.set(name, {
        specific: specific || (prev?.specific ?? false),
        tier: Math.max(tier, prev?.tier ?? TIER_ABILITY),
      });
    }
    const sq = squash(name);
    if (sq.length >= 6) {
      // Guard against short names producing spurious squash collisions.
      if (!squashMap.has(sq)) squashMap.set(sq, new Map());
      const sm = squashMap.get(sq);
      const prev = sm.get(name);
      sm.set(name, {
        specific: specific || (prev?.specific ?? false),
        tier: Math.max(tier, prev?.tier ?? TIER_ABILITY),
      });
    }
  };
  for (const e of corpusForFaction(leaf)) add(e.name, e.specific, e.tier);
  for (const n of enhancementsForFaction(leaf)) add(n, true, TIER_WARGEAR);

  const index = {
    get(abbr, allowedNames = null) {
      if (!abbr) return null;
      const m = multimap.get(abbr);
      if (!m || m.size === 0) return null;
      const entries = [...m.entries()].map(([name, meta]) => ({ name, ...meta }));
      return resolvePool(entries, abbr, allowedNames);
    },
    getLiteral(token, allowedNames = null) {
      const sq = squash(token);
      if (sq.length < 6) return null;
      const m = squashMap.get(sq);
      if (!m || m.size === 0) return null;
      const entries = [...m.entries()].map(([name, meta]) => ({ name, ...meta }));
      return resolvePool(entries, null, allowedNames);
    },
  };
  _indexCache.set(leaf, index);
  return index;
}

/**
 * Expand a single abbreviated token to its full name where possible.
 * @returns {{ value: string, resolved: boolean, ambiguous: boolean, options: string[] }}
 */
// A concatenated literal name, no spaces: "CloseCombatWeapon", "AttachedAsBodyguard2".
// Some exporters render multi-word items this way instead of a short abbreviation.
export const PASCAL_RUN = /^[A-Z][a-z]+(?:[A-Z][a-z]*){1,}\d{0,2}$/;

// Same gate expandAbbreviation() itself uses to decide whether to even attempt a
// lookup. Callers use this to decide whether an unresolved result is worth
// warning about — keeping the two gates unified means nothing that was actually
// looked up (and failed) can silently pass through unflagged.
const SHORT_ABBREV_RE = /^[A-Za-z&][A-Za-z&0-9]{0,6}$/;
export function looksLikeAbbreviation(token) {
  const raw = (token || '').trim();
  if (!raw) return false;
  if (SHORT_ABBREV_RE.test(raw) && /[A-Z]/.test(raw)) return true;
  return PASCAL_RUN.test(raw);
}

export function expandAbbreviation(token, faction, allowedNames = null) {
  const raw = (token || '').trim();
  if (!raw) return { value: raw, resolved: false, ambiguous: false, options: [] };

  const looksAbbrev = SHORT_ABBREV_RE.test(raw) && /[A-Z]/.test(raw);
  if (looksAbbrev) {
    const hit = getReverseIndex(faction).get(raw, allowedNames);
    if (hit && hit.name) return { value: hit.name, resolved: true, ambiguous: false, options: [] };
    if (hit && hit.ambiguous) return { value: raw, resolved: false, ambiguous: true, options: hit.options };
    return { value: raw, resolved: false, ambiguous: false, options: [] };
  }

  // Long, space-free but multi-word-looking token: try squashed-literal lookup.
  if (PASCAL_RUN.test(raw)) {
    const index = getReverseIndex(faction);
    let hit = index.getLiteral(raw, allowedNames);
    if (!hit && /\d$/.test(raw)) hit = index.getLiteral(raw.replace(/\d+$/, ''), allowedNames);
    if (hit && hit.name) return { value: hit.name, resolved: true, ambiguous: false, options: [] };
    if (hit && hit.ambiguous) return { value: raw, resolved: false, ambiguous: true, options: hit.options };
  }

  // Otherwise treat as already a full name — keep as-is.
  return { value: raw, resolved: false, ambiguous: false, options: [] };
}

/**
 * Return the set of item names (lowercased) a unit can field, per BSData.
 * Falls back across all factions so datasheets defined in other JSON files
 * (allied units, shared libraries) are still found — nothing unaccounted for.
 * @returns {Set<string>|null}
 */
export function getUnitItems(faction, unitName) {
  if (!unitName) return null;
  const ui = datasheets.unitItems || {};
  const nameLower = unitName.toString().toLowerCase().trim();
  const variants = new Set([nameLower]);
  variants.add(nameLower.endsWith('s') ? nameLower.slice(0, -1) : nameLower + 's');

  const lookInBucket = (bucket) => {
    if (!bucket) return null;
    for (const v of variants) if (bucket[v]) return bucket[v];
    // fall back to apostrophe/diacritic-insensitive match
    const wants = new Set([...variants].map(normKey));
    for (const k of Object.keys(bucket)) if (wants.has(normKey(k))) return bucket[k];
    return null;
  };
  const bucketFor = (leaf) => {
    const key = Object.keys(ui).find((k) => normKey(k) === leaf);
    return key ? ui[key] : null;
  };

  // 1) The army's own faction first.
  const leaf = normKey(normalizeFactionKey(faction));
  const own = lookInBucket(bucketFor(leaf));
  if (own) return new Set(own);

  // 2) Cross-faction fallback — merge every faction's match for this unit name.
  const merged = new Set();
  for (const f of Object.keys(ui)) {
    const hit = lookInBucket(ui[f]);
    if (hit) for (const it of hit) merged.add(it);
  }
  return merged.size ? merged : null;
}

/**
 * Enhancement names (lowercased) valid for a list's detachment. The detachment
 * string may combine several ("Advanced Acquisition Cadre and Kauyon") — union
 * the enhancements of every BSData detachment named within it.
 * @returns {Set<string>|null}
 */
export function getDetachmentEnhancements(faction, detachmentString) {
  const map = datasheets.detachmentEnhancements || {};
  const dstr = normKey(detachmentString || '');
  if (!dstr) return null;

  const collect = (dets) => {
    const out = new Set();
    for (const [det, names] of Object.entries(dets || {})) {
      // Guard against trivially-short detachment keys causing spurious matches.
      if (normKey(det).length >= 4 && dstr.includes(normKey(det))) {
        for (const n of names) out.add(n);
      }
    }
    return out;
  };

  // 1) The army's own faction.
  const fkey = Object.keys(map).find((k) => normKey(k) === normKey(normalizeFactionKey(faction)));
  let out = fkey ? collect(map[fkey]) : new Set();

  // 2) Cross-faction fallback — a "Space Marines" list may run a Black Templars
  //    detachment, whose enhancements live under the Black Templars corpus.
  if (!out.size) {
    for (const f of Object.keys(map)) for (const n of collect(map[f])) out.add(n);
  }
  return out.size ? out : null;
}

/**
 * Resolve a header fragment to a known faction leaf name, or null.
 * Handles "Chaos - World Eaters", "World Eaters", and substring forms.
 */
export function matchFaction(text) {
  if (!text) return null;
  const keys = [
    ...new Set([
      ...Object.keys(datasheets.factions || {}),
      ...Object.keys(wargearNames.factions || {}),
    ]),
  ];
  const leaf = normKey(normalizeFactionKey(text));
  let hit = keys.find((k) => normKey(k) === leaf);
  if (hit) return hit;
  const low = normKey(text);
  // Longest matching faction name wins (so "Space Wolves" beats "Space ...").
  hit = keys
    .filter((k) => low.includes(normKey(k)))
    .sort((a, b) => b.length - a.length)[0];
  return hit || null;
}

export const dictionaryMeta = {
  factionCount: Object.keys(wargearNames.factions || {}).length,
  commonCount: (wargearNames.common || []).length,
};

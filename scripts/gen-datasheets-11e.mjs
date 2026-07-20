#!/usr/bin/env node
/**
 * Extracts a per-faction corpus of full item names (weapons, wargear, units) from
 * a local clone of BSData/wh40k-11e and writes src/data/datasheets11e.js.
 *
 * This is the authoritative corpus the army expander uses to reverse the
 * compactor's abbreviations. We only extract *names* here (not full stat blocks);
 * full datasheet rendering is a separate concern.
 *
 * Usage:
 *   git clone --depth 1 https://github.com/BSData/wh40k-11e.git
 *   node scripts/gen-datasheets-11e.mjs ./wh40k-11e
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outPath = resolve(repoRoot, 'src/data/datasheets11e.js');
const detailsOutPath = resolve(repoRoot, 'src/data/datasheetDetails11e.js');

const srcDir = process.argv[2];
if (!srcDir) {
  console.error('Usage: node scripts/gen-datasheets-11e.mjs <path-to-wh40k-11e-clone>');
  process.exit(1);
}

const WEAPON_TYPES = new Set(['Ranged Weapons', 'Melee Weapons']);
// Some relics/wargear (e.g. Azrael's "The Lion Helm") are modelled in BSData as an
// Abilities profile directly on the datasheet, not a weapon or upgrade entry.
// Lowest-priority tier: only used as a last resort so real wargear always wins ties.
const ABILITY_TYPES = new Set(['Abilities']);
// Space Marine Chapters share the core Space Marines catalogue's weapons.
const SM_CHAPTERS = new Set([
  'Black Templars', 'Blood Angels', 'Dark Angels', 'Deathwatch', 'Imperial Fists',
  'Iron Hands', 'Raven Guard', 'Salamanders', 'Space Wolves', 'Ultramarines', 'White Scars',
]);

/** Filename -> canonical faction leaf (matching our dictionary's faction keys). */
function factionFromFile(file) {
  let name = basename(file, '.json');
  if (name === 'Warhammer 40,000' || name === 'Unaligned Forces') return '__common';
  name = name.replace(/\s*-?\s*Library$/i, '').trim();
  if (name.startsWith('Library - ')) name = name.slice('Library - '.length);
  // "Family - Faction" -> "Faction"; "Aeldari - Aeldari" -> "Aeldari"
  if (name.includes(' - ')) name = name.split(' - ').pop().trim();
  const aliases = { Craftworlds: 'Aeldari', Drukhari: 'Drukhari', 'Titanicus Traitoris': 'Chaos Knights' };
  return aliases[name] || name;
}

/** Strip the "➤" weapon marker and a trailing " - <firing mode>" to the base name. */
function cleanWeaponName(raw) {
  let n = String(raw || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const base = n.replace(/\s+-\s+(standard|supercharge|profile|.*)$/i, '').trim();
  return { full: n, base: base || n };
}

function cleanName(raw) {
  return String(raw || '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/\s*\[[^\]]*\]\s*$/, '') // drop "[Crucible]" style detachment tags
    .trim();
}

/** BSData rules text uses ^^underline^^ markers we don't render; strip them. */
function cleanText(t) {
  return String(t || '').replace(/\^\^/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

/** A profile's characteristics array -> plain {CharName: text} object. */
function charsToObj(characteristics) {
  const obj = {};
  for (const c of characteristics || []) {
    if (c && c.name) obj[c.name] = cleanText(c.$text || '');
  }
  return obj;
}

// Stable across the whole dataset — some resolved profile objects (reached via
// infoLinks below) omit typeName, so typeId is the more robust discriminator.
const UNIT_PROFILE_TYPE_ID = 'c547-1836-d8a-ff4f';
function isUnitProfile(p) {
  return !!p && (p.typeName === 'Unit' || p.typeId === UNIT_PROFILE_TYPE_ID);
}

// A model's statline can be (a) inline in its own `profiles`, or (b) reached
// only via an `infoLinks` entry of type "profile" pointing by targetId at a
// shared profile object elsewhere (e.g. Tyranids' "Ripper Swarm" — the model
// selectionEntry itself carries no `profiles` array at all).
function findUnitProfile(node, idMap) {
  const direct = (node.profiles || []).find(isUnitProfile);
  if (direct) return direct;
  if (idMap) {
    for (const l of node.infoLinks || []) {
      if (l.type !== 'profile' || !l.targetId || !idMap.has(l.targetId)) continue;
      const tgt = idMap.get(l.targetId);
      if (isUnitProfile(tgt) || (tgt && tgt.characteristics)) return tgt;
    }
  }
  return null;
}

/** Every distinct model statline (M/T/Sv/W/Ld/OC/InSv) on a datasheet. */
// BSData places the shared statline inconsistently: sometimes on the nested
// model entry itself (e.g. Khorne Berzerker Champion), sometimes only on the
// top-level unit entry with the nested models carrying no profile of their own
// (e.g. Eradicator/Eradicator Sergeant both share the squad's own profile).
// Try the model's own profile first, falling back to the unit's shared one.
function collectModelStatlines(entry, idMap) {
  const stats = [];
  const seen = new Set();
  const ownProfile = findUnitProfile(entry, idMap);

  const addFrom = (node, displayName, fallbackProfile) => {
    if (!displayName || seen.has(displayName)) return;
    const p = findUnitProfile(node, idMap) || fallbackProfile;
    if (!p) return;
    seen.add(displayName);
    stats.push({ name: displayName, chars: charsToObj(p.characteristics) });
  };

  if (entry.type === 'model') {
    addFrom(entry, cleanName(entry.name), null);
    return stats;
  }

  const modelChildren = [];
  for (const se of entry.selectionEntries || []) if (se.type === 'model') modelChildren.push(se);
  for (const g of entry.selectionEntryGroups || []) {
    for (const se of g.selectionEntries || []) if (se.type === 'model') modelChildren.push(se);
  }
  for (const se of modelChildren) addFrom(se, cleanName(se.name), ownProfile);

  // No nested model children found at all (rare) — fall back to the unit itself.
  if (!stats.length && ownProfile) addFrom(entry, cleanName(entry.name), ownProfile);

  return stats;
}

// Unlike unitAbilities (noise-filtered, abbreviation-index only), this keeps
// every named ability with real text — including universal rules like "Deep
// Strike" — because a real datasheet legitimately lists those.
function collectDatasheetAbilities(entry) {
  const abilities = [];
  const seen = new Set();
  for (const p of entry.profiles || []) {
    if (p.typeName !== 'Abilities') continue;
    const name = cleanName(p.name);
    if (!name || seen.has(name)) continue;
    const chars = charsToObj(p.characteristics);
    const text = chars.Description || Object.values(chars)[0] || '';
    if (!text) continue;
    seen.add(name);
    abilities.push({ name, text });
  }
  return abilities;
}

/** categoryLinks -> { factionKeyword, keywords[] }. */
function collectKeywords(entry) {
  const links = (entry.categoryLinks || []).map((c) => cleanName(c.name)).filter(Boolean);
  let factionKeyword = '';
  const keywords = [];
  for (const k of links) {
    const m = k.match(/^Faction:\s*(.+)$/i);
    if (m) factionKeyword = m[1].trim();
    else keywords.push(k);
  }
  return { factionKeyword, keywords };
}

// BSData upgrade entries include loadout *options* ("2 magma cutters",
// "1 mauler chainblade, 16 chainblades", "with ..."). Those aren't item names.
const NUMWORD = /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;
function isNoisyName(n) {
  if (!n) return true;
  if (/^\d/.test(n)) return true;
  if (NUMWORD.test(n)) return true;
  // A real GW combo-weapon name can contain a comma ("Bone cleaver, lash whip
  // and rending claws") — only reject when it reads as an enumerated purchase
  // list, i.e. any comma-separated segment itself starts with a digit/count.
  if (n.includes(',') && n.split(',').some((seg) => /^\s*\d/.test(seg))) return true;
  if (/^with\b/i.test(n)) return true;
  if (n.length > 45) return true;
  return false;
}

// The set of item names a unit can field: weapon profiles + entryLink names
// (which carry the weapon/wargear name directly) + nested upgrade entries.
// entryLinks/infoLinks reference shared entries by targetId — often defined in a
// DIFFERENT file (shared "Drones" groups, allied datasheets) — so we resolve those
// against a global id map and recurse, or nothing would be accounted for.
const MAX_ITEMS_PER_UNIT = 120;
const MAX_LINK_DEPTH = 3; // how far to chase targetId links before stopping
// Container entries that aren't loadout items and whose subtrees would balloon.
// Prefix-match terms are always containers, never real item names. "relics?" is
// exact-match only — "Relic Weapon"/"Reliquary Weapon" are real wargear options
// and must not be swallowed by a prefix match on "relic".
const SKIP_LINK_PREFIX = /^(crusade|enhancements?|weapon modifications|battle traits?|warlord traits?|detachment|show\/hide)/i;
const SKIP_LINK_EXACT = /^relics?$/i;
const SKIP_LINK = { test: (n) => SKIP_LINK_PREFIX.test(n) || SKIP_LINK_EXACT.test(n) };
// Generic rules every/most units share — never worth indexing as an "item".
const GENERIC_ABILITY = /^(leader|deep strike|feel no pain|oath of moment|deadly demise|scouts?|infiltrators?|stealth|firing deck|fights first|lone operative)/i;
function collectUnitItems(unit, idMap) {
  const items = new Set();
  const abilities = new Set();
  const visited = new Set();
  // depth counts only link hops; inline children don't consume depth budget.
  const rec = (node, depth) => {
    if (!node || typeof node !== 'object' || items.size > MAX_ITEMS_PER_UNIT) return;
    if (node.id) {
      if (visited.has(node.id)) return;
      visited.add(node.id);
    }
    for (const l of node.entryLinks || []) {
      const n = cleanName(l.name);
      if (n && SKIP_LINK.test(n)) continue;
      if (n && !isNoisyName(n)) items.add(n);
      rec(l, depth);
      if (depth < MAX_LINK_DEPTH && l.targetId && idMap.has(l.targetId)) {
        rec(idMap.get(l.targetId), depth + 1);
      }
    }
    for (const l of node.infoLinks || []) {
      const tgt = l.targetId && idMap.get(l.targetId);
      if (tgt && WEAPON_TYPES.has(tgt.typeName)) {
        const { base } = cleanWeaponName(tgt.name);
        if (base && !isNoisyName(base)) items.add(base);
      }
    }
    for (const p of node.profiles || []) {
      if (WEAPON_TYPES.has(p.typeName)) {
        const { base } = cleanWeaponName(p.name);
        if (base && !isNoisyName(base)) items.add(base);
      } else if (ABILITY_TYPES.has(p.typeName)) {
        const n = cleanName(p.name);
        if (n && !isNoisyName(n) && !GENERIC_ABILITY.test(n)) abilities.add(n);
      }
    }
    for (const se of node.selectionEntries || []) {
      if (se.type === 'upgrade') {
        const n = cleanName(se.name);
        if (n && !isNoisyName(n)) items.add(n);
      }
      rec(se, depth);
    }
    for (const g of node.selectionEntryGroups || []) {
      if (g.name && SKIP_LINK.test(cleanName(g.name))) continue; // e.g. group "Crusade"
      rec(g, depth);
    }
  };
  rec(unit, 0);
  return { items, abilities };
}

function walk(node, sink) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, sink);
    return;
  }
  if (node.name) {
    if (WEAPON_TYPES.has(node.typeName)) {
      const { full, base } = cleanWeaponName(node.name);
      if (!isNoisyName(base)) sink.weapons.add(base);
      if (full !== base && !isNoisyName(full)) sink.weapons.add(full);
      // Full stat profile, keyed by base name. Multi-profile weapons (e.g.
      // Plasma pistol: Standard/Supercharge) collect multiple {mode, chars} rows.
      if (base && !isNoisyName(base)) {
        const mode = full !== base ? full.slice(base.length).replace(/^\s*-\s*/, '').trim() : null;
        const modeLabel = mode ? mode[0].toUpperCase() + mode.slice(1) : null;
        const key = base.toLowerCase();
        const rec = sink.weaponProfiles.get(key) || { name: base, typeName: node.typeName, profiles: [] };
        if (!rec.profiles.some((p) => p.mode === modeLabel)) {
          rec.profiles.push({ mode: modeLabel, chars: charsToObj(node.characteristics) });
        }
        sink.weaponProfiles.set(key, rec);
      }
    } else if (node.type === 'upgrade') {
      const n = cleanName(node.name);
      if (!isNoisyName(n)) sink.wargear.add(n);
    } else if (node.type === 'unit' || node.type === 'model') {
      const n = cleanName(node.name);
      if (n) sink.units.add(n);
    }
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, sink);
}

// Rules referenced on nearly every datasheet in a faction (Oath of Moment,
// Blessings of Khorne, Martial Ka'tah, ...) are that faction's Army Rule — BSData
// has no dedicated container for it, so it's identified by frequency instead (see
// collectDatasheets below, which tallies this while it's already walking `tops`).
// This denylist guards against a universal per-model-category ability (granted to
// every unit of some type, e.g. every Knight is a "Super-Heavy Walker") winning by
// coincidence on a small faction file.
const GENERIC_RULE_NAME =
  /^(leader|deep strike|deadly demise|feel no pain|scouts?|infiltrators?|stealth|firing deck( \d+)?|fights first|lone operative|battle-?shock|super-heavy walker|walker|vehicle|titanic|aircraft|monster|infantry|battleline|hover)$/i;

/** A detachment selectionEntry's own rule: inline `rules[0]`, or an `infoLinks`
 *  rule reference resolved through the global id map. */
function detachmentRuleText(node, idMap) {
  const r = (node.rules || [])[0];
  if (r) {
    const text = cleanText(r.description);
    if (text) return { name: cleanName(r.name), text };
  }
  for (const l of node.infoLinks || []) {
    if (l.type !== 'rule' || !l.targetId || !idMap.has(l.targetId)) continue;
    const tgt = idMap.get(l.targetId);
    const text = cleanText(tgt.description || '');
    if (text) return { name: cleanName(l.name || tgt.name), text };
  }
  return null;
}

// Detachment definitions are scattered across wildly different tree shapes
// (inline selectionEntryGroups, entryLink indirection one or two files away,
// shared-across-chapters groups, ...) so rather than chase a specific path we
// scan the whole tree for the one structural marker every real detachment has:
// a nonzero "Detachment Points" cost. (Every selectable entry carries this cost
// type at value 0 by default — only an actual detachment choice sets it >0.)
function collectDetachmentRules(cat, sink, idMap) {
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    const dp = (n.costs || []).find((c) => c.name === 'Detachment Points');
    if (dp && dp.value > 0 && n.name) {
      const name = cleanName(n.name);
      const rule = name && detachmentRuleText(n, idMap);
      if (rule) sink.detachmentRules.set(name.toLowerCase(), { name, ruleName: rule.name, ruleText: rule.text });
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
  };
  walk(cat);
}

// Enhancements are grouped under a "<Detachment> Enhancements" selectionEntryGroup.
// Map detachment name -> its enhancement names (for scoping resolution) and, in
// detachEnhDetails, full text + points (for datasheet-page display).
const ENH_GROUP = /^(.+?)\s+Enhancements?$/i;
const GENERIC_ENH = /^(boarding actions?|breaching operation)$/i;
function enhancementDetail(node) {
  const name = cleanName(node.name);
  if (!name) return null;
  const chars = charsToObj((node.profiles || [])[0]?.characteristics);
  const text = chars.Description || Object.values(chars)[0] || '';
  const pts = (node.costs || []).find((c) => c.name === 'pts');
  return { name, text, points: pts ? pts.value : null };
}
function collectDetachmentEnhancements(cat, sink, idMap) {
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    const m = n.name && ENH_GROUP.exec(n.name);
    if (m && (n.selectionEntries || n.entryLinks)) {
      const det = cleanName(m[1]).toLowerCase();
      if (det && !GENERIC_ENH.test(det)) {
        const set = sink.detachEnh.get(det) || new Set();
        const details = sink.detachEnhDetails.get(det) || new Map();
        for (const e of n.selectionEntries || []) {
          const nm = cleanName(e.name);
          if (!nm || isNoisyName(nm)) continue;
          set.add(nm.toLowerCase());
          const d = enhancementDetail(e);
          if (d) details.set(nm.toLowerCase(), d);
        }
        for (const l of n.entryLinks || []) {
          const nm = cleanName(l.name);
          if (!nm || isNoisyName(nm)) continue;
          set.add(nm.toLowerCase());
          const tgt = l.targetId && idMap.get(l.targetId);
          const d = tgt ? enhancementDetail(tgt) : null;
          if (d) details.set(nm.toLowerCase(), d);
        }
        sink.detachEnh.set(det, set);
        sink.detachEnhDetails.set(det, details);
      }
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
  };
  walk(cat);
}

// Datasheets are the TOP-LEVEL entries (in sharedSelectionEntries / root
// selectionEntries) of type unit OR model — single-model sheets like Maulerfiend
// are type "model". Nested sub-models (a unit's Champion) are NOT datasheets.
function collectDatasheets(cat, sink, idMap) {
  const tops = [...(cat.sharedSelectionEntries || []), ...(cat.selectionEntries || [])];
  for (const entry of tops) {
    if (entry.type !== 'unit' && entry.type !== 'model') continue;
    const key = cleanName(entry.name).toLowerCase();
    if (!key) continue;
    const { items, abilities } = collectUnitItems(entry, idMap);
    const set = sink.unitItems.get(key) || new Set();
    for (const it of items) set.add(it);
    sink.unitItems.set(key, set);
    const aset = sink.unitAbilities.get(key) || new Set();
    for (const a of abilities) aset.add(a);
    sink.unitAbilities.set(key, aset);

    // Army Rule candidate tally — see GENERIC_RULE_NAME comment above.
    for (const l of entry.infoLinks || []) {
      if (l.type !== 'rule') continue;
      const n = cleanName(l.name);
      if (!n || GENERIC_RULE_NAME.test(n)) continue;
      const rec = sink.armyRuleCounts.get(n) || { count: 0, targetId: l.targetId };
      rec.count += 1;
      sink.armyRuleCounts.set(n, rec);
    }

    // Full datasheet record for display (first definition wins per faction file).
    if (!sink.datasheets.has(key)) {
      const { factionKeyword, keywords } = collectKeywords(entry);
      sink.datasheets.set(key, {
        name: cleanName(entry.name),
        factionKeyword,
        keywords,
        abilities: collectDatasheetAbilities(entry),
        stats: collectModelStatlines(entry, idMap),
      });
    }
  }
}

const files = readdirSync(srcDir).filter((f) => f.endsWith('.json'));
const byFaction = new Map(); // faction -> { weapons:Set, wargear:Set, units:Set }
const ensure = (f) => {
  if (!byFaction.has(f))
    byFaction.set(f, {
      weapons: new Set(),
      wargear: new Set(),
      units: new Set(),
      unitItems: new Map(),
      unitAbilities: new Map(),
      detachEnh: new Map(),
      detachEnhDetails: new Map(),
      datasheets: new Map(),
      weaponProfiles: new Map(),
      armyRuleCounts: new Map(),
      detachmentRules: new Map(),
    });
  return byFaction.get(f);
};

// Pass 1: parse every catalogue and index every object that has an id, so links
// (entryLink/infoLink targetId) resolve even when they point into another file.
const cats = [];
const idMap = new Map();
function indexIds(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) indexIds(n);
    return;
  }
  if (node.id && !idMap.has(node.id)) idMap.set(node.id, node);
  for (const v of Object.values(node)) if (v && typeof v === 'object') indexIds(v);
}
for (const file of files) {
  let json;
  try {
    json = JSON.parse(readFileSync(resolve(srcDir, file), 'utf8'));
  } catch (e) {
    console.error('skip (parse error):', file, e.message);
    continue;
  }
  const cat = json.catalogue || json.gameSystem || json;
  cats.push({ faction: factionFromFile(file), cat });
  indexIds(cat);
}

// Pass 2: collect the corpus and per-unit loadouts (with cross-file link resolution).
for (const { faction, cat } of cats) {
  const sink = ensure(faction);
  walk(cat, sink);
  collectDatasheets(cat, sink, idMap);
  collectDetachmentEnhancements(cat, sink, idMap);
  collectDetachmentRules(cat, sink, idMap);
}

// Merge the core Space Marines corpus into each Chapter.
const sm = byFaction.get('Space Marines');
if (sm) {
  for (const chap of SM_CHAPTERS) {
    const b = ensure(chap);
    for (const w of sm.weapons) b.weapons.add(w);
    for (const w of sm.wargear) b.wargear.add(w);
    for (const [u, set] of sm.unitItems) {
      const cur = b.unitItems.get(u) || new Set();
      for (const it of set) cur.add(it);
      b.unitItems.set(u, cur);
    }
    for (const [u, set] of sm.unitAbilities) {
      const cur = b.unitAbilities.get(u) || new Set();
      for (const it of set) cur.add(it);
      b.unitAbilities.set(u, cur);
    }
    // Chapter's own datasheet/weapon-profile definition (if any) wins; otherwise
    // fall back to the core Space Marines one.
    for (const [u, ds] of sm.datasheets) if (!b.datasheets.has(u)) b.datasheets.set(u, ds);
    for (const [w, wp] of sm.weaponProfiles) if (!b.weaponProfiles.has(w)) b.weaponProfiles.set(w, wp);
    for (const [det, m] of sm.detachEnhDetails) {
      const cur = b.detachEnhDetails.get(det) || new Map();
      for (const [k, v] of m) if (!cur.has(k)) cur.set(k, v);
      b.detachEnhDetails.set(det, cur);
    }
    // Chapters reference the core Space Marines catalogue's shared "Detachment"
    // group by link rather than redefining it, so their own file contributes no
    // Detachment Points entries at all — inherit the full set, chapter-specific
    // detachments (if any, found locally) win.
    for (const [det, val] of sm.detachmentRules) if (!b.detachmentRules.has(det)) b.detachmentRules.set(det, val);
  }
}

const commonBucket = byFaction.get('__common') || { weapons: new Set(), wargear: new Set(), units: new Set() };
byFaction.delete('__common');

const sorted = (set) => [...set].filter(Boolean).sort();
// Keep weapons and other wargear separate so the expander can prefer weapons when
// resolving an inline loadout token (abilities/enhancements pollute otherwise).
const factions = {};
const units = {};
const unitItems = {};
const unitAbilities = {};
const detachmentEnhancements = {};
const datasheets = {};
const weaponProfiles = {};
const detachmentEnhancementDetails = {};
const armyRules = {};
const detachmentRules = {};
for (const [faction, b] of [...byFaction.entries()].sort()) {
  // A name that is a weapon profile stays in weapons only.
  const wargearOnly = new Set([...b.wargear].filter((n) => !b.weapons.has(n)));
  // Abilities become faction-corpus candidates too (lowest tier) — unit-context
  // resolution can only narrow candidates that already exist in the corpus.
  const abilitySet = new Set();
  for (const set of b.unitAbilities.values()) for (const a of set) abilitySet.add(a);
  factions[faction] = {
    weapons: sorted(b.weapons),
    wargear: sorted(wargearOnly),
    abilities: sorted(abilitySet),
  };
  units[faction] = sorted(b.units);
  // Per-unit item names, lowercased for matching. Only keep units that have any.
  const ui = {};
  for (const [u, set] of [...b.unitItems.entries()].sort()) {
    if (set.size) ui[u] = [...set].map((s) => s.toLowerCase()).sort();
  }
  unitItems[faction] = ui;
  // Per-unit relic/ability names (lower priority tier — see wargearDictionary.js).
  const ua = {};
  for (const [u, set] of [...b.unitAbilities.entries()].sort()) {
    if (set.size) ua[u] = [...set].sort();
  }
  unitAbilities[faction] = ua;
  // Detachment -> enhancement names (lowercased).
  const de = {};
  for (const [det, set] of [...b.detachEnh.entries()].sort()) {
    if (set.size) de[det] = [...set].sort();
  }
  detachmentEnhancements[faction] = de;
  // Full datasheet records, lowercased-name keyed.
  const dsOut = {};
  for (const [u, ds] of [...b.datasheets.entries()].sort()) dsOut[u] = ds;
  datasheets[faction] = dsOut;
  // Weapon stat profiles, lowercased-name keyed.
  const wpOut = {};
  for (const [w, wp] of [...b.weaponProfiles.entries()].sort()) wpOut[w] = wp;
  weaponProfiles[faction] = wpOut;
  // Detachment -> enhancement name -> {name, text, points}.
  const ded = {};
  for (const [det, m] of [...b.detachEnhDetails.entries()].sort()) {
    const inner = {};
    for (const [k, v] of [...m.entries()].sort()) inner[k] = v;
    if (Object.keys(inner).length) ded[det] = inner;
  }
  detachmentEnhancementDetails[faction] = ded;
  // Army Rule: the most-referenced rule-type infoLink among this faction's own
  // units (see GENERIC_RULE_NAME comment). Require at least 2 references so a
  // sparse file (e.g. a 1-unit Legends library) can't crown a fluke winner.
  let bestName = null;
  let bestRec = null;
  for (const [name, rec] of b.armyRuleCounts) {
    if (rec.count < 2) continue;
    if (!bestRec || rec.count > bestRec.count) {
      bestName = name;
      bestRec = rec;
    }
  }
  if (bestName && bestRec.targetId && idMap.has(bestRec.targetId)) {
    const text = cleanText(idMap.get(bestRec.targetId).description || '');
    if (text) armyRules[faction] = { name: bestName, text };
  }
  // Detachment -> { name, ruleName, ruleText }.
  if (b.detachmentRules.size) {
    const dr = {};
    for (const [det, val] of [...b.detachmentRules.entries()].sort()) dr[det] = val;
    detachmentRules[faction] = dr;
  }
}

// datasheets11e.js: names only — this is what wargearDictionary.js loads for
// abbreviation resolution, and it must stay small since it's part of the
// expander page's bundle. Unchanged shape from before this script grew a
// "full datasheet" mode, so existing consumers are unaffected.
const namesOut = {
  generatedFrom: 'BSData/wh40k-11e',
  common: {
    weapons: sorted(commonBucket.weapons),
    wargear: sorted(new Set([...commonBucket.wargear].filter((n) => !commonBucket.weapons.has(n)))),
  },
  factions,
  units,
  unitItems,
  unitAbilities,
  detachmentEnhancements,
};

// datasheetDetails11e.js: full stat blocks, ability text, weapon profiles,
// enhancement text. Much larger — only the datasheet-viewer page imports this.
const detailsOut = {
  generatedFrom: 'BSData/wh40k-11e',
  datasheets,
  weaponProfiles,
  detachmentEnhancementDetails,
  armyRules,
  detachmentRules,
};

mkdirSync(dirname(outPath), { recursive: true });
mkdirSync(dirname(detailsOutPath), { recursive: true });
const banner =
  '// AUTO-GENERATED by scripts/gen-datasheets-11e.mjs from BSData/wh40k-11e — do not edit by hand.\n';
writeFileSync(outPath, banner + 'export default ' + JSON.stringify(namesOut) + ';\n');
writeFileSync(detailsOutPath, banner + 'export default ' + JSON.stringify(detailsOut) + ';\n');

const fc = Object.keys(factions).length;
const wc = Object.values(factions).reduce((n, a) => n + a.weapons.length, 0);
const gc = Object.values(factions).reduce((n, a) => n + a.wargear.length, 0);
const uc = Object.values(units).reduce((n, a) => n + a.length, 0);
const dc = Object.values(datasheets).reduce((n, o) => n + Object.keys(o).length, 0);
const wpc = Object.values(weaponProfiles).reduce((n, o) => n + Object.keys(o).length, 0);
const arc = Object.keys(armyRules).length;
const drc = Object.values(detachmentRules).reduce((n, o) => n + Object.keys(o).length, 0);
console.log(`Wrote ${outPath}`);
console.log(`  factions: ${fc}, weapons: ${wc}, wargear: ${gc}, unit/model names: ${uc}`);
console.log(`Wrote ${detailsOutPath}`);
console.log(`  full datasheets: ${dc}, weapon stat profiles: ${wpc}, army rules: ${arc}, detachment rules: ${drc}`);

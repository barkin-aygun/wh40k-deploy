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

// Enhancements are grouped under a "<Detachment> Enhancements" selectionEntryGroup.
// Map detachment name -> its enhancement names so resolution can be scoped.
const ENH_GROUP = /^(.+?)\s+Enhancements?$/i;
const GENERIC_ENH = /^(boarding actions?|breaching operation)$/i;
function collectDetachmentEnhancements(cat, sink) {
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
        for (const e of n.selectionEntries || []) {
          const nm = cleanName(e.name);
          if (nm && !isNoisyName(nm)) set.add(nm.toLowerCase());
        }
        for (const l of n.entryLinks || []) {
          const nm = cleanName(l.name);
          if (nm && !isNoisyName(nm)) set.add(nm.toLowerCase());
        }
        sink.detachEnh.set(det, set);
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
  collectDetachmentEnhancements(cat, sink);
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
}

const out = {
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

mkdirSync(dirname(outPath), { recursive: true });
const banner =
  '// AUTO-GENERATED by scripts/gen-datasheets-11e.mjs from BSData/wh40k-11e — do not edit by hand.\n';
writeFileSync(outPath, banner + 'export default ' + JSON.stringify(out) + ';\n');

const fc = Object.keys(factions).length;
const wc = Object.values(factions).reduce((n, a) => n + a.weapons.length, 0);
const gc = Object.values(factions).reduce((n, a) => n + a.wargear.length, 0);
const uc = Object.values(units).reduce((n, a) => n + a.length, 0);
console.log(`Wrote ${outPath}`);
console.log(`  factions: ${fc}, weapons: ${wc}, wargear: ${gc}, unit/model names: ${uc}`);

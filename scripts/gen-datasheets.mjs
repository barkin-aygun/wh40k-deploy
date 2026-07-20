#!/usr/bin/env node
/**
 * Extracts the datasheet corpus — per-faction weapon/wargear/unit names used
 * for abbreviation resolution (wargearDictionary.js) plus full stat blocks,
 * abilities, enhancements, and Army/Detachment Rules used for rendering
 * (datasheetLookup.js) — from @alpaca-software/40kdc-data.
 *
 * Replaces the former BSData/wh40k-11e extractor. Unlike BSData, 40kdc-data
 * deliberately does not store GW's copyrighted rule/ability text (see its
 * README's "IP Stance") — it encodes effects as a structured "Ability DSL"
 * tree instead. Where a DSL definition exists, this script renders it into
 * English via the package's own describeAbility() (their tested,
 * conformance-pinned translator — not reimplemented here). Unit abilities
 * have full DSL coverage; enhancements and Army/Detachment Rules are mixed —
 * an ability/enhancement/rule with no renderable text is simply omitted
 * rather than shown blank (see console summary after running).
 *
 * Output files keep the EXACT shape the former BSData extractor produced, so
 * wargearDictionary.js / datasheetLookup.js need no changes:
 *   src/data/datasheets11e.js        (names only — abbreviation corpus)
 *   src/data/datasheetDetails11e.js  (full render corpus)
 *
 * Usage: npm run gen:datasheets
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  factions,
  weaponKeywords,
  detachments,
  enhancements,
  abilities,
  describeAbility,
} from '@alpaca-software/40kdc-data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outPath = resolve(repoRoot, 'src/data/datasheets11e.js');
const detailsOutPath = resolve(repoRoot, 'src/data/datasheetDetails11e.js');

// 40kdc-data's faction "Adeptus Astartes" is this repo's "Space Marines" — the
// generic bucket a pasted list's header names when no Chapter is specified.
const FACTION_NAME_OVERRIDES = { 'adeptus-astartes': 'Space Marines' };
// Chapters carry zero units of their own in 40kdc-data (they're all filed
// under the shared "Adeptus Astartes" roster) but DO have their own
// detachments/enhancements/Army Rule — so the unit/weapon/ability corpus
// built for "Space Marines" is fanned out to every Chapter key afterward,
// while detachment/enhancement/army-rule passes iterate every faction
// (including Chapters) directly by their own faction_id. Mirrors the old
// BSData extractor's SM_CHAPTERS list (must match wargearDictionary.js's).
const SM_CHAPTERS = [
  'Black Templars', 'Blood Angels', 'Dark Angels', 'Deathwatch', 'Imperial Fists',
  'Iron Hands', 'Raven Guard', 'Salamanders', 'Space Wolves', 'Ultramarines', 'White Scars',
];

function ourFactionName(f) {
  return FACTION_NAME_OVERRIDES[f.id] || f.name;
}

function toTitleCase(s) {
  return String(s || '')
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

// Some ability ids are shared across factions with per-faction-specific
// mechanical parameters (e.g. "deadly-demise-1"'s actual value differs by
// unit) — abilities.get() throws on those rather than guess. Resolve
// faction-scoped first, falling back to any copy when faction is unknown.
function resolveAbility(abilityId, factionId) {
  if (!abilityId) return null;
  if (factionId) {
    const scoped = abilities.getInFaction(abilityId, factionId);
    if (scoped) return scoped;
  }
  return abilities.getAny(abilityId);
}

/** Render a DSL ability into English via the package's own translator. */
function describeText(abilityId, factionId) {
  const ab = resolveAbility(abilityId, factionId);
  if (!ab) return '';
  try {
    return describeAbility(ab.raw).trim();
  } catch {
    return '';
  }
}

/** "rapid-fire"+{value:1} -> "Rapid Fire 1"; "anti"+{target_keyword,threshold} -> "Anti-Infantry 4+". */
function formatWeaponKeyword(keywordId, parameters) {
  const kw = weaponKeywords.get(keywordId);
  const name = kw ? kw.raw.name : toTitleCase(keywordId.replace(/-/g, ' '));
  const req = kw?.raw.required_parameters || [];
  if (req.includes('target_keyword') && req.includes('threshold') && parameters) {
    return `${name}-${parameters.target_keyword} ${parameters.threshold}+`;
  }
  if (req.includes('value') && parameters) return `${name} ${parameters.value}`;
  return name;
}

function formatRange(range) {
  return typeof range === 'number' ? `${range}"` : range;
}

/** Matches the shape DatasheetCard.svelte's WEAPON_COLS expects. */
function weaponProfileRecord(w) {
  const typeName = w.raw.type === 'melee' ? 'Melee Weapons' : 'Ranged Weapons';
  const multiMode = w.raw.profiles.length > 1;
  const profiles = w.raw.profiles.map((p) => {
    const chars = {
      Range: formatRange(p.range),
      A: String(p.stats.A),
      S: String(p.stats.S),
      AP: String(p.stats.AP),
      D: String(p.stats.D),
    };
    if (p.stats.WS != null) chars.WS = `${p.stats.WS}+`;
    if (p.stats.BS != null) chars.BS = `${p.stats.BS}+`;
    const kws = (p.keywords || []).map((k) => formatWeaponKeyword(k.keyword_id, k.parameters));
    chars.Keywords = kws.length ? kws.join(', ') : '-';
    return { mode: multiMode ? p.name : null, chars };
  });
  return { name: w.name, typeName, profiles };
}

/** Matches DatasheetCard.svelte's STAT_COLS expects (M/T/Sv/W/LD/OC/InSv). */
function unitStatsRecord(u) {
  return (u.raw.profiles || []).map((p) => {
    const chars = {
      M: `${p.M}"`,
      T: String(p.T),
      Sv: `${p.Sv}+`,
      W: String(p.W),
      LD: `${p.Ld}+`,
      OC: String(p.OC),
    };
    if (p.invuln_sv != null) chars.InSv = `${p.invuln_sv}+`;
    return { name: p.name, chars };
  });
}

/** Every named unit ability with real renderable text (unrenderable ones are
 *  dropped rather than shown blank — DatasheetCard only lists what's here). */
function unitAbilityRecords(u) {
  const out = [];
  const seen = new Set();
  for (const id of u.raw.ability_ids || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const ab = resolveAbility(id, u.raw.faction_id);
    if (!ab) continue;
    const text = describeText(id, u.raw.faction_id);
    if (!text) continue;
    out.push({ name: ab.raw.name, text });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pass 1: per-faction weapon/wargear/unit/ability corpus. Skips Chapter
// factions (they have no units of their own) — fanned out from "Space
// Marines" afterward.
// ---------------------------------------------------------------------------
const perFaction = new Map();
function ensure(name) {
  if (!perFaction.has(name)) {
    perFaction.set(name, {
      weapons: new Set(),
      abilities: new Set(),
      units: new Set(),
      unitItems: new Map(), // unitNameLower -> Set(itemNameLower)
      unitAbilities: new Map(), // unitNameLower -> Set(abilityName)
      datasheets: new Map(), // unitNameLower -> full record
      weaponProfiles: new Map(), // weaponNameLower -> full record
    });
  }
  return perFaction.get(name);
}

const factionNameById = new Map();
for (const f of factions) factionNameById.set(f.id, ourFactionName(f));

for (const f of factions) {
  if (f.raw.parent_faction_id) continue;
  const name = ourFactionName(f);
  const bucket = ensure(name);

  for (const u of f.units) {
    const key = u.name.toLowerCase();
    bucket.units.add(u.name);

    // A unit's .weapons getter already aggregates base loadout + every
    // wargearOptions replacement, so it's the full "what this unit could
    // field" set on its own — the same role BSData's unitItems played.
    const itemNames = new Set();
    for (const w of u.weapons) {
      bucket.weapons.add(w.name);
      itemNames.add(w.name.toLowerCase());
      const wKey = w.name.toLowerCase();
      if (!bucket.weaponProfiles.has(wKey)) bucket.weaponProfiles.set(wKey, weaponProfileRecord(w));
    }

    const abilityNames = new Set();
    for (const id of u.raw.ability_ids || []) {
      const ab = resolveAbility(id, u.raw.faction_id);
      if (!ab) continue;
      bucket.abilities.add(ab.raw.name);
      abilityNames.add(ab.raw.name.toLowerCase());
      itemNames.add(ab.raw.name.toLowerCase()); // relic-modelled-as-ability, same as BSData's TIER_ABILITY
    }

    if (itemNames.size) bucket.unitItems.set(key, itemNames);
    if (abilityNames.size) bucket.unitAbilities.set(key, abilityNames);

    if (!bucket.datasheets.has(key)) {
      bucket.datasheets.set(key, {
        name: u.name,
        factionKeyword: (u.raw.faction_keywords || [])[0] || name,
        keywords: u.raw.keywords || [],
        abilities: unitAbilityRecords(u),
        stats: unitStatsRecord(u),
      });
    }
  }
}

const sm = perFaction.get('Space Marines');
if (sm) for (const chap of SM_CHAPTERS) perFaction.set(chap, sm);

// ---------------------------------------------------------------------------
// Pass 2: detachment-scoped data (Detachment Rule + enhancements) — every
// faction INCLUDING Chapters, each with its own detachments/enhancements.
// ---------------------------------------------------------------------------
const detachmentRules = new Map(); // factionName -> Map(detNameLower -> {name, ruleName, ruleText})
const detachEnh = new Map(); // factionName -> Map(detNameLower -> Set(enhNameLower))
const detachEnhDetails = new Map(); // factionName -> Map(detNameLower -> Map(enhNameLower -> {name, text, points}))

// The ~16 detachments shared by every Space Marine Chapter (Gladius Task
// Force, Anvil Siege Force, ...) are duplicated once per faction_id (one per
// Chapter, plus the generic "adeptus-astartes" copy) sharing the same `id` —
// but only the "adeptus-astartes" copy actually carries detachment_rule_id;
// every Chapter's own copy has it null. Fall back to that shared copy's id.
const sharedDetachmentRuleId = new Map(); // detachment id -> detachment_rule_id
for (const d of detachments) {
  if (d.faction_id === 'adeptus-astartes' && d.detachment_rule_id) {
    sharedDetachmentRuleId.set(d.id, d.detachment_rule_id);
  }
}

// Unlike factions/units/weapons/abilities, the detachments/enhancements
// collections yield plain data objects, not `.raw`-wrapped View instances.
for (const d of detachments) {
  const factionName = factionNameById.get(d.faction_id);
  if (!factionName) continue;
  const detKey = d.name.toLowerCase();

  const ruleId = d.detachment_rule_id || sharedDetachmentRuleId.get(d.id);
  if (ruleId) {
    const ab = resolveAbility(ruleId, d.faction_id);
    const text = describeText(ruleId, d.faction_id);
    if (ab && text) {
      const m = detachmentRules.get(factionName) || new Map();
      m.set(detKey, { name: d.name, ruleName: ab.raw.name, ruleText: text });
      detachmentRules.set(factionName, m);
    }
  }

  for (const enhId of d.enhancement_ids || []) {
    const enh = enhancements.get(enhId);
    if (!enh) continue;
    const nameLower = enh.name.toLowerCase();

    const namesMap = detachEnh.get(factionName) || new Map();
    const nameSet = namesMap.get(detKey) || new Set();
    nameSet.add(nameLower);
    namesMap.set(detKey, nameSet);
    detachEnh.set(factionName, namesMap);

    const detailsMap = detachEnhDetails.get(factionName) || new Map();
    const inner = detailsMap.get(detKey) || new Map();
    inner.set(nameLower, {
      name: enh.name,
      text: describeText(enh.ability_id, d.faction_id),
      points: enh.cost ?? null,
    });
    detailsMap.set(detKey, inner);
    detachEnhDetails.set(factionName, detailsMap);
  }
}

// ---------------------------------------------------------------------------
// Pass 3: Army Rule — every faction (including Chapters: e.g. Black Templars'
// own "templar-vows" differs from the parent's "oath-of-moment").
// ---------------------------------------------------------------------------
const armyRules = {};
for (const f of factions) {
  if (!f.raw.faction_rule_id) continue;
  const ab = resolveAbility(f.raw.faction_rule_id, f.id);
  const text = describeText(f.raw.faction_rule_id, f.id);
  if (ab && text) armyRules[ourFactionName(f)] = { name: ab.raw.name, text };
}

// ---------------------------------------------------------------------------
// Assemble output — same shape as the former BSData extractor produced.
// ---------------------------------------------------------------------------
const sorted = (set) => [...set].filter(Boolean).sort();

const factionsOut = {};
const unitsOut = {};
const unitItemsOut = {};
const unitAbilitiesOut = {};
const detachmentEnhancementsOut = {};
const datasheetsOut = {};
const weaponProfilesOut = {};
const detachmentRulesOut = {};
const detachmentEnhancementDetailsOut = {};

for (const [name, b] of [...perFaction.entries()].sort()) {
  factionsOut[name] = { weapons: sorted(b.weapons), wargear: [], abilities: sorted(b.abilities) };
  unitsOut[name] = sorted(b.units);

  const ui = {};
  for (const [u, set] of [...b.unitItems.entries()].sort()) if (set.size) ui[u] = sorted(set);
  unitItemsOut[name] = ui;

  const ua = {};
  for (const [u, set] of [...b.unitAbilities.entries()].sort()) if (set.size) ua[u] = sorted(set);
  unitAbilitiesOut[name] = ua;

  const ds = {};
  for (const [u, rec] of [...b.datasheets.entries()].sort()) ds[u] = rec;
  datasheetsOut[name] = ds;

  const wp = {};
  for (const [w, rec] of [...b.weaponProfiles.entries()].sort()) wp[w] = rec;
  weaponProfilesOut[name] = wp;
}

for (const [name, m] of detachEnh) {
  const de = {};
  for (const [det, set] of [...m.entries()].sort()) if (set.size) de[det] = sorted(set);
  detachmentEnhancementsOut[name] = de;
}
for (const [name, m] of detachEnhDetails) {
  const ded = {};
  for (const [det, inner] of [...m.entries()].sort()) {
    const io = {};
    for (const [k, v] of [...inner.entries()].sort()) io[k] = v;
    if (Object.keys(io).length) ded[det] = io;
  }
  detachmentEnhancementDetailsOut[name] = ded;
}
for (const [name, m] of detachmentRules) {
  const dr = {};
  for (const [det, val] of [...m.entries()].sort()) dr[det] = val;
  detachmentRulesOut[name] = dr;
}

const namesOut = {
  generatedFrom: '@alpaca-software/40kdc-data',
  common: { weapons: [], wargear: [] },
  factions: factionsOut,
  units: unitsOut,
  unitItems: unitItemsOut,
  unitAbilities: unitAbilitiesOut,
  detachmentEnhancements: detachmentEnhancementsOut,
};

const detailsOut = {
  generatedFrom: '@alpaca-software/40kdc-data',
  datasheets: datasheetsOut,
  weaponProfiles: weaponProfilesOut,
  detachmentEnhancementDetails: detachmentEnhancementDetailsOut,
  armyRules,
  detachmentRules: detachmentRulesOut,
};

mkdirSync(dirname(outPath), { recursive: true });
mkdirSync(dirname(detailsOutPath), { recursive: true });
const banner =
  '// AUTO-GENERATED by scripts/gen-datasheets.mjs from @alpaca-software/40kdc-data — do not edit by hand.\n';
writeFileSync(outPath, banner + 'export default ' + JSON.stringify(namesOut) + ';\n');
writeFileSync(detailsOutPath, banner + 'export default ' + JSON.stringify(detailsOut) + ';\n');

const fc = Object.keys(factionsOut).length;
const wc = Object.values(factionsOut).reduce((n, a) => n + a.weapons.length, 0);
const uc = Object.values(unitsOut).reduce((n, a) => n + a.length, 0);
const dc = Object.values(datasheetsOut).reduce((n, o) => n + Object.keys(o).length, 0);
const wpc = Object.values(weaponProfilesOut).reduce((n, o) => n + Object.keys(o).length, 0);
const abilitiesWithText = Object.values(datasheetsOut).reduce(
  (n, o) => n + Object.values(o).reduce((m, ds) => m + ds.abilities.length, 0),
  0,
);
const arc = Object.keys(armyRules).length;
const drc = Object.values(detachmentRulesOut).reduce((n, o) => n + Object.keys(o).length, 0);
const dedc = Object.values(detachmentEnhancementDetailsOut).reduce(
  (n, o) => n + Object.values(o).reduce((m, det) => m + Object.keys(det).length, 0),
  0,
);
const dedWithText = Object.values(detachmentEnhancementDetailsOut).reduce(
  (n, o) => n + Object.values(o).reduce((m, det) => m + Object.values(det).filter((e) => e.text).length, 0),
  0,
);
console.log(`Wrote ${outPath}`);
console.log(`  factions: ${fc}, weapons: ${wc}, unit/model names: ${uc}`);
console.log(`Wrote ${detailsOutPath}`);
console.log(`  full datasheets: ${dc}, weapon stat profiles: ${wpc}, unit abilities with text: ${abilitiesWithText}`);
console.log(`  army rules: ${arc}/${fc}, detachment rules: ${drc}`);
console.log(`  enhancements: ${dedc}, with rendered text: ${dedWithText}`);

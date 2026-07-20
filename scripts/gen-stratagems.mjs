#!/usr/bin/env node
/**
 * Extracts a stratagem corpus from the community-owned
 * @alpaca-software/40kdc-data package and writes src/data/stratagems11e.js.
 *
 * 40kdc-data deliberately does not store GW's copyrighted rule text (see its
 * README's "IP Stance") — it encodes what a stratagem *does* as a structured
 * "Ability DSL" tree instead. Where a stratagem has a linked ability, this
 * script renders that tree into plain English via the package's own
 * `describeAbility()` (their tested, conformance-pinned translator — not
 * reimplemented here). Only ~16% of stratagems currently have that link;
 * the rest carry metadata only (CP cost, phase, timing, type, targeting).
 *
 * The package is Node/CLI-oriented (ajv, glob, commander, ~30MB installed)
 * and not meant for browser bundling, so — like the BSData datasheet corpus
 * — it's a devDependency used only here, at generation time; the derived
 * output is a small, plain-data file safe to ship to the browser.
 *
 * Usage: npm run gen:stratagems
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stratagems, detachments, abilities, describeAbility } from '@alpaca-software/40kdc-data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outPath = resolve(repoRoot, 'src/data/stratagems11e.js');

// Matches wargearDictionary.js's normKey() apostrophe/diacritic handling,
// but also kebab-cases — this must land on the exact same slug 40kdc-data
// uses for faction_id/detachment_id (verified against their real ids, e.g.
// "T'au Empire" -> "tau-empire", "The Phaeron's Armoury" -> "the-phaerons-armoury").
function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’‘‛′]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 40kdc-data's faction_id doesn't always match this repo's BSData faction
// leaf slug — only known mismatch is the generic Space Marines catalogue.
const FACTION_ALIASES = { 'space-marines': 'adeptus-astartes' };

function toTitleCase(allCaps) {
  return String(allCaps || '')
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

const TYPE_LABELS = {
  'battle-tactic': 'Battle Tactic',
  'strategic-ploy': 'Strategic Ploy',
  'epic-deed': 'Epic Deed',
  wargear: 'Wargear',
};
const TIMING_LABELS = {
  'once-per-phase': 'Once per phase',
  'once-per-turn': 'Once per turn',
  'once-per-battle': 'Once per battle',
  unlimited: 'Unlimited',
};
const TURN_LABELS = {
  either: "Either player's turn",
  'your-turn': 'Your turn',
  'opponent-turn': "Opponent's turn",
};

function formatTargetRestrictions(tr) {
  if (!tr) return '';
  const parts = [];
  if (tr.required_keywords?.length) parts.push(`${tr.required_keywords.join(' + ')} only`);
  if (tr.required_keywords_any?.length) parts.push(`any of: ${tr.required_keywords_any.join(', ')}`);
  if (tr.excluded_keywords?.length) parts.push(`not ${tr.excluded_keywords.join(', ')}`);
  if (tr.notes) parts.push(tr.notes);
  return parts.join('; ');
}

function describeText(strat) {
  if (!strat.ability_id) return '';
  const ab = abilities.get(strat.ability_id);
  if (!ab) return '';
  try {
    return describeAbility(ab.raw).trim();
  } catch {
    return '';
  }
}

function summarize(strat) {
  return {
    id: strat.id,
    name: toTitleCase(strat.name),
    cpCost: strat.cp_cost,
    type: TYPE_LABELS[strat.type] || strat.type || '',
    phases: (strat.phases || []).map(toTitleCase).join(', '),
    turn: TURN_LABELS[strat.player_turn] || strat.player_turn || '',
    timing: TIMING_LABELS[strat.timing] || strat.timing || '',
    target: formatTargetRestrictions(strat.target_restrictions),
    text: describeText(strat),
  };
}

const all = [...stratagems];
const core = all
  .filter((s) => s.category === 'core')
  .map(summarize)
  .sort((a, b) => a.name.localeCompare(b.name));

// A stratagem record only carries detachment_id, not faction_id — resolve
// via the `detachments` collection, which has both.
const detachmentFaction = new Map();
for (const d of detachments) detachmentFaction.set(d.id, d.faction_id);

const factionsOut = {}; // factionSlug -> detachmentSlug -> [stratagems]
for (const s of all) {
  if (s.category !== 'detachment' || !s.detachment_id) continue;
  const faction = detachmentFaction.get(s.detachment_id);
  if (!faction) continue; // orphaned detachment_id, skip rather than misfile
  const byDet = factionsOut[faction] || (factionsOut[faction] = {});
  const list = byDet[s.detachment_id] || (byDet[s.detachment_id] = []);
  list.push(summarize(s));
}
for (const byDet of Object.values(factionsOut)) {
  for (const list of Object.values(byDet)) list.sort((a, b) => a.name.localeCompare(b.name));
}

const out = {
  generatedFrom: '@alpaca-software/40kdc-data',
  factionAliases: FACTION_ALIASES,
  core,
  factions: factionsOut,
};

mkdirSync(dirname(outPath), { recursive: true });
const banner =
  '// AUTO-GENERATED by scripts/gen-stratagems.mjs from @alpaca-software/40kdc-data — do not edit by hand.\n';
writeFileSync(outPath, banner + 'export default ' + JSON.stringify(out) + ';\n');

const withText = all.filter((s) => describeText(s)).length;
console.log(`Wrote ${outPath}`);
console.log(
  `  core: ${core.length}, factions: ${Object.keys(factionsOut).length}, ` +
    `detachment stratagems: ${all.filter((s) => s.category === 'detachment').length}, ` +
    `with rendered text: ${withText}`,
);

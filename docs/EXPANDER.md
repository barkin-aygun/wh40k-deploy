# Army List Expander

The inverse of [Desjani's 40kCompactor](https://github.com/desjani/40kCompactor).
Takes a **compacted** 11th-edition list (the abbreviated Discord/plain text the
compactor produces) and turns it back into a **completely parsed** structure with
abbreviations resolved to full item names — ready to join against a datasheet
database. Full-name formats the library parses natively (11th Edition GW App, War
Organ, New Recruit WTC / WTC-Compact / GW-NR, and the generic `V11_GENERIC` bracket
style) are also accepted and normalised losslessly.

11th edition only — the compactor dropped 10th-edition and legacy-format (NRNR,
ListForge) support upstream; this project follows that.

## Dependency: keep `40k-compactor` current

`node_modules/40k-compactor` is a git dependency pinned to a commit SHA in
`package-lock.json`, so it does **not** silently move on a normal `npm install`.
Desjani's repo evolves quickly (parser rewrites, new formats) — refresh it
periodically:

```bash
npm install github:desjani/40kCompactor   # re-resolves to the current HEAD commit
npm run gen:wargear-dict                  # skippable_wargear.json may have changed
```

After updating, re-run the CLI against a few real compacted lists and check
`warnings` — a parser/renderer rewrite upstream can change the intermediate data
shape or output format, which `armyExpander.js`/`armyParser.js` may need to follow
(see "How it works" below for the exact shape they expect).

## How it works

```
text ──► cleanLines (strip ANSI + ``` fences)
     ──► looksCompacted?
           ├─ yes ─► parseCompacted ─────────────────────┐
           └─ no  ─► 40k-compactor detectFormat/parse ────┘  both produce the same
     ──► normalize  ──►  datasheet-ready { faction, units[...] }     {metadata, units[]} shape
     ──► renderExpanded ─► human-readable text
```

Both parse paths converge on the **same intermediate shape the library itself
uses**: `{ metadata: {faction, detachment, pointsTotal, ...}, units: [{ name,
points, quantity, wargear[], enhancements[], subunits[], isWarlord, role,
attachedAs }] }`. `normalize()` has a single code path over that shape regardless
of which parser produced it — there's no separate nested-item tree to walk.

Key facts the design relies on:

- The compactor keeps **unit and subunit names in full** — only the parenthetical
  wargear/special tokens are abbreviated. So structure (units, points, quantities,
  subunits, combined `NxM` groups) is fully recoverable; only inline wargear needs
  the reverse dictionary.
- The compactor generates abbreviations **algorithmically** (`Icon of Khorne` →
  `IoK`), with no lookup table. `wargearDictionary.js` replicates that exact
  algorithm and pre-computes every abbreviation a known full name could produce
  (base form + collision-expanded steps) to build a reverse index.
- The compactor renders points as bare `[185]` (no "pts" word); no library format
  does, so that is the unambiguous "this is compacted output" signal.

## Files

| File | Purpose |
|---|---|
| `src/lib/services/armyExpander.js` | Core: detect → parse → normalize → render. `expandArmyList(text)` is the entry point. |
| `src/lib/services/wargearDictionary.js` | Abbreviation reverse-index, unit-context resolver, `registerWargearNames()` hook. |
| `src/data/datasheets11e.js` | **Primary corpus** — weapons/wargear + per-unit loadouts, extracted from BSData/wh40k-11e. |
| `src/data/wargearNames.js` | Supplementary seed corpus (skippable + curated). |
| `scripts/gen-datasheets-11e.mjs` | Regenerates the BSData corpus (`npm run gen:datasheets -- <clone>`). |
| `scripts/gen-wargear-dict.mjs` | Regenerates the supplementary seed corpus. |
| `bin/expand.mjs` | CLI wrapper. |
| `src/components/ArmyExpanderPanel.svelte`, `src/pages/ExpanderPage.svelte` | UI at `#/expander` (lazy-loaded). |

## Regenerating the corpus from BSData

The datasheet corpus is derived from [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e)
(JSON catalogue format). To refresh it after a data update:

```bash
git clone --depth 1 https://github.com/BSData/wh40k-11e.git /tmp/wh40k-11e
npm run gen:datasheets -- /tmp/wh40k-11e
```

The extractor produces, per faction: a `weapons` list (from weapon profiles),
a `wargear` list (from upgrade entries), a `units` name list, and `unitItems`
(each datasheet's loadout options). It resolves `entryLink`/`infoLink` `targetId`
references against a **global id map spanning every file**, so options defined in
shared libraries or other faction files (e.g. the shared Drones group, Space
Marine chapters using the core catalogue) are still attributed to the unit.

## CLI

```bash
npm run expand -- -i list.txt              # human-readable expansion
npm run expand -- -i list.txt --json       # datasheet-ready normalized JSON
npm run expand -- -i list.txt --data       # raw sectioned parser JSON
cat list.txt | npm run expand -- --json -w # from stdin, print unresolved abbrevs
```

## Output shape (`--json` / `result.normalized`)

```jsonc
{
  "faction": "World Eaters",          // leaf faction — the datasheet join key
  "detachment": "Berzerker Warband",
  "points": "2000pts",
  "title": "",
  "units": [
    {
      "name": "Khorne Berzerkers",    // never abbreviated → reliable datasheet match
      "quantity": 10,
      "points": 180,
      "warlord": false,
      "enhancements": [{ "name": "Favoured of Khorne", "points": 20 }],
      "wargear": [{ "name": "Icon of Khorne", "quantity": 1 }],
      "models": [{ "name": "Khorne Berzerker Champion", "quantity": 1,
                   "wargear": [{ "name": "Plasma pistol", "quantity": 1 }] }],
      "section": "Battleline"
    }
  ]
}
```

`section` is whatever category the parser assigned (`Characters`, `Battleline`,
`Attached Units`, etc. for GW App; blank for compacted-text input since role tags
don't carry a category) — informational only, not used for datasheet matching.

## How an abbreviation is resolved

For each abbreviated token the reverse index gathers every full name that could
produce it (base form + the compactor's collision-expanded steps), then narrows:

1. **Unit context** — keep only names the current unit can actually field
   (from BSData `unitItems`). This is what distinguishes the Maulerfiend's `MC`
   (Magma cutter) from the Jakhal's `MC` (Mauler chainblade).
2. **Base-exact** — prefer names whose base abbreviation equals the token.
3. **Weapon tier** — prefer weapons over other wargear/abilities.
4. **Faction scope** — prefer faction-specific names over the generic bucket.

Enhancement tokens (`E: X`, or the glued `E<abbr>` form like `EEoTK`) are scoped
to the enhancements of the list's **detachment** (`detachmentEnhancements` in the
corpus) — so `EoTK` under a Kauyon detachment resolves to *Exemplar of the Kauyon*,
not *Eye of the Kalamandra*.

If exactly one survives, it's resolved; otherwise the token is left as-is and
reported in `result.warnings` with the candidate list — never guessed.

### Compact-format quirks handled

Real exports carry more than the base compactor output, all normalised here:

- **Header** `Title | Faction - Detachment | ForceDispositions | Points` (T'au
  style, faction-then-detachment) as well as `Title | Family - Faction |
  Detachment | Points` (Chaos style) — the faction is found by name, not
  position. Force dispositions (secondaries) land in `normalized.forceDispositions`.
- **Curly apostrophes** (`T'au`) normalised to ASCII for all matching.
- **Leading quantity has three forms**, all handled: `3x10 Unit` (group×size),
  bare `2x Unit` (a combined group of *size-1* units, e.g. two separate Chaos
  Rhinos shown as one line — the "x" has no trailing size digit), and bare
  `10 Unit` (a single unit of size 10, no grouping).
- **Role/warlord tags** `[L1]`/`[B2]`/`[S4]`/`[W]` — the current renderer's
  canonical form — are stripped as a prefix and mapped to `role`/`isWarlord`.
- **Attachment markers**, defensively also handled inline (older/cached client
  output) — literal (`AttachedAsBodyguard`) or abbreviated (`AAL` = Attached as
  Leader, `AAS` = Support) — surfaced as `normalized.units[].attachment`, never
  treated as wargear.

### Inherent limits

Some abbreviations cannot be recovered from the compacted text alone. If a unit
can field **both** `Gun Drone` and `Guardian Drone`, and the list contained only
one, the compactor emits the bare `GD` (no collision → no extra letters written),
so the disambiguating letter never existed. These stay flagged with both
candidates. Everything is *accounted for* (identified with its options); not
everything is *auto-resolvable*.

### Runtime augmentation

The corpus is also augmentable at runtime — e.g. to layer in a newer datasheet
source without regenerating:

```js
import { registerWargearNames } from './src/lib/services/wargearDictionary.js';
registerWargearNames('World Eaters', ['Magma cutter', 'Mauler chainblade', /* … */]);
```

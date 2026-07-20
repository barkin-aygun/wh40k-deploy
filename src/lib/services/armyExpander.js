/**
 * Army List Expander
 * -------------------
 * The inverse of Desjani's 40kCompactor. Takes either:
 *   (a) the compactor's own compacted output (Discord/plain, abbreviated), or
 *   (b) a full-name list in any format the 40k-compactor library already parses
 *       (11th Edition GW App, War Organ, New Recruit WTC/WTC-Compact/GW-NR)
 * and produces a *completely parsed* structure with abbreviations expanded to
 * full item names — ready to be joined against a datasheet database.
 *
 * Scope: 11th edition only.
 *
 * Internally everything converges on the library's own {metadata, units[]}
 * shape (units carry wargear[]/enhancements[]/subunits[] directly, no nested
 * item tree) — my own compacted-text parser builds that same shape, so
 * normalize() has a single code path regardless of which parser ran.
 *
 * Primary output is `normalized` (datasheet-ready). `data` is the
 * {metadata, units[]} shape and `text` is a human-readable expanded rendering.
 */

import {
  detectFormat,
  parseV11List,
  parseGwAppV11,
  parseWarOrganV11,
  parseNRWTCCompact,
  parseNRWTC,
  parseNRGW,
} from '40k-compactor/modules/parsers.js';
import skippableWargearMap from '40k-compactor/skippable_wargear.json' with { type: 'json' };

import {
  expandAbbreviation,
  matchFaction,
  getUnitItems,
  getDetachmentEnhancements,
  looksLikeAbbreviation,
} from './wargearDictionary.js';

// ---------------------------------------------------------------------------
// Text cleanup
// ---------------------------------------------------------------------------

const ANSI_RE = /\u001b\[[0-9;]*m/g; // strip ANSI SGR colour codes

/** Strip ANSI colour codes and Discord ``` fences; return an array of lines. */
function cleanLines(text) {
  const noAnsi = String(text || '').replace(ANSI_RE, '');
  return noAnsi
    .split(/\r?\n/)
    .filter((l) => !/^\s*```/.test(l)); // drop ``` / ```ansi fences
}

// ---------------------------------------------------------------------------
// Detection: is this the compactor's own (abbreviated) output?
// ---------------------------------------------------------------------------

// The compactor renders unit points as bare square brackets: "[185]" (no "pts"
// word). Category/role tags like "[Leader]" or "[L1]" are non-numeric, and
// V11_GENERIC's points are in round parens, so this stays an unambiguous signal.
const SQUARE_PTS_RE = /\[\s*\d{1,4}\s*\]\s*$/;
const ROUND_PTS_RE = /\(\s*\d{1,4}\s*(?:pts|points)\s*\)/i;

export function looksCompacted(lines) {
  const square = lines.filter((l) => SQUARE_PTS_RE.test(l)).length;
  const round = lines.filter((l) => ROUND_PTS_RE.test(l)).length;
  if (square >= 1 && square >= round) return true;
  // hide-points fallback: bulleted body + " | " header, and no round "(N pts)".
  const hasPipeHeader = lines.some((l) => l.includes(' | '));
  const bulletBody = lines.filter((l) => /^\s*[•*+◦]\s+/.test(l)).length;
  if (round === 0 && bulletBody >= 2 && hasPipeHeader) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Compacted-output parser
// ---------------------------------------------------------------------------

// Split a wargear string on top-level commas only (so "E: WT (+20)" stays whole).
function splitTopLevel(str) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const UNIT_BULLET_RE = /^\s*([•*])\s+(.*)$/; // top-level unit
const SUB_BULLET_RE = /^\s*([+◦])\s+(.*)$/; // subunit

/** Pull "(items)" off the end of "Name (items)"; returns { name, itemsRaw }. */
function splitNameAndItems(s) {
  const m = s.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) return { name: m[1].trim(), itemsRaw: m[2] };
  return { name: s.trim(), itemsRaw: '' };
}

function normalizeRole(role) {
  if (/leader/i.test(role)) return 'Leader';
  if (/support/i.test(role)) return 'Support';
  return 'Bodyguard';
}

/** Apply one abbreviated wargear/special/attachment token onto a unit or subunit. */
function applyToken(target, unitFlags, token, faction, warnings, context, allowed, detachEnh) {
  const t = token.trim();
  if (!t) return;

  if (/^warlord$/i.test(t)) {
    unitFlags.isWarlord = true;
    return;
  }

  // Attachment markers describe the leader/bodyguard relationship, not wargear.
  // The current renderer emits these as "[L1]"/"[B2]"/"[S4]" prefix tags (handled
  // in parseUnitLine), but older/cached client output may still render them as
  // inline tokens — literal ("AttachedAsBodyguard2") or abbreviated
  // ("AAL" = Attached as Leader, "AAS" = Support, "AAB" = Bodyguard). Handle both.
  const ATTACH_ABBR = { AAL: 'Leader', AAS: 'Support', AAB: 'Bodyguard' };
  const attachAbbr = ATTACH_ABBR[t.replace(/\d+$/, '').toUpperCase()];
  if (/^Attached\s*As/i.test(t) || attachAbbr) {
    const role = attachAbbr || t.replace(/^Attached\s*As\s*/i, '').replace(/\d+$/, '').trim();
    unitFlags.role = normalizeRole(role);
    unitFlags.attachedAs = role;
    return;
  }

  // Enhancement: "E: <abbr> (+NN)" — enhancements aren't unit-loadout items.
  const enh = t.match(/^E:\s*(.*)$/i);
  if (enh) {
    const rest = enh[1].trim();
    const ptsM = rest.match(/\(([^)]*)\)\s*$/);
    const pts = ptsM ? parseInt(ptsM[1].replace(/[^\d]/g, ''), 10) || 0 : 0;
    const abbr = rest.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const ex = expandAbbreviation(abbr, faction, detachEnh);
    if (!ex.resolved) noteUnresolved(warnings, abbr, faction, context, 'enhancement', ex);
    target.enhancements.push({ name: ex.resolved ? ex.value : abbr, points: pts });
    return;
  }

  // Wargear, optionally quantity-prefixed: "2x KhEv" / "KhEv".
  const qm = t.match(/^(\d+)x?\s+(.*)$/i);
  const qty = qm ? parseInt(qm[1], 10) || 1 : 1;
  const abbr = qm ? qm[2].trim() : t;
  const ex = expandAbbreviation(abbr, faction, allowed);

  // Some exports render enhancements glued as "E<Abbr>" (e.g. "EEoTK" = Exemplar
  // of the Kauyon). If the whole token misses but its E-stripped tail matches an
  // item, it's an enhancement — reclassify rather than mislabel it as wargear.
  if (!ex.resolved && /^E[A-Z]/.test(abbr) && abbr.length >= 3) {
    const inner = abbr.slice(1);
    const exi = expandAbbreviation(inner, faction, detachEnh);
    if (exi.resolved || (exi.options && exi.options.length)) {
      if (!exi.resolved) noteUnresolved(warnings, inner, faction, context, 'enhancement', exi);
      target.enhancements.push({ name: exi.resolved ? exi.value : inner, points: 0 });
      return;
    }
  }

  // Flag anything expandAbbreviation() actually attempted to look up (short
  // token like "KhEv" or a long concatenated literal like "CloseCombatWeapon")
  // and failed to resolve — using the SAME gate it uses internally, so nothing
  // that was genuinely tried-and-failed can silently pass through unflagged.
  if (!ex.resolved && looksLikeAbbreviation(abbr)) {
    noteUnresolved(warnings, abbr, faction, context, 'wargear', ex);
  }
  target.wargear.push({ name: ex.resolved ? ex.value : abbr, quantity: qty });
}

function noteUnresolved(warnings, abbr, faction, context, kind, ex) {
  warnings.push({
    kind: ex.ambiguous ? 'ambiguous' : 'unresolved',
    itemType: kind,
    abbreviation: abbr,
    context,
    options: ex.options || [],
  });
}

// A header part that reads as a points total: "1975pts", "2000 points", "1985 / 2000pts".
function parsePointsPart(part) {
  const t = part.trim();
  const combo = t.match(/^(\d+)\s*\/\s*(\d+)\s*(?:pts?|points)?$/i);
  if (combo) return { pointsTotal: parseInt(combo[1], 10) || 0, pointsLimit: parseInt(combo[2], 10) || 0 };
  if (/\d\s*pts?\b/i.test(t) || /\d\s*points?\b/i.test(t)) {
    const m = t.match(/(\d+)/);
    return { pointsTotal: m ? parseInt(m[1], 10) : 0, pointsLimit: 0 };
  }
  if (/^\d{3,4}$/.test(t)) return { pointsTotal: parseInt(t, 10), pointsLimit: 0 };
  return null;
}

function parseHeader(headerParts, metadata) {
  // Header parts arrive in the compactor's order (title?, faction, detachment?,
  // forceDispositions?, points), but the faction part may itself be
  // "Family - Faction" (Chaos - World Eaters) OR "Faction - Detachment"
  // (T'au Empire - Kauyon). Anchor on the recognised faction name either way.
  const remaining = [];
  for (const raw of headerParts) {
    const part = raw.trim();
    if (!part) continue;
    const pts = parsePointsPart(part);
    if (pts && !metadata.pointsTotal) Object.assign(metadata, pts);
    else remaining.push(part);
  }
  if (!remaining.length) return;

  let factionIdx = -1;
  let canonical = null;
  for (let k = 0; k < remaining.length; k++) {
    const mf = matchFaction(remaining[k]);
    if (mf) {
      factionIdx = k;
      canonical = mf;
      break;
    }
  }

  if (factionIdx === -1) {
    metadata.faction = remaining[0];
    if (remaining[1]) metadata.detachment = remaining[1];
    return;
  }

  metadata.faction = canonical; // clean, canonical faction name
  // Detachment: text following the faction name within the same part ("T'au
  // Empire - Kauyon" -> "Kauyon"), else the next part ("... | Berzerker Warband").
  const nk = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’‛′]/g, "'").toLowerCase().trim();
  const segs = remaining[factionIdx].split(/\s+-\s+/);
  const fi = segs.findIndex((seg) => nk(seg).includes(nk(canonical)));
  let tail = '';
  if (fi >= 0 && fi < segs.length - 1) tail = segs.slice(fi + 1).join(' - ').trim();

  let afterFactionIdx = factionIdx;
  if (tail) {
    metadata.detachment = tail;
  } else if (remaining[factionIdx + 1]) {
    metadata.detachment = remaining[factionIdx + 1];
    afterFactionIdx = factionIdx + 1;
  }

  // Anything remaining after title/faction/detachment is force dispositions
  // (e.g. "Disruption, Purge the Foe").
  const disp = remaining[afterFactionIdx + 1];
  if (disp) metadata.forceDispositions = disp.split(',').map((s) => s.trim()).filter(Boolean);

  const before = remaining.slice(0, factionIdx);
  if (before.length) metadata.title = before.join(' | ');
}

export function parseCompacted(lines) {
  const metadata = { title: '', faction: '', detachment: '', forceDispositions: [], pointsTotal: 0, pointsLimit: 0 };
  const units = [];

  // --- header: leading non-bullet lines before the first unit -------------
  let i = 0;
  const headerParts = [];
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) {
      if (headerParts.length) {
        i++;
        break;
      }
      continue;
    }
    if (UNIT_BULLET_RE.test(lines[i]) || SUB_BULLET_RE.test(lines[i]) || SQUARE_PTS_RE.test(t)) break;
    // A header line may itself be pipe-delimited.
    for (const p of t.split('|')) headerParts.push(p);
  }
  parseHeader(headerParts, metadata);
  const faction = metadata.faction || '';
  const detachEnh = getDetachmentEnhancements(faction, metadata.detachment); // scope enhancements

  // --- body ----------------------------------------------------------------
  let currentUnits = []; // the (possibly multiple) units from the last unit line
  let currentAllowed = null; // corpus loadout items for the current unit (for disambiguation)
  const warnings = [];

  for (; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) continue;

    const sub = line.match(SUB_BULLET_RE);
    const unit = line.match(UNIT_BULLET_RE);

    if (sub && currentUnits.length) {
      const content = sub[2].trim();
      const { name, itemsRaw } = splitNameAndItems(content);
      const qm = name.match(/^(\d+)\s+(.*)$/);
      const subQty = qm ? parseInt(qm[1], 10) || 1 : 1;
      const subName = qm ? qm[2].trim() : name;
      // Subunit weapons are part of the parent unit's datasheet — use its loadout.
      const subFlags = {}; // subunits don't carry warlord/attachment flags
      const sub_ = { name: subName, quantity: subQty, wargear: [], enhancements: [] };
      splitTopLevel(itemsRaw).forEach((tok) =>
        applyToken(sub_, subFlags, tok, faction, warnings, subName, currentAllowed, detachEnh),
      );
      for (const u of currentUnits) {
        u.subunits.push({ name: sub_.name, quantity: sub_.quantity, wargear: sub_.wargear.map((w) => ({ ...w })) });
      }
      continue;
    }

    // Unit line (bulleted, or bare line ending in [pts]).
    let body = null;
    if (unit) body = unit[2];
    else if (SQUARE_PTS_RE.test(t)) body = t;
    if (body == null) continue;

    const parsed = parseUnitLine(body, faction, warnings, detachEnh);
    units.push(...parsed.units);
    currentUnits = parsed.units;
    currentAllowed = parsed.allowed;
  }

  return { metadata, units, __warnings: warnings };
}

function parseUnitLine(body, faction, warnings, detachEnh = null) {
  let s = body.trim();

  // trailing points [NNN]
  let points = 0;
  const pm = s.match(/\[\s*(\d{1,4})\s*\]\s*$/);
  if (pm) {
    points = parseInt(pm[1], 10) || 0;
    s = s.replace(/\[\s*\d{1,4}\s*\]\s*$/, '').trim();
  }

  // leading role/marker tags: "[L1][W]" (Leader 1, Warlord), "[B2]", "[S4]".
  let isWarlord = false;
  let role = null;
  let tag;
  while ((tag = s.match(/^\[([^\]]*)\]\s*/))) {
    const content = tag[1].trim();
    if (/^w(arlord)?$/i.test(content)) isWarlord = true;
    else if (/^L\d*$/i.test(content)) role = 'Leader';
    else if (/^B\d*$/i.test(content)) role = 'Bodyguard';
    else if (/^S\d*$/i.test(content)) role = 'Support';
    s = s.slice(tag[0].length);
  }

  // leading quantity: "3x10 " (group x size), "2x " (group of size-1 units,
  // e.g. combined "2x Chaos Rhino"), or bare "10 " (single unit, size 10).
  let groupCount = 1;
  let unitSize = 1;
  const combo = s.match(/^(\d+)x(\d+)\s+/);
  const comboImplicit = !combo && s.match(/^(\d+)x\s+/);
  if (combo) {
    groupCount = parseInt(combo[1], 10) || 1;
    unitSize = parseInt(combo[2], 10) || 1;
    s = s.slice(combo[0].length);
  } else if (comboImplicit) {
    groupCount = parseInt(comboImplicit[1], 10) || 1;
    unitSize = 1;
    s = s.slice(comboImplicit[0].length);
  } else {
    const single = s.match(/^(\d+)\s+/);
    if (single) {
      unitSize = parseInt(single[1], 10) || 1;
      s = s.slice(single[0].length);
    }
  }

  const { name, itemsRaw } = splitNameAndItems(s);
  const allowed = getUnitItems(faction, name); // corpus loadout for disambiguation

  const made = [];
  for (let g = 0; g < groupCount; g++) {
    const unitFlags = { isWarlord, role: role || undefined, attachedAs: undefined };
    const u = {
      name,
      points,
      quantity: unitSize,
      wargear: [],
      enhancements: [],
      subunits: [],
    };
    splitTopLevel(itemsRaw).forEach((tok) =>
      applyToken(u, unitFlags, tok, faction, warnings, name, allowed, detachEnh),
    );
    Object.assign(u, unitFlags);
    made.push(u);
  }
  return { units: made, allowed };
}

// ---------------------------------------------------------------------------
// Structured (library) parsing
// ---------------------------------------------------------------------------

const LIBRARY_PARSERS = {
  V11_GENERIC: parseV11List,
  GW_APP_V11: parseGwAppV11,
  WAR_ORGAN_V11: parseWarOrganV11,
  NR_WTC_COMPACT: parseNRWTCCompact,
  NR_WTC: parseNRWTC,
  NR_GW: parseNRGW,
};

function parseWithLibrary(lines) {
  const format = detectFormat(lines);
  const parser = LIBRARY_PARSERS[format];
  if (!parser) return { format, data: null };
  return { format, data: parser(lines, skippableWargearMap) };
}

// ---------------------------------------------------------------------------
// Normalization -> datasheet-ready structure
// ---------------------------------------------------------------------------

function factionLeaf(metadata) {
  const raw = metadata.faction || '';
  return matchFaction(raw) || raw.toString().split(' - ').pop().trim();
}

// GW App exports render the detachment as its own line, "<Detachment> (N
// Detachment Points)" — e.g. "War Horde (3 Detachment Points)". The library's
// GW_APP_V11 parser tries to fold a subfaction line into `faction` by peeking
// the line after it, but that peek only recognises a bare "(N points/pts)"
// suffix, not "(N Detachment Points)" — so it wrongly swallows the whole
// detachment line into `faction` (-> "Orks - War Horde (3 Detachment Points)")
// and then misreads the line *after* that (the mission/game type, e.g. "Take
// and Hold") as the detachment. Detect and undo that here, format-agnostically
// (matches whichever parser produced `metadata`, not just GW App), the same
// way other real-export header quirks are patched in this file.
const FACTION_EMBEDDED_DETACHMENT_RE =
  /^(.*)\s-\s(.+?)\s*\(\s*\d+[\d,]*\s*Detachment\s*Points?\s*\)\s*$/i;
function fixMisparsedGwAppDetachment(metadata) {
  const m = FACTION_EMBEDDED_DETACHMENT_RE.exec(metadata.faction || '');
  if (!m) return;
  metadata.faction = m[1].trim();
  metadata.detachments = [m[2].trim()];
}

function displayDetachment(metadata) {
  if (Array.isArray(metadata.detachments) && metadata.detachments.length) {
    return metadata.detachments.join(' and ');
  }
  return metadata.detachment || '';
}

function displayPoints(metadata) {
  const total = metadata.pointsTotal ?? metadata.totalPoints ?? 0;
  const limit = metadata.pointsLimit || 0;
  if (!total && !limit) return '';
  return limit ? `${total} / ${limit}pts` : `${total}pts`;
}

// Flatten "Attached Units" wrapper groups (isAttached + attachedParts[]) that
// the library's GW App parser produces into individual leader/bodyguard units,
// matching how every other section's units are represented.
function flattenUnits(units) {
  const out = [];
  for (const u of units || []) {
    if (u.isAttached && Array.isArray(u.attachedParts)) out.push(...u.attachedParts);
    else out.push(u);
  }
  return out;
}

// Some source formats list the same item multiple times instead of "Nx Item"
// (e.g. "Combi-bolter, Combi-bolter" for two separate weapons on one model).
// Merge those into a single quantity for cleaner datasheet-ready output.
function aggregateWargear(list) {
  const order = [];
  const byName = new Map();
  for (const w of list || []) {
    const key = w.name;
    if (!byName.has(key)) {
      byName.set(key, { name: w.name, quantity: 0 });
      order.push(key);
    }
    byName.get(key).quantity += w.quantity ?? 1;
  }
  return order.map((k) => byName.get(k));
}

function normalizeUnit(unit) {
  const attachment = unit.role || unit.attachedAs ? `Attached as ${unit.role || unit.attachedAs}` : null;
  return {
    name: unit.name,
    quantity: unit.quantity ?? 1,
    points: typeof unit.points === 'number' ? unit.points : parseInt(unit.points, 10) || 0,
    warlord: !!unit.isWarlord,
    attachment,
    enhancements: (unit.enhancements || []).map((e) => ({ name: e.name, points: e.points ?? null })),
    wargear: aggregateWargear(unit.wargear),
    models: (unit.subunits || []).map((s) => ({
      name: s.name,
      quantity: s.quantity ?? 1,
      wargear: aggregateWargear(s.wargear),
    })),
    section: unit.category || '',
  };
}

export function normalize(data) {
  const metadata = data.metadata || {};
  fixMisparsedGwAppDetachment(metadata);
  const units = flattenUnits(data.units).map(normalizeUnit);
  return {
    faction: factionLeaf(metadata),
    factionKeyword: metadata.faction || '',
    displayFaction: metadata.faction || '',
    detachment: displayDetachment(metadata),
    forceDispositions: metadata.forceDispositions || [],
    points: displayPoints(metadata),
    title: metadata.title || metadata.armyName || '',
    units,
  };
}

// ---------------------------------------------------------------------------
// Human-readable expanded rendering
// ---------------------------------------------------------------------------

function itemListString(items) {
  return items
    .map((w) => (w.quantity > 1 ? `${w.quantity}x ${w.name}` : w.name))
    .join(', ');
}

export function renderExpanded(normalized) {
  const lines = [];
  lines.push('=== 11th Edition Army List ===');
  if (normalized.title) lines.push(`Title: ${normalized.title}`);
  lines.push(`Faction: ${normalized.displayFaction || normalized.faction}`);
  if (normalized.detachment) lines.push(`Detachment: ${normalized.detachment}`);
  if (normalized.forceDispositions && normalized.forceDispositions.length) {
    lines.push(`Secondary: ${normalized.forceDispositions.join(', ')}`);
  }
  if (normalized.points) lines.push(`Points: ${normalized.points}`);
  lines.push('');

  for (const u of normalized.units) {
    const qty = u.quantity > 1 ? `${u.quantity}x ` : '';
    const tags = [u.warlord ? 'Warlord' : null, u.attachment].filter(Boolean).join(', ');
    lines.push(`${qty}${u.name} (${u.points} pts)${tags ? ` — ${tags}` : ''}`);
    for (const e of u.enhancements) {
      lines.push(`  - Enhancement: ${e.name}${e.points ? ` (+${e.points} pts)` : ''}`);
    }
    if (u.wargear.length) lines.push(`  - Wargear: ${itemListString(u.wargear)}`);
    for (const m of u.models) {
      const mq = m.quantity > 1 ? `${m.quantity}x ` : '';
      const wg = m.wargear.length ? `: ${itemListString(m.wargear)}` : '';
      lines.push(`  - ${mq}${m.name}${wg}`);
    }
    lines.push('');
  }
  return lines.join('\n').replace(/\n+$/, '\n');
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Expand a compacted (or full) army list.
 * @param {string} text
 * @param {{ preferCompacted?: boolean }} [options]
 * @returns {{ inputKind: 'compacted'|'structured', format: string, data: object,
 *             normalized: object, text: string, warnings: Array }}
 */
export function expandArmyList(text, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty army list');
  }
  const lines = cleanLines(text);

  const useCompacted = options.preferCompacted ?? looksCompacted(lines);

  let inputKind;
  let format;
  let data;

  if (useCompacted) {
    inputKind = 'compacted';
    format = 'COMPACTED';
    data = parseCompacted(lines);
  } else {
    const res = parseWithLibrary(lines);
    if (!res.data) {
      // Last resort: maybe it *is* compacted after all.
      inputKind = 'compacted';
      format = 'COMPACTED';
      data = parseCompacted(lines);
    } else {
      inputKind = 'structured';
      format = res.format;
      data = res.data;
    }
  }

  const warnings = data.__warnings || [];
  const normalized = normalize(data);
  const rendered = renderExpanded(normalized);

  return { inputKind, format, data, normalized, text: rendered, warnings };
}

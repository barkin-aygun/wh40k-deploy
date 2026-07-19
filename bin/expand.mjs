#!/usr/bin/env node
/**
 * Army List Expander — CLI wrapper around src/lib/services/armyExpander.js.
 *
 * Reads a compacted (or full) 40k list from a file or stdin and expands it into
 * a fully-parsed form. Default output is human-readable; --json emits the
 * datasheet-ready normalized structure.
 *
 * Usage:
 *   node bin/expand.mjs -i list.txt
 *   pbpaste | node bin/expand.mjs --json
 *   node bin/expand.mjs -i list.txt --json --warnings
 */
import { readFileSync } from 'node:fs';
import { expandArmyList } from '../src/lib/services/armyExpander.js';

function parseArgs(argv) {
  const opts = { input: null, json: false, data: false, warnings: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-i' || a === '--input') opts.input = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--data') opts.data = true;
    else if (a === '--warnings' || a === '-w') opts.warnings = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (!a.startsWith('-') && !opts.input) opts.input = a;
  }
  return opts;
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

const HELP = `Army List Expander (11th edition)

Expands Desjani's 40kCompactor output (or any supported full list) into a
completely parsed structure with abbreviations resolved to full item names.

Usage:
  node bin/expand.mjs [-i <file>] [--json | --data] [--warnings]

Options:
  -i, --input <file>  Read from file (default: stdin)
      --json          Print the datasheet-ready normalized JSON
      --data          Print the raw sectioned parser JSON
  -w, --warnings      Print unresolved/ambiguous abbreviations to stderr
  -h, --help          Show this help
`;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }

  const text = opts.input ? readFileSync(opts.input, 'utf8') : readStdin();
  if (!text.trim()) {
    process.stderr.write('No input. Provide -i <file> or pipe via stdin. See --help.\n');
    process.exit(1);
  }

  let result;
  try {
    result = expandArmyList(text);
  } catch (err) {
    process.stderr.write(`Expand failed: ${err.message}\n`);
    process.exit(1);
  }

  if (opts.data) {
    const { __warnings, ...clean } = result.data;
    process.stdout.write(JSON.stringify(clean, null, 2) + '\n');
  } else if (opts.json) {
    process.stdout.write(JSON.stringify(result.normalized, null, 2) + '\n');
  } else {
    process.stdout.write(result.text + '\n');
  }

  process.stderr.write(
    `\n[expander] input=${result.inputKind} format=${result.format} ` +
      `units=${result.normalized.units.length} warnings=${result.warnings.length}\n`,
  );

  if (opts.warnings && result.warnings.length) {
    process.stderr.write('\nUnresolved / ambiguous abbreviations:\n');
    for (const w of result.warnings) {
      const opt = w.options && w.options.length ? `  (candidates: ${w.options.join(' | ')})` : '';
      process.stderr.write(`  [${w.kind}] ${w.itemType} "${w.abbreviation}" in "${w.context}"${opt}\n`);
    }
  }
}

main();

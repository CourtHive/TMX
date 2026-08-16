#!/usr/bin/env node
// i18n-audit — find user-facing strings that are hardcoded English instead of `t()` calls.
//
// WHY THIS EXISTS
//
// TMX's i18n gap has two halves. The first — keys that exist in the bundled
// `en.json` but never reach `courthive-i18n` — is measurable by comparing two JSON
// files, and the sync workflow now closes it. The second is invisible to every
// existing check: a string that was never a `t()` call reaches no locale file at
// all, so no key-parity gate, completeness metric or translator report will ever
// mention it. It is simply English, forever, for every user.
//
// A one-off grep put that at ~410 occurrences across 123 files. A one-off number
// is not useful — it cannot tell you whether the problem is growing, and it
// silently regrows the moment attention moves elsewhere. So this is a script with
// a baseline ratchet rather than a number in a planning doc: existing offenders
// are recorded, and `--ci` fails on anything NEW.
//
// WHAT IT LOOKS AT
//
// AST, not regex (the attr-audit precedent) — a regex cannot tell a property
// value from a substring of one, and cannot see that `label: t('x')` is already
// translated. Two shapes, both high-signal:
//
//   1. object properties known to carry user-facing text in this codebase
//      (`text:`, `label:`, `title:`, `placeholder:`, …) whose value is a plain
//      string literal;
//   2. `element.textContent = 'Some text'` assignments.
//
// A value that is a call, template with substitution, identifier or member access
// is never reported — `t('key')`, `` `${count} items` `` and `LABELS.cancel` all
// pass through untouched.
//
// PRECISION
//
// The property names above also carry plenty of non-prose: `'YYYY-MM-DD'`,
// `'#fff'`, `'is-info'`, `'ABANDONED'`, `'12px'`, bare FontAwesome markup. Those
// are filtered out by `looksLikeProse`, which strips HTML tags first so a mixed
// value like `"<i class='fas fa-users'></i> Edit group"` is still caught on its
// text. The filter is deliberately conservative: this is a ratchet, and a false
// positive costs a developer an allow-list entry on an unrelated PR.
//
// Usage:
//   node scripts/i18n-audit.mjs                    # report
//   node scripts/i18n-audit.mjs --ci               # exit 1 on findings not in the baseline
//   node scripts/i18n-audit.mjs --update-baseline  # re-record (review the diff!)
//   node scripts/i18n-audit.mjs --json out.json    # machine-readable
//
// Exit codes: 0 ok · 1 new findings (with --ci) · 2 internal error.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(ROOT, 'scripts', 'i18n-audit.baseline.json');

/** Object properties that carry user-facing text in this codebase. */
const UI_PROPS = new Set([
  'text',
  'label',
  'title',
  'placeholder',
  'message',
  'header',
  'tooltip',
  'toolTip',
  'headerTooltip',
  'confirmText',
  'cancelText',
  'okText',
]);

/** Files whose strings are never user-facing. */
const EXCLUDED = [/\.test\.ts$/, /\.stories\.ts$/, /\/i18n\//, /\/constants\//, /\/tests?\//];

// ---------------------------------------------------------------- prose filter

const HTML_TAG = /<[^>]*>/g;
const DATE_FORMAT = /^[YMDHhms\-/:.,\s]+$/;
const ENUM_LIKE = /^[A-Z0-9_]+$/;
const CSS_UNIT = /^-?[\d.]+(px|rem|em|%|vh|vw|s|ms)$/;
const IDENTIFIER_LIKE = /^[a-z][a-z0-9]*([-_][a-z0-9]+)*$/;
const URLISH = /^(https?:|\/|\.\/|#|data:|mailto:)/;
// A brace block containing a declaration — `.foo { color: red; }`. Some components
// pass a whole stylesheet through a `text:`-named property, and stripping HTML
// tags leaves the CSS behind looking like a very long sentence.
const CSS_BLOCK = /\{[^{}]*:[^{}]*\}/s;

/**
 * Does this string read as something a human is meant to read?
 *
 * Conservative by design — see PRECISION above. HTML is stripped first so a value
 * that mixes an icon with a label is judged on the label.
 */
export function looksLikeProse(raw) {
  if (CSS_BLOCK.test(raw)) return false; // a stylesheet, not a sentence

  const value = raw.replace(HTML_TAG, ' ').replace(/\s+/g, ' ').trim();

  if (value.length < 2) return false;
  if (!/[A-Za-z]/.test(value)) return false; // no letters: numbers, punctuation, symbols
  if (URLISH.test(value)) return false;
  if (CSS_UNIT.test(value)) return false;
  if (ENUM_LIKE.test(value)) return false; // ABANDONED, MALE, SINGLE_ELIMINATION
  if (DATE_FORMAT.test(value)) return false; // YYYY-MM-DD, HH:mm
  if (IDENTIFIER_LIKE.test(value)) return false; // is-info, participantId, fa-solid

  // Prose is either multi-word, or a single Capitalised word ("Cancel", "Save").
  const words = value.split(' ');
  if (words.length > 1) return true;
  return /^[A-Z][a-z]/.test(value);
}

// ---------------------------------------------------------------- AST walk

function stringValueOf(node) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined; // calls (t(...)), identifiers, templates with substitution, …
}

function collectFromFile(file, findings) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const rel = path.relative(ROOT, file);

  const record = (node, prop, value) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push({ file: rel, line: line + 1, prop, value });
  };

  const visit = (node) => {
    // 1. { label: 'Cancel' }
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : undefined;
      if (name && UI_PROPS.has(name)) {
        const value = stringValueOf(node.initializer);
        if (value !== undefined && looksLikeProse(value)) record(node, name, value);
      }
    }

    // 2. el.textContent = 'No officials found'
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'textContent'
    ) {
      const value = stringValueOf(node.right);
      if (value !== undefined && looksLikeProse(value)) record(node, 'textContent', value);
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith('.ts') && !EXCLUDED.some((re) => re.test(full))) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------- baseline

/**
 * Baseline identity deliberately EXCLUDES the line number: moving a string down a
 * file is not a new offence, and a line-keyed baseline would churn on every
 * unrelated edit until nobody trusted it.
 */
// JSON-encoded tuple rather than a delimiter-joined string: a filename, prop or
// value could contain any separator character, and a control-character
// separator would make the baseline file read as binary to grep and git.
const keyOf = (f) => JSON.stringify([f.file, f.prop, f.value]);

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  return new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).entries);
}

function writeBaseline(findings) {
  const entries = [...new Set(findings.map(keyOf))].sort((a, b) => a.localeCompare(b, 'en'));
  const payload = {
    comment:
      'Known hardcoded user-facing strings, recorded so `--ci` can fail on NEW ones. ' +
      'Shrink this file by converting strings to t() — never grow it to silence a finding.',
    generated: 'node scripts/i18n-audit.mjs --update-baseline',
    count: entries.length,
    entries,
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return entries.length;
}

// ---------------------------------------------------------------- main

function main() {
  const argv = process.argv.slice(2);
  const ci = argv.includes('--ci');
  const update = argv.includes('--update-baseline');
  const quiet = argv.includes('--quiet');
  const jsonAt = argv.indexOf('--json');

  if (!fs.existsSync(SRC)) {
    console.error('i18n-audit: no src/ directory — run from the repo root');
    return 2;
  }

  const findings = [];
  for (const file of walk(SRC, [])) collectFromFile(file, findings);
  findings.sort((a, b) => a.file.localeCompare(b.file, 'en') || a.line - b.line);

  if (jsonAt !== -1 && argv[jsonAt + 1]) {
    fs.writeFileSync(argv[jsonAt + 1], `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
  }

  if (update) {
    const n = writeBaseline(findings);
    console.log(`i18n-audit: baseline updated — ${n} known string(s) in ${BASELINE_PATH}`);
    return 0;
  }

  const baseline = readBaseline();
  const fresh = baseline ? findings.filter((f) => !baseline.has(keyOf(f))) : findings;

  if (!quiet) {
    const files = new Set(findings.map((f) => f.file)).size;
    console.log(`i18n-audit: ${findings.length} hardcoded user-facing string(s) across ${files} file(s)`);
    if (baseline) console.log(`i18n-audit: ${baseline.size} baselined, ${fresh.length} new`);

    for (const f of (fresh.length ? fresh : findings).slice(0, 40)) {
      console.log(`  ${f.file}:${f.line}  ${f.prop}: ${JSON.stringify(f.value)}`);
    }
    const shown = Math.min(40, fresh.length || findings.length);
    const total = fresh.length || findings.length;
    if (total > shown) console.log(`  … and ${total - shown} more`);
  }

  if (ci && fresh.length) {
    console.error(
      `\ni18n-audit: ${fresh.length} NEW hardcoded user-facing string(s). ` +
        `Wrap them in t() and add the key to src/i18n/locales/en.json ` +
        `(the sync workflow carries it to courthive-i18n). ` +
        `Do not run --update-baseline to silence this.`,
    );
    return 1;
  }
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error('i18n-audit:', err?.stack ?? err);
  process.exit(2);
}

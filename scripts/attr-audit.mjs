#!/usr/bin/env node
// attr-audit — deterministic AST attribute dictionary + typo / schema-divergence auditor.
//
// Walks a repo's source, extracts every object attribute / property name via the
// TypeScript AST (not regex), and surfaces:
//   1. TYPO CANDIDATES — a low-frequency name at edit-distance 1 from a much more
//      frequent name. Property-access / object-key / destructure occurrences are
//      the dangerous class (they silently evaluate to `undefined` → dead branch);
//      plain local-variable misspellings are reported separately as cosmetic.
//   2. SCHEMA DIVERGENCE (optional) — when --schema is supplied, attributes that
//      look canonical but are not present in the schema, and canonical names a
//      suspect is near.
//   3. WRITE-ONLY (optional, --write-only) — names set but never read. LOW PRECISION
//      (object spreads / cross-function returns / dynamic dispatch defeat a global
//      read-counter); secondary, read-each-one.
//   4. VALUE TYPOS (optional, needs --schema and/or --constants) — string *values*
//      declared in a string-literal type (`type X = 'ABANDONDED' | …`) or an enum
//      member (`ABANDONED = 'ABANDONDED'`) that are NOT in the canonical value vocab
//      (schema `enum` arrays + `export const X = '…'` values) but sit edit-distance 1
//      from a value that IS. This is a DIFFERENT class from #1: #1 catches misspelled
//      property *names*; #4 catches misspelled enum/status *values* that let a type
//      admit a string nothing produces, or make an enum emit the wrong string. The
//      property-name AST pass is blind to these because they are StringLiteral nodes,
//      not property identifiers (this is why `TournamentStatusUnion = 'ABANDONDED'`
//      survived a full property audit).
//
// This file is the CANONICAL source. It is:
//   - installed into each repo as `scripts/attr-audit.mjs` + a `pnpm attr-audit` script
//     (see Mentat/tools/attr-audit/install.mjs), and
//   - invoked cross-repo by Mentat/tools/attr-audit/run.mjs.
// Zero dependencies beyond the target repo's own `typescript`.
//
// Usage:
//   node attr-audit.mjs [--root DIR] [--src DIR]... [--exclude REGEX]...
//                       [--schema FILE]... [--types DIR]... [--constants DIR]...
//                       [--ignore NAME]... [--min-common N] [--ratio N] [--max-suspect N]
//                       [--write-only] [--json OUTDIR] [--ci] [--quiet]
//
// Config: flags override an optional `attr-audit.config.json` in --root. Shape:
//   { "src": ["src"], "exclude": ["/scratch/"], "schema": ["src/global/schema/x.json"],
//     "types": ["src/types"], "constants": ["src/constants"], "ignore": ["minute","weekday"],
//     "minCommon": 8, "ratio": 5, "maxSuspect": 3, "allow": ["knownName", ...] }
//
// Exit codes: 0 ok. With --ci: 1 if any PROP-class typo candidate is not in the
// allow-list (config.allow or attr-audit.allow.json in --root).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// ---------- arg parsing ----------
function parseArgs(argv) {
  const out = { src: [], exclude: [], schema: [], types: [], constants: [], ignore: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--root') out.root = next();
    else if (a === '--config') out.config = next();
    else if (a === '--src') out.src.push(next());
    else if (a === '--exclude') out.exclude.push(next());
    else if (a === '--schema') out.schema.push(next());
    else if (a === '--types') out.types.push(next());
    else if (a === '--constants') out.constants.push(next());
    else if (a === '--ignore') out.ignore.push(next());
    else if (a === '--min-common') out.minCommon = Number(next());
    else if (a === '--ratio') out.ratio = Number(next());
    else if (a === '--max-suspect') out.maxSuspect = Number(next());
    else if (a === '--json') out.json = next();
    else if (a === '--write-only') out.writeOnly = true;
    else if (a === '--ci') out.ci = true;
    else if (a === '--quiet') out.quiet = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!out.root && !a.startsWith('-')) out.root = a; // positional root
  }
  return out;
}

const HELP = `attr-audit — AST attribute dictionary + typo / schema-divergence auditor
  --root DIR         repo root (default: cwd)
  --config FILE      explicit config JSON (default: <root>/attr-audit.config.json)
  --src DIR          source dir(s) to walk, repeatable (default: src)
  --exclude REGEX    extra path-exclude regex(es), repeatable
  --schema FILE      JSON schema file(s) for canonical vocab, repeatable (optional)
  --types DIR        dir(s) of .ts type defs for canonical vocab, repeatable (optional)
  --constants DIR    dir(s) of const modules → canonical string-VALUE vocab, repeatable (optional)
  --ignore NAME      attribute name(s) / string value(s) to treat as known-legit, repeatable
  --min-common N     min frequency for a name to be a "canonical" comparison target (default 8)
  --ratio N          canonical must be >= N x more frequent than suspect (default 5)
  --max-suspect N    only names with total <= N are typo suspects (default 3)
  --write-only       also emit the (low-precision) write-only pool
  --json OUTDIR      write dictionary + report JSON to OUTDIR
  --ci               exit 1 if a PROP-class candidate is not allow-listed
  --quiet            suppress the console summary`;

// ---------- config resolution ----------
function loadConfig(root, explicitPath) {
  const p = explicitPath ? path.resolve(explicitPath) : path.join(root, 'attr-audit.config.json');
  if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* ignore */ } }
  return {};
}
function loadAllow(root, cfg) {
  const set = new Set(cfg.allow || []);
  const p = path.join(root, 'attr-audit.allow.json');
  if (fs.existsSync(p)) { try { for (const n of JSON.parse(fs.readFileSync(p, 'utf8'))) set.add(n); } catch { /* ignore */ } }
  return set;
}

// ---------- typescript resolution (prefer target repo's copy) ----------
async function loadTypeScript(root) {
  const candidates = [
    path.join(root, 'node_modules', 'typescript'),
    path.join(path.dirname(new URL(import.meta.url).pathname), 'node_modules', 'typescript'),
  ];
  for (const c of candidates) {
    const entry = path.join(c, 'lib', 'typescript.js');
    if (fs.existsSync(entry)) return (await import(pathToFileURL(entry).href)).default;
  }
  // last resort: node resolution from this file
  try {
    const require = createRequire(import.meta.url);
    return require('typescript');
  } catch {
    throw new Error(`Could not resolve "typescript". Install it in ${root} (pnpm install) or run from a repo that has it.`);
  }
}

// ---------- file walk ----------
function walk(dir, excludeRe, acc = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      if (excludeRe.some((re) => re.test(full + '/'))) continue;
      walk(full, excludeRe, acc);
    } else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(e.name)) {
      if (/\.d\.ts$/.test(e.name)) continue;
      if (excludeRe.some((re) => re.test(full))) continue;
      acc.push(full);
    }
  }
  return acc;
}

// ---------- schema / type vocab ----------
function collectSchemaProps(files, root) {
  const props = new Set();
  for (const rel of files) {
    const p = path.isAbsolute(rel) ? rel : path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    let json;
    try { json = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    const recurse = (o) => {
      if (!o || typeof o !== 'object') return;
      if (o.properties && typeof o.properties === 'object' && !Array.isArray(o.properties)) {
        for (const k of Object.keys(o.properties)) props.add(k);
      }
      for (const v of Object.values(o)) recurse(v);
    };
    recurse(json);
  }
  return props;
}
// Canonical string VALUES from JSON schema: every string member of an `enum`
// array and any `const` string keyword. These are the authoritative allowable
// values a status/type field may hold.
function collectSchemaEnumValues(files, root) {
  const values = new Set();
  for (const rel of files) {
    const p = path.isAbsolute(rel) ? rel : path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    let json;
    try { json = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    const recurse = (o) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o.enum)) for (const v of o.enum) if (typeof v === 'string') values.add(v);
      if (typeof o.const === 'string') values.add(o.const);
      for (const v of Object.values(o)) recurse(v);
    };
    recurse(json);
  }
  return values;
}

// Canonical string VALUES from constants modules: the RHS of `const X = '…'`
// declarations and string values in exported object literals / enum members.
// These plus the schema enum values form the value vocab that literal-type and
// enum-member string values are checked against.
function collectConstantValues(ts, dirs, root, excludeRe) {
  const values = new Set();
  for (const d of dirs) {
    const abs = path.isAbsolute(d) ? d : path.join(root, d);
    if (!fs.existsSync(abs)) continue;
    const files = fs.statSync(abs).isDirectory() ? walk(abs, excludeRe) : [abs];
    for (const f of files) {
      if (!/\.tsx?$/.test(f)) continue;
      const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (n) => {
        if (ts.isVariableDeclaration(n) && n.initializer && ts.isStringLiteral(n.initializer)) values.add(n.initializer.text);
        else if (ts.isPropertyAssignment(n) && n.initializer && ts.isStringLiteral(n.initializer)) values.add(n.initializer.text);
        else if (ts.isEnumMember(n) && n.initializer && ts.isStringLiteral(n.initializer)) values.add(n.initializer.text);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }
  return values;
}

function collectTypeProps(ts, dirs, root, excludeRe) {
  const props = new Set();
  for (const d of dirs) {
    const abs = path.isAbsolute(d) ? d : path.join(root, d);
    if (!fs.existsSync(abs)) continue;
    const files = fs.statSync(abs).isDirectory() ? walk(abs, excludeRe) : [abs];
    for (const f of files) {
      if (!/\.tsx?$/.test(f)) continue;
      const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (n) => {
        if ((ts.isPropertySignature(n) || ts.isPropertyDeclaration(n)) && n.name && ts.isIdentifier(n.name)) props.add(n.name.text);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }
  return props;
}

// ---------- extraction ----------
function extract(ts, files, root) {
  const usage = new Map();     // name -> {total,writes,reads}
  const funcValued = new Set();
  const occ = new Map();       // name -> [{file,line,kind}]
  const bump = (name, isWrite) => {
    let e = usage.get(name);
    if (!e) { e = { total: 0, writes: 0, reads: 0 }; usage.set(name, e); }
    e.total++; if (isWrite) e.writes++; else e.reads++;
  };
  const addOcc = (name, file, node, sf, kind) => {
    if (!occ.has(name)) occ.set(name, []);
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    occ.get(name).push({ file, line: line + 1, kind });
  };
  for (const file of files) {
    const rel = path.relative(root, file);
    let sf;
    try { sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true); } catch { continue; }
    const visit = (node) => {
      if (ts.isPropertyAssignment(node) && node.name && ts.isIdentifier(node.name)) {
        const n = node.name.text; bump(n, true); addOcc(n, rel, node.name, sf, 'objectKey');
        const init = node.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) funcValued.add(n);
      } else if (ts.isShorthandPropertyAssignment(node) && node.name) {
        bump(node.name.text, true); addOcc(node.name.text, rel, node.name, sf, 'shorthandKey');
      } else if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        funcValued.add(node.name.text);
      } else if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
        const p = node.parent;
        const isWrite = p && ts.isBinaryExpression(p) && p.left === node && p.operatorToken.kind === ts.SyntaxKind.EqualsToken;
        bump(node.name.text, isWrite); addOcc(node.name.text, rel, node.name, sf, isWrite ? 'propAssign' : 'propRead');
      } else if (ts.isBindingElement(node)) {
        const pn = node.propertyName && ts.isIdentifier(node.propertyName) ? node.propertyName
          : (node.name && ts.isIdentifier(node.name) ? node.name : null);
        if (pn) { bump(pn.text, false); addOcc(pn.text, rel, pn, sf, 'destructure'); }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { usage, funcValued, occ };
}

// Collect string *values* declared in a type-level literal (`'FOO'` inside a
// LiteralTypeNode, i.e. union members / discriminants) or an enum member. These
// are the suspects for the value-typo pass — a StringLiteral node the property
// audit never sees.
function extractLiteralValues(ts, files, root) {
  const occ = new Map(); // value -> [{file,line,ctx}]
  const add = (value, file, node, sf, ctx) => {
    if (!occ.has(value)) occ.set(value, []);
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    occ.get(value).push({ file, line: line + 1, ctx });
  };
  for (const file of files) {
    const rel = path.relative(root, file);
    let sf;
    try { sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true); } catch { continue; }
    const visit = (node) => {
      if (ts.isLiteralTypeNode(node) && node.literal && ts.isStringLiteral(node.literal)) {
        add(node.literal.text, rel, node.literal, sf, 'literalType');
      } else if (ts.isEnumMember(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        add(node.initializer.text, rel, node.initializer, sf, 'enumMember');
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return occ;
}

// ---------- Damerau-Levenshtein (capped) ----------
function dl(a, b) {
  const al = a.length, bl = b.length;
  if (Math.abs(al - bl) > 2) return 3;
  const d = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) for (let j = 1; j <= bl; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[al][bl];
}

const PROP_KINDS = new Set(['propRead', 'propAssign', 'objectKey', 'shorthandKey', 'destructure']);
const DANGEROUS_KINDS = new Set(['propRead', 'propAssign', 'objectKey']);

function detectTypos(usage, occ, opts, schemaProps, ignore) {
  const attrs = [...usage.entries()].map(([name, e]) => ({ name, ...e }));
  const common = attrs.filter((a) => a.total >= opts.minCommon && a.name.length >= 5).map((a) => a.name);
  const commonSet = new Set(common);
  const candidates = [];
  for (const a of attrs) {
    if (a.total > opts.maxSuspect || a.name.length < 5) continue;
    if (ignore.has(a.name)) continue;
    if (commonSet.has(a.name)) continue;
    let best = null;
    for (const c of common) {
      if (c === a.name) { best = null; break; }
      if (dl(a.name, c) === 1) {
        const ce = usage.get(c);
        if (ce && ce.total >= a.total * opts.ratio && (!best || ce.total > best.total)) best = { name: c, total: ce.total };
      }
    }
    if (!best) continue;
    const kinds = (occ.get(a.name) || []).map((o) => o.kind);
    const isProp = kinds.some((k) => DANGEROUS_KINDS.has(k)) ||
      (kinds.every((k) => k === 'destructure') && false); // destructure-only counted as var below
    const dangerous = kinds.some((k) => DANGEROUS_KINDS.has(k));
    const primary = (occ.get(a.name) || []).find((o) => DANGEROUS_KINDS.has(o.kind)) || (occ.get(a.name) || [])[0] || {};
    candidates.push({
      suspect: a.name, total: a.total, writes: a.writes, reads: a.reads,
      canonical: best.name, canonicalTotal: best.total,
      dangerous, klass: dangerous ? 'PROP' : 'var',
      canonicalInSchema: schemaProps ? schemaProps.has(best.name) : null,
      suspectInSchema: schemaProps ? schemaProps.has(a.name) : null,
      at: `${primary.file}:${primary.line}`, kind: primary.kind,
    });
  }
  candidates.sort((x, y) => (x.dangerous === y.dangerous ? 0 : x.dangerous ? -1 : 1) || x.total - y.total || y.canonicalTotal - x.canonicalTotal);
  return candidates;
}

function detectWriteOnly(usage, funcValued, occ, ignore) {
  const out = [];
  for (const [name, e] of usage) {
    if (e.reads !== 0 || e.writes < 1 || name.length < 4) continue;
    if (funcValued.has(name) || ignore.has(name)) continue;
    const primary = (occ.get(name) || [])[0] || {};
    out.push({ name, writes: e.writes, at: `${primary.file}:${primary.line}`, kind: primary.kind });
  }
  out.sort((a, b) => a.writes - b.writes || a.name.localeCompare(b.name));
  return out;
}

// Value-typo detection. A suspect string value declared in a literal type / enum
// member that is NOT in the canonical value vocab but is edit-distance 1 from a
// value that IS. The canonical vocab (schema enums + const values) is treated as
// authoritative, so — unlike property typos — no frequency ratio is required: a
// near-miss of a canonical value is high-confidence regardless of how often it
// appears (a typo'd union member often appears exactly once).
function detectValueTypos(valueOcc, canonicalValues, ignore, allow) {
  if (!canonicalValues || !canonicalValues.size) return [];
  const canon = [...canonicalValues].filter((v) => v.length >= 4);
  const out = [];
  for (const [value, occs] of valueOcc) {
    if (value.length < 4) continue;
    if (canonicalValues.has(value)) continue; // declared value matches the vocab — fine
    if (ignore.has(value) || allow.has(value)) continue;
    let best = null;
    for (const c of canon) {
      if (c === value) { best = null; break; }
      if (dl(value, c) === 1 && (!best || c < best)) best = c;
    }
    if (!best) continue;
    const primary = occs[0] || {};
    out.push({
      suspect: value, canonical: best, count: occs.length,
      ctx: [...new Set(occs.map((o) => o.ctx))].join(','),
      at: `${primary.file}:${primary.line}`,
      occurrences: occs.map((o) => `${o.file}:${o.line}`),
    });
  }
  out.sort((a, b) => a.suspect.localeCompare(b.suspect));
  return out;
}

// ---------- main ----------
async function main() {
  const cli = parseArgs(process.argv.slice(2));
  if (cli.help) { console.log(HELP); return 0; }
  const root = path.resolve(cli.root || process.cwd());
  const cfg = loadConfig(root, cli.config);
  const opts = {
    src: (cli.src.length ? cli.src : cfg.src) || ['src'],
    exclude: [...(cfg.exclude || []), ...cli.exclude],
    schema: cli.schema.length ? cli.schema : (cfg.schema || []),
    types: cli.types.length ? cli.types : (cfg.types || []),
    constants: cli.constants.length ? cli.constants : (cfg.constants || []),
    ignore: new Set([...(cfg.ignore || []), ...cli.ignore]),
    minCommon: cli.minCommon ?? cfg.minCommon ?? 8,
    ratio: cli.ratio ?? cfg.ratio ?? 5,
    maxSuspect: cli.maxSuspect ?? cfg.maxSuspect ?? 3,
    writeOnly: cli.writeOnly ?? false,
    json: cli.json,
    ci: cli.ci ?? false,
    quiet: cli.quiet ?? false,
  };
  const allow = loadAllow(root, cfg);

  const DEFAULT_EXCLUDES = ['/tests/', '\\.test\\.', '\\.spec\\.', '/node_modules/', '/dist/', '/build/', '/coverage/'];
  const excludeRe = [...DEFAULT_EXCLUDES, ...opts.exclude].map((s) => new RegExp(s));

  const ts = await loadTypeScript(root);

  const files = [];
  for (const s of opts.src) {
    const abs = path.isAbsolute(s) ? s : path.join(root, s);
    walk(abs, excludeRe, files);
  }
  if (!files.length) { console.error(`attr-audit: no source files under ${opts.src.join(', ')} in ${root}`); return 2; }

  const schemaProps = opts.schema.length ? collectSchemaProps(opts.schema, root) : null;
  const typeProps = opts.types.length ? collectTypeProps(ts, opts.types, root, excludeRe) : null;
  const canonical = schemaProps || typeProps
    ? new Set([...(schemaProps || []), ...(typeProps || [])])
    : null;

  const { usage, funcValued, occ } = extract(ts, files, root);
  const typos = detectTypos(usage, occ, opts, canonical, opts.ignore);
  const writeOnly = opts.writeOnly ? detectWriteOnly(usage, funcValued, occ, opts.ignore) : [];

  // Value-typo pass: canonical string values = schema enums + const-module values.
  const schemaValues = opts.schema.length ? collectSchemaEnumValues(opts.schema, root) : null;
  const constantValues = opts.constants.length ? collectConstantValues(ts, opts.constants, root, excludeRe) : null;
  const canonicalValues = schemaValues || constantValues
    ? new Set([...(schemaValues || []), ...(constantValues || [])])
    : null;
  const valueOcc = extractLiteralValues(ts, files, root);
  const valueTypos = detectValueTypos(valueOcc, canonicalValues, opts.ignore, allow);

  const dictionary = [...usage.entries()]
    .map(([name, e]) => ({ name, ...e, inSchema: canonical ? canonical.has(name) : null }))
    .sort((a, b) => b.total - a.total);

  if (opts.json) {
    fs.mkdirSync(opts.json, { recursive: true });
    fs.writeFileSync(path.join(opts.json, 'attr-dictionary.json'), JSON.stringify(dictionary, null, 2));
    fs.writeFileSync(path.join(opts.json, 'attr-report.json'), JSON.stringify({
      root, files: files.length, distinctAttributes: usage.size,
      schemaProps: schemaProps ? schemaProps.size : 0, typeProps: typeProps ? typeProps.size : 0,
      canonicalValues: canonicalValues ? canonicalValues.size : 0,
      typoCandidates: typos, valueTypoCandidates: valueTypos, writeOnly,
    }, null, 2));
  }

  const propCandidates = typos.filter((t) => t.dangerous);
  const varCandidates = typos.filter((t) => !t.dangerous);
  const unallowedProp = propCandidates.filter((t) => !allow.has(t.suspect));
  const unallowedValue = valueTypos.filter((t) => !allow.has(t.suspect));

  if (!opts.quiet) {
    console.log(`\nattr-audit  ${path.basename(root)}`);
    console.log(`  files: ${files.length}  |  distinct attributes: ${usage.size}` +
      (canonical ? `  |  canonical vocab: ${canonical.size}` : ''));
    console.log(`  typo candidates: ${typos.length}  (PROP/dangerous: ${propCandidates.length}, var/cosmetic: ${varCandidates.length})`);
    if (canonicalValues) console.log(`  value vocab: ${canonicalValues.size}  |  VALUE typo candidates: ${valueTypos.length}`);
    if (opts.writeOnly) console.log(`  write-only (low precision): ${writeOnly.length}`);
    console.log(`\n  === PROP-class typo candidates (dead-branch / divergence risk) ===`);
    if (!propCandidates.length) console.log('    (none)');
    for (const t of propCandidates) {
      const flag = allow.has(t.suspect) ? ' [allow]' : '';
      const sch = t.canonicalInSchema ? ' {canon∈schema}' : '';
      console.log(`    ${t.suspect} (x${t.total} w${t.writes}/r${t.reads}) ~ ${t.canonical} (x${t.canonicalTotal})${sch}  @ ${t.at} ${t.kind || ''}${flag}`);
    }
    if (canonicalValues) {
      console.log(`\n  === ENUM / LITERAL-VALUE typo candidates (type admits a value nothing produces) ===`);
      if (!valueTypos.length) console.log('    (none)');
      for (const t of valueTypos) {
        const flag = allow.has(t.suspect) ? ' [allow]' : '';
        console.log(`    '${t.suspect}' ~ '${t.canonical}'  (${t.ctx}, x${t.count})  @ ${t.at}${flag}`);
      }
    }
    if (varCandidates.length) {
      console.log(`\n  === var/cosmetic candidates (local-variable misspellings) ===`);
      for (const t of varCandidates.slice(0, 40)) {
        console.log(`    ${t.suspect} (x${t.total}) ~ ${t.canonical} (x${t.canonicalTotal})  @ ${t.at}`);
      }
      if (varCandidates.length > 40) console.log(`    … ${varCandidates.length - 40} more`);
    }
    if (opts.json) console.log(`\n  JSON written to ${opts.json}/`);
  }

  if (opts.ci && (unallowedProp.length || unallowedValue.length)) {
    if (unallowedProp.length) {
      console.error(`\nattr-audit: ${unallowedProp.length} PROP-class typo candidate(s) not in allow-list:`);
      for (const t of unallowedProp) console.error(`  - ${t.suspect} ~ ${t.canonical}  @ ${t.at}`);
    }
    if (unallowedValue.length) {
      console.error(`\nattr-audit: ${unallowedValue.length} ENUM/LITERAL-VALUE typo candidate(s) not in allow-list:`);
      for (const t of unallowedValue) console.error(`  - '${t.suspect}' ~ '${t.canonical}'  @ ${t.at}`);
    }
    console.error(`\nAdd intentional names/values to attr-audit.allow.json (or config.allow) to accept them.`);
    return 1;
  }
  return 0;
}

main().then((code) => process.exit(code)).catch((err) => { console.error('attr-audit:', err.message); process.exit(2); });

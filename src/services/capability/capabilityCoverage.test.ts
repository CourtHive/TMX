import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { UI_ENFORCED, MUTATION_ENFORCED, coverageFor, unenforcedPermissionKeys } from './capabilityCoverage';
import { BOOLEAN_PERMISSION_KEYS } from '@courthive/provider-config';

const SRC = resolve(__dirname, '../..');

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) acc.push(full);
  }
  return acc;
}

/** Every key passed to a literal `providerConfig.isAllowed('<key>')` in src/. */
function scanUiGatedKeys(files: string[]): Set<string> {
  const found = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/isAllowed\(\s*'([a-zA-Z]+)'/g)) found.add(match[1]);
    // The ternary form: isAllowed(cond ? 'a' : 'b')
    for (const match of text.matchAll(/isAllowed\([^)]*\?\s*'([a-zA-Z]+)'\s*:\s*'([a-zA-Z]+)'/g)) {
      found.add(match[1]);
      found.add(match[2]);
    }
  }
  return found;
}

describe('capability coverage', () => {
  const files = sourceFiles(SRC);
  // Exclude the doc-comment example in providerConfig.ts, which is prose, not a gate.
  const scanned = scanUiGatedKeys(files.filter((f) => !f.endsWith('config/providerConfig.ts')));

  // ── Controls: a broken scanner must not be able to agree by vacuous truth ──

  it('the scanner reads a substantial source tree', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('the scanner actually finds gates', () => {
    expect(scanned.size).toBeGreaterThanOrEqual(12);
  });

  it('the scanner detects a gate it is shown (falsification control)', () => {
    const planted = `if (providerConfig.isAllowed('canPublish')) doThing();`;
    const hits = new Set<string>();
    for (const m of planted.matchAll(/isAllowed\(\s*'([a-zA-Z]+)'/g)) hits.add(m[1]);
    expect(hits.has('canPublish')).toBe(true);
  });

  // ── The pin itself ──

  it('UI_ENFORCED matches the gates actually present in src/', () => {
    expect([...scanned].sort()).toEqual([...UI_ENFORCED].sort());
  });

  it('every UI_ENFORCED key is a real permission key', () => {
    const valid = new Set<string>(BOOLEAN_PERMISSION_KEYS);
    expect([...UI_ENFORCED].filter((k) => !valid.has(k))).toEqual([]);
  });

  // ── Classification ──

  it('classifies each key by where it is enforced', () => {
    expect(coverageFor('canCreateEvents')).toBe('both'); // UI gate + mutation map
    expect(coverageFor('canUseBulkScheduling')).toBe('ui'); // toggle only; bulkScheduleMatchUps maps elsewhere
    expect(coverageFor('canModifyTournamentDetails')).toBe('mutation'); // no UI gate
  });

  it('reports keys that gate nothing, rather than implying they work', () => {
    const unenforced = unenforcedPermissionKeys();
    // canAccessProviderAdmin is declared, defaulted, and consulted by nothing —
    // TMX gates its admin entry points on isActiveProviderAdmin() instead.
    expect(unenforced).toContain('canAccessProviderAdmin');
    // Documented so a future change that starts enforcing one is a visible diff.
    expect(unenforced.sort()).toMatchInlineSnapshot(`
      [
        "canAccessProviderAdmin",
        "canModifyCompletedScores",
      ]
    `);
  });

  it('MUTATION_ENFORCED is derived, not hand-maintained', () => {
    expect(MUTATION_ENFORCED.size).toBeGreaterThan(10);
    expect(MUTATION_ENFORCED.has('canEnterScores')).toBe(true);
  });
});

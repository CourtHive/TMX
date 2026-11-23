import { readdirSync, readFileSync } from 'node:fs';
import tsparser from '@typescript-eslint/parser';
import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import plugin from './network-boundaries.mjs';

const lint = (code, filename = 'src/services/newService.js') =>
  new Linter().verify(
    code,
    [
      {
        files: ['**/*.{js,ts}'],
        plugins: { network: plugin },
        rules: { 'network/approved-primitives': 'error' },
      },
    ],
    { filename },
  );

describe('approved network boundary', () => {
  it.each([
    "fetch('/factory')",
    "window.fetch('/factory')",
    "globalThis['fetch']('/factory')",
    'const send = globalThis.fetch',
    "const target = window; target.fetch('/factory')",
    "await import('axios')",
    "await import('socket.io-client')",
    'const { fetch: send } = window',
    "new WebSocket('ws://server')",
    "new window.WebSocket('ws://server')",
    'new XMLHttpRequest()',
    "new EventSource('/events')",
    "navigator.sendBeacon('/factory', '{}')",
    "import axios from 'axios'",
    "import axios from 'axios/index.js'",
    "import { io as connect } from 'socket.io-client'",
  ])('rejects a new bypass: %s', (code) => {
    expect(lint(code).length).toBeGreaterThan(0);
  });

  it('permits the approved server boundary and ordinary guarded calls', () => {
    expect(lint("import axios from 'axios'; fetch('/factory')", 'src/services/network/serverNetwork.ts')).toEqual([]);
    expect(lint("import { serverFetch } from './serverNetwork'; serverFetch('/factory')")).toEqual([]);
  });

  it('limits the existing static asset exceptions to fetch', () => {
    const font = 'src/services/pdf/pdfFont.ts';
    expect(lint("fetch('/fonts/catalog.json')", font)).toEqual([]);
    expect(lint("new WebSocket('ws://server')", font)).toHaveLength(1);
  });
});

// The main lint config skips legacy/charts for unrelated rules. Those directories must never exempt network safety.
function productionFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return productionFiles(path);
    return entry.isFile() && path.endsWith('.ts') && !/\.(test|d)\.ts$/.test(path) ? [path] : [];
  });
}

const source = productionFiles('src').toSorted((a, b) => a.localeCompare(b, 'en'));
const batchSize = 50;
const batches = Array.from({ length: Math.ceil(source.length / batchSize) }, (_, index) => ({
  batch: index + 1,
  paths: source.slice(index * batchSize, (index + 1) * batchSize),
}));

describe('production network boundary inventory', () => {
  it('includes production files even in directories excluded from ordinary lint', () => {
    expect(source.length).toBeGreaterThan(100);
    expect(source.some((path) => path.includes('/legacy/') || path.includes('/charts/'))).toBe(true);
  });

  // Bound each test's synchronous AST work instead of raising its timeout on slower CI runners.
  it.each(batches)('checks every production TypeScript file in batch $batch', ({ paths }) => {
    const linter = new Linter({ configType: 'flat' });
    const violations = paths.flatMap((filename) =>
      linter
        .verify(
          readFileSync(filename, 'utf8'),
          [
            {
              files: ['**/*.ts'],
              languageOptions: { parser: tsparser, parserOptions: { project: false } },
              plugins: { network: plugin },
              rules: { 'network/approved-primitives': 'error' },
            },
          ],
          { filename, allowInlineConfig: false },
        )
        .map((finding) => ({ filename, ...finding })),
    );
    expect(violations).toEqual([]);
  });
});

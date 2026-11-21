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
it('applies the network rule to every production TypeScript file, including otherwise ignored directories', () => {
  function files(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return files(path);
      return entry.isFile() && path.endsWith('.ts') && !/\.(test|d)\.ts$/.test(path) ? [path] : [];
    });
  }
  const source = files('src');
  expect(source.length).toBeGreaterThan(100);
  const linter = new Linter({ configType: 'flat' });
  const violations = source.flatMap((filename) =>
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

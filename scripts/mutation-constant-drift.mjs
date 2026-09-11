#!/usr/bin/env node
/**
 * Every mutation constant must name a real factory engine method.
 *
 * WHY THIS EXISTS
 *
 * `RESET_MATCHUP_LINEUPS` was `'resetMatchUpLinesUps'` — "LinesUps". The factory method is
 * `resetMatchUpLineUps`. Two live UI actions dispatched it: the scorecard overlay's lineup reset and
 * the draw action menu's. The async engine answers an unknown method name with
 * `{ error: METHOD_NOT_FOUND }`, so the feature had never worked, and nothing anywhere said so.
 *
 * Nothing could have caught it. The constant is a string, so TypeScript is satisfied; the method name
 * only fails at the far side of a socket, inside the server's engine. `mutationConstants.ts` is
 * documented as mapping 1:1 to factory engine methods, and that mapping had drifted with no gate.
 *
 * The check reads the ENGINE ITSELF from the installed package rather than a generated list, so it
 * measures what the server will actually find. It therefore works the same whether the factory is
 * resolved through the `link:` override or from npm.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CONSTANTS = path.join(ROOT, 'src', 'constants', 'mutationConstants.ts');

const { tournamentEngine } = require('tods-competition-factory');
const available = new Set(Object.keys(tournamentEngine));

const source = fs.readFileSync(CONSTANTS, 'utf8');
const declared = [...source.matchAll(/export const (\w+) = '([^']+)';/g)].map(([, name, value]) => ({ name, value }));

if (!declared.length) {
  console.error('[mutation-drift] parsed no constants — the file shape changed, and this check would pass vacuously');
  process.exit(2);
}

const missing = declared.filter(({ value }) => !available.has(value));

console.log(`[mutation-drift] ${declared.length} constants checked against ${available.size} engine methods`);

if (missing.length) {
  console.error(`\n[mutation-drift] ${missing.length} constant(s) name no engine method:\n`);
  for (const { name, value } of missing) console.error(`  ${name}  ->  '${value}'`);
  console.error(
    '\nThe engine answers an unknown name with METHOD_NOT_FOUND, so any UI dispatching one of these\n' +
      'silently does nothing. Check for a typo first; otherwise the method may have been renamed or\n' +
      'removed in the factory, or may never have been registered through a governor.',
  );
  process.exit(1);
}

console.log('[mutation-drift] OK — every mutation constant resolves to an engine method');

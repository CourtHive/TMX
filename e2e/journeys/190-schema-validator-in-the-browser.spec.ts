import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect } from '@playwright/test';

/**
 * Journey 190 — the CODES schema check runs in the browser, and evaluates nothing.
 *
 * The validator is compiled at build time (`precompiledSchemaValidator`, vite.shared.ts) so the browser never compiles
 * one with `new Function`, which the CSP forbids. Unit tests run it under Node, where a CommonJS helper arrives through
 * a different interop than the browser's: on 2026-11-04 the validator passed every unit test and threw in the browser,
 * and journey 164 stayed green only because the failed load reported "unavailable" instead of compiling anything.
 * So this journey asserts the check actually ran: the schema is available, a valid record has no schema errors, and a
 * broken one reports its errors by path, with no CSP violation along the way.
 */
test('dev.validate finds schema errors with the precompiled validator, under the CSP', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (globalThis as any).__cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (event: SecurityPolicyViolationEvent) => {
      seen.push(`${event.effectiveDirective} at ${event.sourceFile}:${event.lineNumber}`);
    });
  });
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);

  const result = await page.evaluate(async () => {
    const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
      drawProfiles: [{ drawSize: 8 }],
      nonRandom: 1,
    });
    await dev.load(tournamentRecord);
    const valid = await (dev as any).validate();

    const broken = structuredClone(tournamentRecord);
    broken.indoorOutdoor = 'SIDEWAYS';
    broken.events[0].eventType = 'NOT_AN_EVENT_TYPE';
    await dev.load(broken);
    const invalid = await (dev as any).validate();

    return {
      valid: { schemaUnavailable: valid.schemaUnavailable, schemaErrorCount: valid.schemaErrorCount },
      invalid: {
        schemaUnavailable: invalid.schemaUnavailable,
        paths: invalid.findings.filter((f: any) => f.source === 'schema').map((f: any) => f.path),
      },
    };
  });

  expect(result.valid).toEqual({ schemaUnavailable: undefined, schemaErrorCount: 0 });
  expect(result.invalid.schemaUnavailable).toBeUndefined();
  expect(result.invalid.paths).toEqual(expect.arrayContaining(['/indoorOutdoor', '/events/0/eventType']));
  expect(await page.evaluate(() => (globalThis as any).__cspViolations)).toEqual([]);
});

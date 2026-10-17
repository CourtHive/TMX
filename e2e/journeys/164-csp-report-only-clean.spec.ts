import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 164 — TMX runs clean under its Content Security Policy.
 *
 * The web CSP ships report-only first (csp.policy.mjs, CA 2026-10-17): the browser blocks nothing and
 * reports what it would have blocked. Enforcing it later is only safe if TMX itself triggers no report,
 * so this journey runs the app under the same policy (the dev server sends it) and fails on any
 * violation: an inline script, an eval, a handler attribute, a fetch to an origin the policy omits.
 *
 * Violations are collected from the first script on via `securitypolicyviolation`, which fires for
 * report-only policies too.
 */

async function collectViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (globalThis as any).__cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (event: SecurityPolicyViolationEvent) => {
      seen.push(
        `${event.effectiveDirective} blocked ${event.blockedURI || '(inline)'} at ${event.sourceFile}:${event.lineNumber}`,
      );
    });
  });
}

const violations = (page: Page): Promise<string[]> => page.evaluate(() => (globalThis as any).__cspViolations ?? []);

test.describe('Journey 164 — CSP report-only', () => {
  test('the dev server sends the report-only policy', async ({ request }) => {
    const response = await request.get('/');
    const policy = response.headers()['content-security-policy-report-only'];
    expect(policy, 'the policy header is present').toBeTruthy();
    expect(policy).toContain("script-src 'self'");
    expect(policy).not.toContain('unsafe-eval');
  });

  test('no view TMX renders triggers a violation', async ({ page }) => {
    await collectViolations(page);
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);

    const ids = await page.evaluate(async () => {
      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        participantsProfile: { scaledParticipantsCount: 16 },
        drawProfiles: [{ drawSize: 8 }, { drawSize: 4, eventType: 'DOUBLES' }],
        venueProfiles: [{ courtsCount: 2 }],
        completeAllMatchUps: false,
        setState: true,
      });
      await dev.load(tournamentRecord);
      const event = tournamentRecord.events[0];
      const draw = event.drawDefinitions[0];
      return {
        t: tournamentRecord.tournamentId,
        e: event.eventId,
        d: draw.drawId,
        v: tournamentRecord.venues[0].venueId,
      };
    });

    const routes = [
      '#/tournaments',
      `#/tournament/${ids.t}`,
      `#/tournament/${ids.t}/participants/individuals`,
      `#/tournament/${ids.t}/events`,
      `#/tournament/${ids.t}/event/${ids.e}/draw/${ids.d}`,
      `#/tournament/${ids.t}/matchUps`,
      `#/tournament/${ids.t}/schedule2`,
      `#/tournament/${ids.t}/venues`,
      `#/tournament/${ids.t}/venue/${ids.v}`,
      `#/tournament/${ids.t}/publishing`,
      `#/tournament/${ids.t}/reports/structure.drawReport`,
    ];
    for (const hash of routes) {
      await page.evaluate((h) => {
        globalThis.location.hash = h.slice(1);
      }, hash);
      await page.waitForTimeout(1200);
    }

    expect(await violations(page), 'CSP violations (directive blocked uri at source)').toEqual([]);
  });
});

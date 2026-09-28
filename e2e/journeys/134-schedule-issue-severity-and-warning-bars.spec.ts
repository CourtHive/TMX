import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';
import { TournamentPage } from '../pages/TournamentPage';
import { todayLocal } from '../helpers/dates';

/**
 * Journey 134 — the Issues badge tells the truth, and warning bars are optional.
 *
 * Raised by CA from a live tournament: *"has the scary red (16) even when all 16 are
 * just warnings"*, and *"the pro scheduling warnings are just adjacency (errors are when
 * there are out of order timings or rounds). So, it would be nice to have the visual
 * warnings in the grid be optional."*
 *
 * Both halves are DOM. `scheduleIssueSeverity.test.ts` pins the rules — which severity a
 * raw `proConflicts` string means, what a whole set reads as, which issues keep their
 * decoration — and nothing in a node-environment unit test can say what colour reached
 * the operator or whether a bar disappeared. That is this file's whole job.
 *
 * ── What makes it a falsifier rather than a restatement ──
 *
 * Every assertion here has a partner running the other way, because each half has a
 * one-line implementation that would satisfy a one-sided test:
 *
 *   - the badge: a WARN-only schedule must NOT read as an error **and** a schedule with
 *     one error must. Asserting only the first passes if the badge is always calm;
 *     asserting only the second passes against the bug itself, which was always red.
 *   - the bars: a warning cell must lose its decoration when the toggle is off **and**
 *     an error cell must keep it, **and** the popover must still list the warning.
 *     Withholding everything, or withholding nothing, each satisfies one of those three.
 *
 * The seeds assert their own premise before returning. A tournament whose conflicts came
 * out a different severity than intended would make every assertion below vacuous while
 * looking green, which is the degenerate-fixture trap.
 */

const DATE = todayLocal();

const ISSUES_BUTTON = 'button:has(i.fa-triangle-exclamation)';
const ISSUES_BADGE = `${ISSUES_BUTTON} [data-issue-severity]`;
/** A clickable row in the Issues popover. See Journey 132 on why not `.tippy-content`. */
const ISSUE_ROW = '[data-issue-match-up-id]';
const WARNING_BARS_TOGGLE = '[data-warning-bars-toggle]';

/**
 * Decorated cells ON THE COURT GRID. `.spl-grid-cell` alone also matches the active
 * strip's duplicate copy of every incomplete matchUp (Journey 132), so the
 * `[data-court-order]` wrapper — which only the grid draws — is what scopes this.
 *
 * Counted rather than addressed by matchUpId, deliberately. `proConflicts` annotates an
 * adjacency warning onto the LATER of the two rows only: it computes each row's
 * participant warnings against the previous row while iterating, so row 1 has already
 * been annotated by the time row 2's overlap is known. Naming a matchUp would encode
 * that asymmetry into the test and break on a factory fix that is none of this change's
 * business. A count still falsifies — "exactly one before, zero after, one again" cannot
 * be satisfied by withholding everything or by withholding nothing.
 */
const warningBars = '[data-court-order] .spl-grid-cell.spl-cell--warning';
const errorBars = '[data-court-order] .spl-grid-cell.spl-cell--conflict';

interface Seed {
  tournamentId: string;
  matchUpIds: [string, string];
  severities: string[];
}

/**
 * One individual entered in two events, with a matchUp from each scheduled at a given
 * `courtOrder` on two DIFFERENT courts.
 *
 * `courtOrder` is the whole experiment. `proConflicts` groups matchUps into rows by
 * courtOrder, so:
 *
 *   - **same** row (1, 1) — the shared player is in two places at once, which is a hard
 *     `CONFLICT`, i.e. an ERROR. This is Journey 132's seed shape.
 *   - **adjacent** rows (1, 2) — the shared player is asked to play back to back, which
 *     is a `WARNING`. This is the adjacency CA describes: the *expected* state for an
 *     operator who deliberately packs the grid, and the reason the bars want a switch.
 *
 * The seed re-reads the engine and returns the severities it actually produced, so the
 * caller can refuse to run against a fixture that is not the one it meant to build.
 */
async function seedSharedPlayer(page: Page, orders: [number, number], tournamentId: string): Promise<Seed> {
  return page.evaluate(
    async ({ date, orders, tournamentId }) => {
      try {
        await dev.tmx2db.initDB();
        const te = dev.factory.tournamentEngine;
        const ce = dev.factory.competitionEngine;

        dev.factory.mocksEngine.generateTournamentRecord({
          setState: true,
          nonRandom: 1,
          tournamentName: 'E2E Issue Severity',
          tournamentAttributes: { tournamentId, startDate: date, endDate: date },
          participantsProfile: { scaledParticipantsCount: 16 },
          drawProfiles: [{ eventName: 'SEV Singles A', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
          venueProfiles: [{ courtsCount: 4, venueName: 'SEV Venue' }],
        });

        const courts = te.getVenuesAndCourts().venues[0].courts;

        const aMatch = (ce.allTournamentMatchUps({}).matchUps || []).find(
          (m: any) => m.matchUpStatus !== 'BYE' && (m.sides || []).filter((s: any) => s.participantId).length === 2,
        );
        if (!aMatch) throw new Error('seed produced no fully-populated R1 matchUp');
        const pShared = aMatch.sides[0].participantId;
        const pOpp = aMatch.sides[1].participantId;

        const individuals = te.getParticipants({
          participantFilters: { participantTypes: ['INDIVIDUAL'] },
        }).participants;
        const pOther = individuals.find(
          (p: any) => p.participantId !== pShared && p.participantId !== pOpp,
        )?.participantId;
        if (!pOther) throw new Error('seed produced no third individual');

        const { event } = te.addEvent({ event: { eventName: 'SEV Singles B', eventType: 'SINGLES' } });
        te.addEventEntries({ eventId: event.eventId, participantIds: [pShared, pOther] });
        const { drawDefinition } = te.generateDrawDefinition({ eventId: event.eventId, drawSize: 2, automated: true });
        te.addDrawDefinition({ eventId: event.eventId, drawDefinition });
        const bMatch = (drawDefinition.structures[0].matchUps || []).find((m: any) => m.roundNumber === 1);
        if (!bMatch) throw new Error('event B produced no round-1 matchUp');

        const place = (matchUpId: string, drawId: string, court: any, courtOrder: number) =>
          te.addMatchUpScheduleItems({
            matchUpId,
            drawId,
            schedule: {
              scheduledDate: date,
              courtId: court.courtId,
              venueId: court.venueId,
              courtOrder,
              scheduledTime: courtOrder === 1 ? '09:00' : '10:30',
            },
          });
        place(aMatch.matchUpId, aMatch.drawId, courts[0], orders[0]);
        place(bMatch.matchUpId, drawDefinition.drawId, courts[1], orders[1]);

        const rec = te.getTournament().tournamentRecord;
        await dev.tmx2db.addTournament(rec);

        // The seed's own guard. Read back what proConflicts actually reports rather than
        // trusting the courtOrder arithmetic above: if this fixture is not the severity
        // it was built to be, every assertion downstream is vacuous.
        const { matchUps } = ce.allCompetitionMatchUps({
          matchUpFilters: { scheduledDate: date },
          nextMatchUps: true,
          inContext: true,
        });
        const result = ce.proConflicts({ matchUps });
        const all = [
          ...(Object.values(result?.rowIssues ?? {}) as any[]).flat(),
          ...(Object.values(result?.courtIssues ?? {}) as any[]).flat(),
        ].filter(Boolean);
        if (!all.length) throw new Error(`seed at courtOrders ${orders.join('/')} produced no issues at all`);

        return {
          tournamentId: rec.tournamentId as string,
          matchUpIds: [aMatch.matchUpId, bMatch.matchUpId] as [string, string],
          severities: [...new Set(all.map((issue: any) => issue.issue))] as string[],
        };
      } catch (err: any) {
        throw new Error(
          `${err?.name || 'Error'}: ${err?.message || String(err)} | stack: ${err?.stack?.split('\n').slice(0, 3).join(' || ')}`,
        );
      }
    },
    { date: DATE, orders, tournamentId },
  );
}

/** The value a theme token resolves to, as the browser reports it — never a guessed hex. */
const tokenRgb = (page: Page, name: string) =>
  page.evaluate((property) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${property})`;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, name);

async function openGrid(page: Page, tournamentId: string): Promise<void> {
  const tournament = new TournamentPage(page);
  await tournament.goto(tournamentId);
  await tournament.navigateToScheduling();
  await expect(page.locator(ISSUES_BUTTON)).toBeVisible({ timeout: 10_000 });
}

test.describe('Journey 134 — issue severity reads honestly, and warning bars are optional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    await page.evaluate(() => localStorage.clear());
  });

  test.describe('a schedule whose issues are ALL warnings', () => {
    let seed: Seed;

    test.beforeEach(async ({ page }) => {
      seed = await seedSharedPlayer(page, [1, 2], 'e2e-severity-warn');
      // The premise, stated where it can fail loudly: back-to-back rows must produce
      // WARNING and nothing harder, or this whole describe is asserting over an error.
      expect(seed.severities).toStrictEqual(['WARNING']);
      await openGrid(page, seed.tournamentId);
    });

    test('the count badge does NOT read as an error', async ({ page }) => {
      const badge = page.locator(ISSUES_BADGE);
      await expect(badge).toBeVisible();
      await expect(badge).toHaveAttribute('data-issue-severity', 'WARN');

      const [errorFill, cautionFill] = await Promise.all([
        tokenRgb(page, '--tmx-fill-error'),
        tokenRgb(page, '--tmx-fill-caution'),
      ]);
      // Control: if the two tokens resolved to the same value — or to nothing — the
      // comparison below would pass no matter what the badge did.
      expect(errorFill).toMatch(/^rgb/);
      expect(errorFill).not.toBe(cautionFill);

      const background = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(background).toBe(cautionFill);
      expect(background).not.toBe(errorFill);
    });

    test('every row in the popover is a warning — the badge is not lying about the set', async ({ page }) => {
      await page.locator(ISSUES_BUTTON).click();
      const rows = page.locator(ISSUE_ROW);
      // Non-degenerate: an empty popover would satisfy "no ERROR row" trivially.
      await expect(rows.first()).toBeVisible({ timeout: 5_000 });
      const severities = await rows.evaluateAll((els) => els.map((el) => el.firstElementChild?.textContent));
      expect(severities.length).toBeGreaterThan(0);
      expect(new Set(severities)).toStrictEqual(new Set(['WARN']));
    });

    test('the badge is legible in BOTH light and dark', async ({ page }) => {
      const badge = page.locator(ISSUES_BADGE);
      const button = page.locator(ISSUES_BUTTON);
      await expect(badge).toBeVisible();

      // The app boots in dark, so reading "light" without setting it first silently
      // reads dark twice — a pass that measured nothing. Journey 98's lesson.
      const setTheme = async (theme: 'light' | 'dark') => {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      };
      const read = async () => ({
        fill: await badge.evaluate((el) => getComputedStyle(el).backgroundColor),
        ink: await badge.evaluate((el) => getComputedStyle(el).color),
        icon: await button.evaluate((el) => getComputedStyle(el).color),
      });

      await setTheme('light');
      const light = await read();
      await button.screenshot({ path: 'e2e/test-results/134-issues-badge-warn-light.png' });

      await setTheme('dark');
      const dark = await read();
      await button.screenshot({ path: 'e2e/test-results/134-issues-badge-warn-dark.png' });

      // An unresolved custom property computes to a transparent / empty value. That is
      // the failure this catches — in either theme.
      for (const snapshot of [light, dark]) {
        expect(snapshot.fill).toMatch(/^rgb/);
        expect(snapshot.fill).not.toBe('rgba(0, 0, 0, 0)');
        expect(snapshot.ink).not.toBe('rgba(0, 0, 0, 0)');
        expect(snapshot.ink).not.toBe(snapshot.fill);
      }
      // The severity fills are deliberately theme-invariant — a severity that changed
      // colour with the theme would not be learnable. See theme.css.
      expect(light.fill).toBe(dark.fill);
      // …so the CONTROL that the theme actually switched is the icon, which reads
      // `--tmx-accent-orange` and IS defined per theme. Without this, the assertion
      // above would also hold if `setTheme` had done nothing.
      expect(light.icon).not.toBe(dark.icon);
    });

    test('turning warning bars off clears the grid decoration and keeps the list', async ({ page }) => {
      // Premise: the bar is actually drawn. Without this the "zero after" assertion is
      // satisfied by a grid that never painted one.
      await expect(page.locator(warningBars)).toHaveCount(1);

      await page.locator(ISSUES_BUTTON).click();
      const toggle = page.locator(WARNING_BARS_TOGGLE);
      await expect(toggle).toBeVisible({ timeout: 5_000 });
      // Default ON — today's behaviour for an operator who has never touched it.
      await expect(toggle).toBeChecked();

      await toggle.uncheck();
      await expect(page.locator(warningBars)).toHaveCount(0);

      // The decoration is hidden; the issue is not. The operator still has to be able to
      // read what they turned the paint off for.
      await expect(page.locator(ISSUE_ROW).first()).toBeVisible();
      await expect(page.locator(ISSUES_BADGE)).toHaveText('1');

      // …and back, because a preference that only travels one way is half a control.
      await toggle.check();
      await expect(page.locator(warningBars)).toHaveCount(1);
    });

    test('the preference survives a reload', async ({ page }) => {
      await page.locator(ISSUES_BUTTON).click();
      await page.locator(WARNING_BARS_TOGGLE).uncheck();
      await expect(page.locator(warningBars)).toHaveCount(0);

      await page.reload();
      await waitForAppReady(page);
      await openGrid(page, seed.tournamentId);

      await expect(page.locator(warningBars)).toHaveCount(0);
      await page.locator(ISSUES_BUTTON).click();
      await expect(page.locator(WARNING_BARS_TOGGLE)).not.toBeChecked();
    });
  });

  test.describe('a schedule that DOES contain an error', () => {
    let seed: Seed;

    test.beforeEach(async ({ page }) => {
      seed = await seedSharedPlayer(page, [1, 1], 'e2e-severity-error');
      // Same-row double placement of one player is a hard CONFLICT. If this fixture came
      // back as a warning, the assertions below would be testing the other branch.
      expect(seed.severities).toContain('CONFLICT');
      await openGrid(page, seed.tournamentId);
    });

    test('the count badge DOES read as an error', async ({ page }) => {
      const badge = page.locator(ISSUES_BADGE);
      await expect(badge).toBeVisible();
      await expect(badge).toHaveAttribute('data-issue-severity', 'ERROR');

      const [errorFill, cautionFill] = await Promise.all([
        tokenRgb(page, '--tmx-fill-error'),
        tokenRgb(page, '--tmx-fill-caution'),
      ]);
      expect(errorFill).not.toBe(cautionFill);

      const background = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(background).toBe(errorFill);
      expect(background).not.toBe(cautionFill);
    });

    test('error decoration survives the warning-bars toggle', async ({ page }) => {
      // Both parties to a same-row participant conflict are annotated, unlike the
      // adjacency case above — the conflict is computed within one row rather than
      // across two, so neither matchUp is decided before the other is known.
      await expect(page.locator(errorBars)).toHaveCount(2);

      await page.locator(ISSUES_BUTTON).click();
      await page.locator(WARNING_BARS_TOGGLE).uncheck();

      // The whole point of the toggle: quieting adjacency must not quiet the faults.
      await expect(page.locator(errorBars)).toHaveCount(2);
      await expect(page.locator(ISSUES_BADGE)).toHaveAttribute('data-issue-severity', 'ERROR');
    });
  });
});

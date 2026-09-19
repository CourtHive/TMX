import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 126 — a result can record WHY, but only where a policy says what the reasons are.
 *
 * This is the acceptance test the reason-code picker shipped without. The unit and DOM suites in
 * courthive-components cover the control's own behaviour; none of them can see the part that
 * actually decides whether an operator ever meets it — TMX resolving a scoring policy for the
 * event and handing the vocabulary in.
 *
 * TMX ships NO built-in vocabulary by design (CA, 2026-09-20): the reason control exists only
 * where a governing body's policy is attached. That makes "no control" the state almost every
 * tournament is in, and it is the state most likely to become permanent by accident — a resolver
 * that quietly returns undefined looks exactly like a tournament with no policy. So both halves
 * are asserted here, and the negative half is not a formality:
 *
 *  - WITHOUT a policy, the control must be absent and the result must still submit.
 *  - WITH one attached, the control must offer the policy's own codes and the chosen code must
 *    reach `matchUp.matchUpStatusCodes`.
 *
 * The second assertion is the one that matters most, because every layer beneath it can be green
 * while the code is dropped in transit: the engine has accepted `outcome.matchUpStatusCodes` for a
 * long time, and TMX was the one place that never sent it.
 */

const SCORING_POLICY_TYPE = 'scoring';
const REASON_SELECT = '#statusCodeSelectV2';
const OUTCOME_RADIO = 'input[name="matchOutcome"]';
const WINNER_RADIO = 'input[name="irregularWinner"]';
const SUBMIT = '#submitScoreV2';
const SET_INPUT = (setIndex: number, side: number) => `input[data-set-index="${setIndex}"][data-side="${side}"]`;

/** A retirement-through-injury, from the governing body's shipped vocabulary. */
const INJURY_CODE = 'RJ';

type Seeded = { tournamentId: string; matchUpId: string };

/**
 * Seed a tournament, optionally attaching a scoring policy that carries `matchUpStatusCodes`.
 *
 * The vocabulary comes from the factory fixture rather than being restated here — a hand-copied
 * vocabulary is how the scoring editor and the factory fixture drifted apart while both looked
 * correct, and a journey asserting against its own copy would assert nothing about the real one.
 */
async function seedTournament(page: Page, withPolicy: boolean): Promise<Seeded> {
  return page.evaluate(
    async ({ withPolicy, policyType }) => {
      await dev.tmx2db.initDB();

      const scoringPolicy = (dev.factory as any).fixtures.policies.POLICY_SCORING_USTA[policyType];
      const policyDefinitions = withPolicy ? { [policyType]: scoringPolicy } : undefined;

      const { tournamentRecord } = dev.factory.mocksEngine.generateTournamentRecord({
        nonRandom: 1,
        setState: true,
        tournamentName: withPolicy ? 'E2E Reason Codes' : 'E2E No Reason Codes',
        tournamentAttributes: { tournamentId: withPolicy ? 'e2e-reason-codes' : 'e2e-no-reason-codes' },
        drawProfiles: [{ eventName: 'Singles', drawSize: 8, drawType: 'SINGLE_ELIMINATION' }],
        ...(policyDefinitions ? { policyDefinitions } : {}),
      });

      await dev.load({ tournamentRecord });

      const matchUp: any = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
        (m: any) => m.matchUpStatus !== 'BYE' && m.roundNumber === 1,
      );
      if (!matchUp) throw new Error('seedTournament: no round-1 matchUp');

      return { tournamentId: tournamentRecord.tournamentId, matchUpId: matchUp.matchUpId };
    },
    { withPolicy, policyType: SCORING_POLICY_TYPE },
  );
}

/**
 * Open the real scoring modal and enter a partial set, which is what a retirement actually looks
 * like: someone retired at 3-2 in the first set.
 *
 * The partial score is also what REVEALS the irregular-ending controls — dynamicSets keeps them
 * hidden until a score is in progress, on the reasoning that a matchUp nobody has started scoring
 * has no ending to describe. The radios are in the DOM from the start but not visible, so a journey
 * that only waited for them to be attached would hang on a control the operator cannot click.
 */
async function openScoringModalWithPartialScore(page: Page, matchUpId: string): Promise<void> {
  await page.evaluate((id) => (dev as any).enterMatchUpScore({ matchUpId: id }), matchUpId);
  await page.locator(SET_INPUT(0, 1)).waitFor({ state: 'visible' });

  await page.locator(SET_INPUT(0, 1)).fill('3');
  await page.locator(SET_INPUT(0, 2)).fill('2');

  await page.locator(`${OUTCOME_RADIO}[value="RETIRED"]`).waitFor({ state: 'visible' });
}

async function readStatusCodes(page: Page, matchUpId: string): Promise<any> {
  return page.evaluate((id) => {
    const m: any = (dev.factory.competitionEngine.allTournamentMatchUps({}).matchUps || []).find(
      (x: any) => x.matchUpId === id,
    );
    return { matchUpStatus: m?.matchUpStatus, matchUpStatusCodes: m?.matchUpStatusCodes, winningSide: m?.winningSide };
  }, matchUpId);
}

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  await initDevBridge(page);
  await resetState(page);
}

test.describe('journey 126 — scoring reason codes', () => {
  test('with a policy attached, the reason reaches the record', async ({ page }) => {
    await boot(page);
    const { matchUpId } = await seedTournament(page, true);

    await openScoringModalWithPartialScore(page, matchUpId);

    // CONTROL: the picker must be populated from the policy before anything is asserted about it.
    // An empty or absent select here would make every assertion below pass vacuously.
    await page.locator(`${OUTCOME_RADIO}[value="RETIRED"]`).check();
    await expect(page.locator(REASON_SELECT)).toBeVisible();
    const offered = await page.locator(`${REASON_SELECT} option`).evaluateAll((o) => o.map((x: any) => x.value));
    expect(offered.length).toBeGreaterThan(1);
    expect(offered).toContain(INJURY_CODE);

    await page.locator(`${WINNER_RADIO}[value="1"]`).check();
    await page.locator(REASON_SELECT).selectOption(INJURY_CODE);
    await page.locator(SUBMIT).click();

    await expect
      .poll(async () => (await readStatusCodes(page, matchUpId)).matchUpStatus, { timeout: 10_000 })
      .toBe('RETIRED');

    const recorded = await readStatusCodes(page, matchUpId);
    // The code may arrive as a bare string or wrapped as { code } — the factory rewraps string
    // elements once propagation touches the matchUp, and both shapes are legitimate.
    const codes = (recorded.matchUpStatusCodes ?? []).map((c: any) => (typeof c === 'string' ? c : c?.code));
    expect(codes).toContain(INJURY_CODE);
    expect(recorded.winningSide).toBe(1);
  });

  test('with no policy attached, no reason is offered and the result still submits', async ({ page }) => {
    await boot(page);
    const { matchUpId } = await seedTournament(page, false);

    await openScoringModalWithPartialScore(page, matchUpId);
    await page.locator(`${OUTCOME_RADIO}[value="RETIRED"]`).check();

    await expect(page.locator(REASON_SELECT)).toBeHidden();

    await page.locator(`${WINNER_RADIO}[value="1"]`).check();
    await page.locator(SUBMIT).click();

    await expect
      .poll(async () => (await readStatusCodes(page, matchUpId)).matchUpStatus, { timeout: 10_000 })
      .toBe('RETIRED');

    const recorded = await readStatusCodes(page, matchUpId);
    const codes = (recorded.matchUpStatusCodes ?? []).map((c: any) => (typeof c === 'string' ? c : c?.code));
    expect(codes).not.toContain(INJURY_CODE);
  });
});

/**
 * Inline competitive fingerprint for the participant profile modal — §6.2 of
 * Mentat/planning/COMPETITIVE_FINGERPRINT.md.
 *
 * Two orthogonal axes, both computed LOCALLY by the factory from the matchUps
 * already in memory: no network, no identity, works offline.
 *
 *   REALIZED   how close the matches actually were (score spread, unsigned).
 *   EXPOSURE   who they were drawn against (signed rating delta) — the
 *              five-segment bar. Needs a rating on both sides, so it appears
 *              only when one resolves.
 *
 * Deliberately NOT here: the cross-tournament "Competitive journey" link-out.
 * That needs the HiveID hop of §6.1, which does not exist yet, and the standard
 * is never to render a dead link.
 *
 * Coverage is always stated. A bar drawn from four rated matchUps out of eleven
 * would otherwise imply a completeness it does not have.
 */
import { fixtures, matchUpGovernor, factoryConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { buildSegmentedBar } from 'courthive-components';
import { t } from 'i18n';

import './participant-fingerprint.css';

const { POLICY_COMPETITIVE_BANDS_DEFAULT } = fixtures.policies;
const { getCompetitiveProfile } = matchUpGovernor;
const { SINGLES } = factoryConstants.eventConstants;
const { ratingsParameters } = fixtures;

const POLICY_TYPE = 'competitiveBands';
const COVERAGE_CLASS = 'tmx-fp__coverage';

/**
 * Band → CSS custom property. Only the DEFAULT vocabulary is mapped: band count
 * and names come from policy, so a federation shipping three bands or its own
 * names still renders — unmapped keys fall back to a neutral swatch rather than
 * silently borrowing another band's colour.
 *
 * Colours are a diverging ramp (cool = played down, neutral = even, warm =
 * played up) rather than good/bad hues: the whole point of the axis is that a
 * healthy diet contains up, even AND down, so ANCHOR must not read as failure.
 * Derived with the dataviz palette validator, not by eye — see the CSS.
 */
const BAND_VARS: Record<string, string> = {
  ANCHOR: '--tmx-fp-anchor',
  DOWN: '--tmx-fp-down',
  EVEN: '--tmx-fp-even',
  UP: '--tmx-fp-up',
  STRETCH: '--tmx-fp-stretch',
};

const bandColor = (key: string): string => `var(${BAND_VARS[key] ?? '--tmx-fp-other'})`;
const bandLabel = (key: string): string => t(`fingerprint.bands.${key}`, { defaultValue: key });

/** The band keys a policy declares, widest-stretch first for display. */
export function displayBandKeys(policyDefinitions: any): string[] {
  const deltaBands = policyDefinitions?.[POLICY_TYPE]?.deltaBands ?? [];
  // The policy list ascends by boundary (ANCHOR → STRETCH); the bar has always
  // read stretch-first, matching the ITA fingerprint artifacts.
  return deltaBands
    .map((band: any) => band?.key)
    .filter(Boolean)
    .reverse();
}

/**
 * A rating scale this participant actually carries AND the factory knows how to
 * orient. An unknown scale is skipped rather than guessed: the factory refuses
 * to infer orientation (guessing inverts every band), so passing one would only
 * produce an error.
 */
export function resolveScaleName(participant: any): string | undefined {
  const ratings = participant?.ratings?.[SINGLES] ?? [];
  for (const rating of ratings) {
    const scaleName = String(rating?.scaleName ?? '').toUpperCase();
    if (scaleName && ratingsParameters[scaleName]) return scaleName;
  }
  return undefined;
}

function textRow(className: string, text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

function buildLegend(bandKeys: string[], counts: Record<string, number>): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'tmx-fp__legend';

  // Identity is never colour-alone: every band gets a swatch AND its name.
  for (const key of bandKeys) {
    const item = document.createElement('span');
    item.className = 'tmx-fp__legend-item';
    if (!counts[key]) item.classList.add('is-empty');

    const swatch = document.createElement('span');
    swatch.className = 'tmx-fp__swatch';
    swatch.style.background = bandColor(key);

    item.append(swatch, document.createTextNode(bandLabel(key)));
    legend.appendChild(item);
  }

  return legend;
}

type FingerprintDataArgs = {
  policyDefinitions?: any;
  participantId: string;
  participant: any;
  matchUps: any[];
};

export type FingerprintData = {
  exposure: any;
  realized: any;
  bandKeys: string[];
  scaleName?: string;
};

/**
 * The pure half: everything the block renders, with no DOM. Separated so it is
 * unit-testable — TMX's vitest runs in node with no DOM, and DOM assertions
 * belong to Playwright.
 *
 * Returns undefined when there is nothing honest to show: no completed matchUps
 * AND no resolvable exposure, or a policy/scale the factory rejects (a
 * configuration problem is surfaced by rendering nothing, never papered over
 * with an empty bar).
 */
export function fingerprintData({
  policyDefinitions = POLICY_COMPETITIVE_BANDS_DEFAULT,
  participantId,
  participant,
  matchUps,
}: FingerprintDataArgs): FingerprintData | undefined {
  if (!matchUps?.length) return undefined;

  const scaleName = resolveScaleName(participant);

  const profile: any = getCompetitiveProfile({
    policyDefinitions,
    participantId,
    scaleName,
    matchUps,
  });
  if (profile?.error || !profile?.realized) return undefined;

  const { realized, exposure } = profile;
  if (!realized.completed && !exposure.rated) return undefined;

  return { realized, exposure, scaleName, bandKeys: displayBandKeys(policyDefinitions) };
}

type FingerprintArgs = {
  policyDefinitions?: any;
  participantId: string;
  participant: any;
};

/** The DOM shell. All decisions live in `fingerprintData`. */
export function buildParticipantFingerprint({
  policyDefinitions = POLICY_COMPETITIVE_BANDS_DEFAULT,
  participantId,
  participant,
}: FingerprintArgs): HTMLElement | undefined {
  // `withScaleValues` must be TOP-LEVEL here, not inside contextProfile: nested,
  // the matchUp side participants come back with `ratings: {}` and the exposure
  // axis silently finds nothing to band. Verified in the running app — the unit
  // tests hand `fingerprintData` its matchUps, so they cannot catch this.
  //
  // `withMatchUps` returns the tournament's matchUps, not only this
  // participant's; `getCompetitiveProfile` does the participant filtering.
  const { matchUps } = tournamentEngine.getParticipants({
    participantFilters: { participantIds: [participantId] },
    withScaleValues: true,
    withMatchUps: true,
  });

  const data = fingerprintData({ policyDefinitions, participantId, participant, matchUps: matchUps ?? [] });
  if (!data) return undefined;

  const { realized, exposure, scaleName, bandKeys } = data;

  const section = document.createElement('div');
  section.className = 'tmx-fp';

  const heading = textRow('tmx-fp__heading', t('fingerprint.title'));
  section.appendChild(heading);

  if (realized.completed) {
    const competitiveRatio = Math.round((realized.ratios.COMPETITIVE ?? 0) * 10) / 10;
    section.appendChild(
      textRow(
        'tmx-fp__realized',
        t('fingerprint.competitiveRatio', { pct: competitiveRatio, count: realized.completed }),
      ),
    );
  }

  if (exposure.deltaBandsApplied && exposure.rated) {
    const bar = buildSegmentedBar({
      segments: bandKeys.map((key) => ({ key, label: bandLabel(key), color: bandColor(key) })),
    });
    bar.update(exposure.counts);
    bar.element.classList.add('tmx-fp__bar');
    section.append(bar.element, buildLegend(bandKeys, exposure.counts));

    // State the denominator and the scale. Without them the bar is a shape with
    // no provenance — and provenance of the level is a §6.2 requirement.
    section.appendChild(
      textRow(
        COVERAGE_CLASS,
        exposure.unrated
          ? t('fingerprint.coveragePartial', { rated: exposure.rated, unrated: exposure.unrated, scale: scaleName })
          : t('fingerprint.coverage', { rated: exposure.rated, scale: scaleName }),
      ),
    );
  } else if (scaleName) {
    section.appendChild(textRow(COVERAGE_CLASS, t('fingerprint.noRatedOpponents', { scale: scaleName })));
  } else {
    section.appendChild(textRow(COVERAGE_CLASS, t('fingerprint.noRating')));
  }

  return section;
}

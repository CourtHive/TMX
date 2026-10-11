import { t } from 'i18n';

// constants and types
import type { getMatchUpFormatModal } from 'courthive-components';

/** The picker's `config.labels`, as courthive-components declares it, so an unknown key fails type-checking. */
type MatchFormatLabels = NonNullable<
  NonNullable<NonNullable<Parameters<typeof getMatchUpFormatModal>[0]>['config']>['labels']
>;

export function getMatchFormatLabels(): MatchFormatLabels {
  return {
    title: t('modals.matchFormat.title'),
    setFormatLabel: t('modals.matchFormat.setFormat'),
    finalSetLabel: t('modals.matchFormat.finalSet'),
    tiebreakLabel: t('modals.matchFormat.tiebreak'),
    finalSetToggleLabel: t('modals.matchFormat.finalSet'),
    standardFormatsLabel: t('modals.matchFormat.standardFormats'),
    cancel: t('modals.matchFormat.cancel'),
    select: t('modals.matchFormat.select'),
    custom: t('modals.matchFormat.custom'),
    aggregate: t('modals.matchFormat.aggregate'),
    game: t('modals.matchFormat.game'),
    gameType: t('modals.matchFormat.gameType'),
    deuceRule: t('modals.matchFormat.deuceRule'),
    none: t('modals.matchFormat.none'),
    traditional: t('modals.matchFormat.traditional'),
    consecutive2: t('modals.matchFormat.consecutive2'),
    consecutive3: t('modals.matchFormat.consecutive3'),
    consecutive4: t('modals.matchFormat.consecutive4'),
    goldenPoint: t('modals.matchFormat.goldenPoint'),
    starPoint: t('modals.matchFormat.starPoint'),
    games: t('modals.matchFormat.games'),
    points: t('modals.matchFormat.points'),
    readOnly: t('modals.matchFormat.readOnly'),
    maxTime: t('modals.matchFormat.maxTime'),
    descriptors: {
      bestOf: t('modals.matchFormat.bestOf'),
      exactly: t('modals.matchFormat.exactly'),
    },
    // The set-type names: singular in `what`, plural in `whatPlural` (courthive-components 6.5.0)
    what: {
      sets: t('modals.matchFormat.set'),
      tiebreaks: t('modals.matchFormat.tiebreak'),
      timedSets: t('modals.matchFormat.timedSet'),
      outs: t('modals.matchFormat.outs'),
      pointsTotal: t('modals.matchFormat.pointsTotal'),
    },
    whatPlural: {
      sets: t('modals.matchFormat.setPlural'),
      tiebreaks: t('modals.matchFormat.tiebreakPlural'),
      timedSets: t('modals.matchFormat.timedSetPlural'),
      outs: t('modals.matchFormat.outs'),
      pointsTotal: t('modals.matchFormat.pointsTotal'),
    },
    advantage: {
      ad: t('modals.matchFormat.ad'),
      noAd: t('modals.matchFormat.noAd'),
    },
    matchRoots: {
      SET: t('modals.matchFormat.roots.set'),
      HAL: t('modals.matchFormat.roots.half'),
      QTR: t('modals.matchFormat.roots.quarter'),
      PER: t('modals.matchFormat.roots.period'),
      INN: t('modals.matchFormat.roots.inning'),
      RND: t('modals.matchFormat.roots.round'),
      FRM: t('modals.matchFormat.roots.frame'),
      MAP: t('modals.matchFormat.roots.map'),
    },
    // Templates: the picker puts the number where `{n}` is. Single braces, so i18next leaves them alone.
    setTo: t('modals.matchFormat.setTo'),
    tiebreakTo: t('modals.matchFormat.tiebreakTo'),
    winBy: t('modals.matchFormat.winBy'),
    minutes: t('modals.matchFormat.minutesCount'),
    outs: t('modals.matchFormat.outsCount'),
    maxMinutes: t('modals.matchFormat.maxMinutes'),
    pointsTotal: t('modals.matchFormat.pointsCount'),
    consecutive: t('modals.matchFormat.consecutive'),
    tieAllowed: t('modals.matchFormat.tieAllowed'),
  };
}

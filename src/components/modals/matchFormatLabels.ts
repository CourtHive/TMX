import { t } from 'i18n';

export function getMatchFormatLabels() {
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
    descriptors: {
      bestOf: t('modals.matchFormat.bestOf'),
      exactly: t('modals.matchFormat.exactly'),
    },
    what: {
      sets: t('modals.matchFormat.set'),
      tiebreaks: t('modals.matchFormat.tiebreak'),
      timedSets: t('modals.matchFormat.timedSet'),
    },
    advantage: {
      ad: t('modals.matchFormat.ad'),
      noAd: t('modals.matchFormat.noAd'),
    },
  };
}

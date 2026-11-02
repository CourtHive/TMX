/**
 * StatCrew export of one dual: the factory's `generateStatCrew` writes a `<tngame>` per team matchUp in the
 * tournament; this picks the one for the dual and names the file.
 *
 * - Offered once the dual has its result (`hasFinalResult`).
 * - Home and visitor are the factory's: an explicit or inferred home team, else a neutral game (`neutralgame="Y"`),
 *   whose home and visitor slots are positional only.
 * - `generateStatCrew` takes no matchUpId and its games carry none, so the dual's game is found by its two teams
 *   (StatCrew's `homeid` / `visid`). When the same two teams met more than once the games cannot be told apart, so
 *   the export is refused rather than guessed.
 *
 * Pure (no DOM), so it is tested through the real engine.
 */
import { tournamentEngine } from 'services/factory/engine';
import { hasFinalResult } from 'functions/hasFinalResult';

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

export const STATCREW_NOT_A_DUAL = 'STATCREW_NOT_A_DUAL';
export const STATCREW_NOT_COMPLETE = 'STATCREW_NOT_COMPLETE';
export const STATCREW_NOT_FOUND = 'STATCREW_NOT_FOUND';
export const STATCREW_AMBIGUOUS = 'STATCREW_AMBIGUOUS';

export type StatCrewExport =
  { filename: string; content: string; homeName?: string; visitorName?: string; neutral: boolean } | { error: string };

type DualRef = { drawId: string; matchUpId: string };

/** Whether a matchUp is a dual whose StatCrew file can be exported: a TEAM matchUp with its result in. */
export function canExportStatCrew(matchUp: any): boolean {
  return matchUp?.matchUpType === 'TEAM' && hasFinalResult(matchUp);
}

export function statCrewExport({ drawId, matchUpId }: DualRef): StatCrewExport {
  const matchUp = tournamentEngine.findMatchUp({ drawId, matchUpId })?.matchUp;
  if (matchUp?.matchUpType !== 'TEAM') return { error: STATCREW_NOT_A_DUAL };
  if (!hasFinalResult(matchUp)) return { error: STATCREW_NOT_COMPLETE };

  const result: any = tournamentEngine.generateStatCrew();
  if (!result || result.error) return { error: STATCREW_NOT_FOUND };

  const index = gameIndex({ matchUp, games: result.json ?? [] });
  if (typeof index !== 'number') return { error: index };

  const venue = result.json[index]?.venue ?? {};
  const xml: string = result.xml?.[index] ?? '';
  const neutral = venue.neutralgame === 'Y';
  const content = xml.startsWith('<?xml') ? xml : `${XML_DECLARATION}\n${xml}`;
  const date = matchUp.schedule?.scheduledDate ?? tournamentEngine.getTournament()?.tournamentRecord?.startDate;

  return {
    filename: statCrewFilename({ homeName: venue.homename, visitorName: venue.visname, date, neutral }),
    visitorName: venue.visname,
    homeName: venue.homename,
    content,
    neutral,
  };
}

/** `StatCrew_<visitor>_at_<home>_<date>.xml`; `vs` for a neutral game, whose slots claim no home team. */
export function statCrewFilename({
  homeName,
  visitorName,
  neutral,
  date,
}: {
  homeName?: string;
  visitorName?: string;
  neutral?: boolean;
  date?: string;
}): string {
  const parts = [
    'StatCrew',
    fileSafe(visitorName) || 'visitor',
    neutral ? 'vs' : 'at',
    fileSafe(homeName) || 'home',
    fileSafe(date?.slice(0, 10)),
  ].filter(Boolean);
  return `${parts.join('_')}.xml`;
}

function fileSafe(value?: string): string {
  return (value ?? '')
    .normalize('NFKD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[^\w-]+/g, '-')
    .replaceAll(/-{2,}/g, '-')
    .replaceAll(/(^-)|(-$)/g, '');
}

function gameIndex({ matchUp, games }: { matchUp: any; games: any[] }): number | string {
  const teamIds = new Set<string>(matchUp.sides?.map((side: any) => side?.participantId).filter(Boolean));
  const candidates = games
    .map((game, index) => ({ game, index }))
    .filter(({ game }) => {
      const ids = [game?.venue?.homeid, game?.venue?.visid];
      return teamIds.size === 2 && ids.every((id) => teamIds.has(id)) && ids[0] !== ids[1];
    });
  if (candidates.length === 1) return candidates[0].index;
  return candidates.length ? STATCREW_AMBIGUOUS : STATCREW_NOT_FOUND;
}

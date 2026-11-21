/**
 * Mock tournament generation for testing and demo purposes.
 * Creates sample tournaments with various draw types and categories.
 */
import { sportFromMatchUpFormat, COURT_SVG_RESOURCE_SUB_TYPE } from 'courthive-components';
import { mockProfiles, withTournamentCategories } from 'pages/tournaments/mockProfiles';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { mapTournamentRecord } from 'pages/tournaments/mapTournamentRecord';
import { getLoginState } from 'services/authentication/loginState';
import { forgetDemoClockHistory } from 'services/clock/demoClock';
import { tmxToast } from 'services/notifications/tmxToast';
import { mocksEngine } from 'tods-competition-factory';
import { t } from 'i18n';

import { SUCCESS } from 'constants/tmxConstants';

export function mockTournaments(table?: any, onComplete?: () => void, indices?: number[]): any {
  const tournamentIds = table?.getData().map((t: any) => t.tournamentId) ?? [];
  const tournamentRecords = generateTournamentRecords(indices);
  const provider = getLoginState()?.provider;

  const savePromises: Promise<void>[] = [];

  for (const tournamentRecord of tournamentRecords) {
    const rowData = mapTournamentRecord(tournamentRecord);
    const existsInCalendar = tournamentIds.includes(tournamentRecord.tournamentId);
    if (existsInCalendar) {
      table?.updateOrAddData([rowData], true);
    } else {
      table?.addData([rowData], true);
    }

    if (provider && !tournamentRecord.parentOrganisation) tournamentRecord.parentOrganisation = provider;
    savePromises.push(saveTournamentRecord({ tournamentRecord }));
  }

  if (onComplete) {
    Promise.all(savePromises).then(onComplete);
  }

  return { ...SUCCESS };
}

export const EXAMPLE_TOURNAMENT_CATALOG = mockProfiles.map((p, i) => ({
  label: p.tournamentName,
  value: i,
}));

function addAutoCourtImage(tournamentRecord: any, drawProfiles: any[]): void {
  const hasImage = tournamentRecord.onlineResources?.some((r: any) => r.name === 'tournamentImage');
  if (hasImage) return;

  // Use the first draw profile's matchUpFormat to infer the sport; default to tennis
  const format = drawProfiles?.find((p: any) => p.matchUpFormat)?.matchUpFormat;
  const sport = sportFromMatchUpFormat(format) ?? 'tennis';
  if (!sport) return;

  if (!tournamentRecord.onlineResources) tournamentRecord.onlineResources = [];
  tournamentRecord.onlineResources.push({
    resourceSubType: COURT_SVG_RESOURCE_SUB_TYPE,
    name: 'tournamentImage',
    resourceType: 'OTHER',
    identifier: sport,
  });
}

function generateTournamentRecords(indices?: number[]): any[] {
  const profiles = indices ? indices.map((i) => mockProfiles[i]).filter(Boolean) : mockProfiles;
  return profiles.flatMap((profile) => {
    // A profile may compute time-relative parts (schedule dates, a maintenance window) when the
    // tournament is generated rather than when this module was imported. `build` is stripped before
    // the profile reaches the factory.
    const { build, ...rest }: any = profile;
    const built = build?.();
    if (build && !built) {
      // a time-relative example (the live schedule, the Scheduling Lab) needs a usable competition clock; the other
      // examples do not, so they still generate
      const message = t('tournaments.exampleClockUnavailable', { name: rest.tournamentName });
      tmxToast({ message, intent: 'is-danger' });
      return [];
    }
    const resolved = built ? { ...rest, ...built } : rest;
    const { tournamentRecord } = mocksEngine.generateTournamentRecord(withTournamentCategories(resolved));
    // a regenerated example (the Scheduling Lab keeps a fixed id) holds none of its old demo-clock stamps
    forgetDemoClockHistory(tournamentRecord.tournamentId);
    addAutoCourtImage(tournamentRecord, resolved.drawProfiles);
    return [tournamentRecord];
  });
}

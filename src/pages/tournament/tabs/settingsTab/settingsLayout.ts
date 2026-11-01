/**
 * Which settings panels appear, in which rows, and how wide each one is.
 *
 * The grid has SETTINGS_GRID_COLUMNS columns and every row's spans add up to exactly that, so auto-placement
 * starts each row on a fresh line. That is what lets a full-width panel (Pipeline features, Seeding policy) sit
 * between rows without splitting the column grid: the row before it is already complete. A row whose spans fell
 * short would let the next panel back-fill the gap and the layout would drift.
 *
 * Linked tournaments is not part of these rows: it is added and removed in place when its Beta checkbox
 * changes, prepended as a full-width first row. `isLinkedTournamentsEligible` is the one gate for both the
 * panel and its checkbox.
 */

export const SETTINGS_GRID_COLUMNS = 12;

export type SettingsPanelId =
  | 'seedingPolicy'
  | 'language'
  | 'theme'
  | 'font'
  | 'options'
  | 'pipelineFeatures'
  | 'betaFeatures'
  | 'connection'
  | 'dangerZone';

export type SettingsLayoutPanel = { id: SettingsPanelId; span: number };
export type SettingsLayoutRow = SettingsLayoutPanel[];

export type SettingsLayoutInput = {
  /** The app-level settings screen: no tournament is bound, so tournament-scoped panels are left out. */
  excludeTournament?: boolean;
  /** Pipeline features are offered (logged out, or a mock tournament); see `isPipelineEligible`. */
  pipelineEligible?: boolean;
  /** The user may delete the loaded tournament. */
  canDeleteTournament?: boolean;
  /** Electron only: the server connection panel. */
  isElectron?: boolean;
};

/** Tournament-scoped and provider-authenticated: hidden on the app screen and when logged out. */
export function isLinkedTournamentsEligible({
  excludeTournament,
  loggedIn,
}: {
  excludeTournament?: boolean;
  loggedIn: boolean;
}): boolean {
  return !excludeTournament && loggedIn;
}

/** Shares the columns evenly; every row's spans sum to SETTINGS_GRID_COLUMNS. */
function evenRow(ids: SettingsPanelId[]): SettingsLayoutRow {
  const span = SETTINGS_GRID_COLUMNS / ids.length;
  return ids.map((id) => ({ id, span }));
}

export function getSettingsLayout({
  excludeTournament,
  pipelineEligible,
  canDeleteTournament,
  isElectron,
}: SettingsLayoutInput): SettingsLayoutRow[] {
  const tournamentScope = !excludeTournament;
  const rows: SettingsLayoutRow[] = [];

  // A seeding policy is attached to the tournamentRecord, so it has nothing to bind to on the app screen.
  if (tournamentScope) rows.push(evenRow(['seedingPolicy']));

  rows.push(evenRow(['language', 'theme', 'font', 'options']));

  // Exit-propagation options for testing: tournament-scoped, below the preferences row and full width.
  if (tournamentScope && pipelineEligible) rows.push(evenRow(['pipelineFeatures']));

  const lastRow: SettingsPanelId[] = ['betaFeatures'];
  if (isElectron) lastRow.push('connection');
  if (tournamentScope && canDeleteTournament) lastRow.push('dangerZone');
  rows.push(evenRow(lastRow));

  return rows;
}

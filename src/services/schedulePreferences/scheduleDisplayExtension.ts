/**
 * Tournament-scoped Schedule Display preferences.
 *
 * Persisted as a single extension on the tournamentRecord so multiple
 * tournament directors editing the same tournament from different clients
 * see the same display config. The value shape is intentionally open-ended
 * (extensible bag) but today we only store `minCourtGridRows`.
 *
 * courthive-public can read the same extension name to hydrate venue
 * rendering for published tournaments.
 */
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';

import { ADD_TOURNAMENT_EXTENSION } from 'constants/mutationConstants';

export const SCHEDULE_DISPLAY_EXTENSION_NAME = 'scheduleDisplay';

export interface ScheduleDisplayConfig {
  minCourtGridRows?: number;
  /** When true, dropping a match onto the "Now" strip also starts it (IN_PROGRESS). */
  startOnDrop?: boolean;
  /** Set once the one-time start-on-drop prompt has been answered (either way). */
  startOnDropPrompted?: boolean;
}

function readRawExtensionValue(): Record<string, any> | undefined {
  const tournamentRecord: any = tournamentEngine.getTournament?.()?.tournamentRecord;
  const extensions: any[] = tournamentRecord?.extensions ?? [];
  const ext = extensions.find((e: any) => e?.name === SCHEDULE_DISPLAY_EXTENSION_NAME);
  const value = ext?.value;
  if (!value || typeof value !== 'object') return undefined;
  return value as Record<string, any>;
}

export function readScheduleDisplayConfig(): ScheduleDisplayConfig {
  const raw = readRawExtensionValue();
  if (!raw) return {};

  const result: ScheduleDisplayConfig = {};
  const rows = raw.minCourtGridRows;
  if (typeof rows === 'number' && Number.isFinite(rows) && rows > 0) {
    result.minCourtGridRows = Math.floor(rows);
  }
  if (typeof raw.startOnDrop === 'boolean') result.startOnDrop = raw.startOnDrop;
  if (typeof raw.startOnDropPrompted === 'boolean') result.startOnDropPrompted = raw.startOnDropPrompted;
  return result;
}

export function writeScheduleDisplayConfig(partial: ScheduleDisplayConfig): void {
  // Merge against the raw value so unknown keys (e.g. future display flags
  // added by other features) round-trip rather than being silently dropped.
  const existing = readRawExtensionValue() ?? {};
  const value = { ...existing, ...partial };
  mutationRequest({
    methods: [
      {
        method: ADD_TOURNAMENT_EXTENSION,
        params: { extension: { name: SCHEDULE_DISPLAY_EXTENSION_NAME, value } },
      },
    ],
  });
}

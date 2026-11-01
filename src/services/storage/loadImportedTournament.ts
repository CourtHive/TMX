/**
 * Load a tournament record from imported JSON text, then validate it.
 *
 * The load never waits on validation: the record goes into the engine and `onLoaded` runs
 * synchronously; schema + integrity validation starts afterwards and reports through
 * `onValidated`. A record with findings still loads, because hand-built CODES files are
 * expected to be imperfect and the operator decides what to fix.
 */
import type { RecordValidationSummary } from 'services/validation/recordValidationSummary';
import { validateTournamentRecord } from 'services/validation/validateTournamentRecord';
import { tournamentEngine } from 'services/factory/engine';
import * as safeJSON from 'utilities/safeJSON';

export type ImportedTournamentLoad = {
  tournamentRecord?: any;
  classic?: boolean;
  error?: any;
  validation?: Promise<RecordValidationSummary | undefined>;
};

export function loadImportedTournament({
  data,
  onLoaded,
  onValidated,
  validate = validateTournamentRecord,
}: {
  data: string;
  onLoaded: (tournamentRecord: any) => void;
  onValidated?: (summary: RecordValidationSummary) => void;
  validate?: typeof validateTournamentRecord;
}): ImportedTournamentLoad {
  const parsed = safeJSON.parse({ data });
  if (!parsed) return { error: 'invalid JSON' };

  if (!parsed.tournamentId || !parsed.startDate) {
    // pre-CODES records carry `tuid` + `start` and must be converted first
    if (parsed.tuid && parsed.start) return { classic: true };
    return { error: 'not a tournament record' };
  }

  const result: any = tournamentEngine.setState(parsed);
  if (!result?.success) return { error: result?.error ?? result };

  onLoaded(parsed);

  const validation = validate({ tournamentRecord: parsed })
    .then((summary) => {
      onValidated?.(summary);
      return summary;
    })
    .catch((error) => {
      console.warn('[loadImportedTournament] validation failed', error);
      return undefined;
    });

  return { tournamentRecord: parsed, validation };
}

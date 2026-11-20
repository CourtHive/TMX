/**
 * Run both record checks: the CODES schema (lazy ajv) and the factory's
 * getTournamentInconsistencies. Never throws and never blocks a load: callers start it
 * after the record is in the engine and render whatever comes back.
 *
 * A check that could not run is flagged (`schemaUnavailable` / `integrityUnavailable`) so an
 * unchecked record is never reported as identical to a clean one.
 */
import { summarizeRecordValidation, type RecordValidationSummary } from './recordValidationSummary';
import { tournamentGovernor, version } from 'tods-competition-factory';
import { validateAgainstSchema } from './schemaValidator';

function errorReason(error: any): string {
  if (typeof error === 'string') return error;
  return error?.message ?? error?.code ?? String(error);
}

function readFactoryVersion(): string | undefined {
  try {
    return version();
  } catch {
    return undefined;
  }
}

function runIntegrityCheck(tournamentRecord: any): { inconsistencies: any[]; unavailableReason?: string } {
  try {
    const result: any = tournamentGovernor.getTournamentInconsistencies({ tournamentRecord });
    if (result?.error) return { inconsistencies: [], unavailableReason: errorReason(result.error) };
    if (!Array.isArray(result?.inconsistencies)) {
      return { inconsistencies: [], unavailableReason: 'no inconsistencies list returned' };
    }
    return { inconsistencies: result.inconsistencies };
  } catch (error) {
    console.warn('[validateTournamentRecord] getTournamentInconsistencies failed', error);
    return { inconsistencies: [], unavailableReason: errorReason(error) };
  }
}

export async function validateTournamentRecord({
  tournamentRecord,
}: {
  tournamentRecord: any;
}): Promise<RecordValidationSummary> {
  // Integrity first and synchronously, so it reads the record as it was handed in.
  const { inconsistencies, unavailableReason } = runIntegrityCheck(tournamentRecord);

  const { schemaErrors, unavailable } = await validateAgainstSchema(tournamentRecord);
  return summarizeRecordValidation({
    schemaErrors,
    inconsistencies,
    schemaUnavailable: unavailable,
    integrityUnavailable: unavailableReason !== undefined,
    integrityUnavailableReason: unavailableReason,
    factoryVersion: readFactoryVersion(),
  });
}

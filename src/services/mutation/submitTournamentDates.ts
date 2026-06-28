import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

// constants
import { SET_TOURNAMENT_DATES } from 'constants/mutationConstants';

type DateParams = { startDate?: string; endDate?: string; activeDates?: string[] };

/**
 * Gate a tournament date change on the factory's native, non-destructive
 * `engine.explain` pre-flight.
 *
 * `setTournamentDates` rejects (by default) when matchUps are scheduled outside
 * the new range. `explain` runs the mutation against the loaded state on a
 * snapshot, captures the would-be result, then restores state and suppresses
 * notices — nothing is committed and the server is never hit on a call we
 * already know would be rejected. No clone of the tournamentRecord is needed.
 *
 *  - would succeed            → `submit()` (normal server-first mutation)
 *  - rejected for scheduling  → warning toast with a [Continue & unschedule]
 *                               action that re-issues `submit(true)` (force)
 *  - any other rejection      → warning toast, no submit
 *
 * `submit(force?)` builds and dispatches the real `mutationRequest`; callers own
 * the full methods array so name/timezone/tier mutations ride along on the
 * forced retry too.
 */
export function submitTournamentDates({
  params,
  submit,
}: {
  params: DateParams;
  submit: (force?: boolean) => void;
}): void {
  let outcome: any;
  try {
    outcome = tournamentEngine.explain(SET_TOURNAMENT_DATES, params);
  } catch {
    // If the local pre-flight throws for any reason, fall back to a normal
    // submit and let the server be the authority.
    return submit();
  }

  if (outcome?.wouldSucceed) return submit();

  const result = outcome?.detail?.results?.[0];
  const message = result?.error?.message ?? t('common.error');

  if (result?.outOfRangeMatchUpIds?.length) {
    tmxToast({
      message,
      intent: 'is-warning',
      pauseOnHover: true,
      duration: 8000,
      action: { text: t('common.continueAndUnschedule'), onClick: () => submit(true) },
    });
    return;
  }

  tmxToast({ message, intent: 'is-warning' });
}

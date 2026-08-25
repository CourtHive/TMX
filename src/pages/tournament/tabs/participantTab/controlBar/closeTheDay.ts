/**
 * End of day: sign out everyone still marked present.
 *
 * The write half of phase (c) — D4b, *"close the day, and read as-of"*. The read half already exists
 * (`services/presence/signInPresence`); without this action it answers honestly about a history whose
 * end nobody records, so a Thursday volunteer still reads present on Sunday.
 *
 * **Deliberately NOT built by loosening `signOutUnapproved`.** That action is COMPETITOR-scoped and
 * its header explains why: *"signed in with no events"* is the **definition** of an official, a coach
 * or a volunteer, so without the role filter it signed out the entire personnel roster in one click.
 * This action is role-agnostic on purpose — the day ending applies to everybody — which is the exact
 * behaviour that made the other one dangerous. Two intents, two actions, two labels.
 *
 * The decision of *who* is closed out lives in `stillSignedInOnDate`, a pure function, because TMX has
 * no jsdom and a decision made here would get no coverage.
 */

import { stillSignedInOnDate, venueCalendarDay } from 'services/presence/signInPresence';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { participantConstants } from 'tods-competition-factory';
import { confirmModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

// constants and types
import { MODIFY_SIGN_IN_STATUS } from 'constants/mutationConstants';

const { SIGNED_OUT } = participantConstants;

/**
 * Everyone whose day is still open, for the local calendar date.
 *
 * `withSignInStatus` is **not** used, and that is the point: it populates `participant.signedIn`,
 * which is the *latest* value and therefore true for anybody who ever signed in. The date-scoped read
 * is the whole reason (c) exists.
 */
export function participantsToCloseOut(date = venueCalendarDay()): string[] {
  const { participants } = tournamentEngine.getParticipants({}) ?? {};
  return stillSignedInOnDate(participants, date);
}

export function closeTheDay(replaceTableData: () => void): void {
  const participantIds = participantsToCloseOut();

  if (!participantIds.length) {
    // Says "nobody is signed in", never silently succeeds — an action that appears to do something
    // and does nothing teaches operators to press it twice.
    tmxToast({ message: t('pages.participants.closeTheDayNobody'), intent: 'is-info' });
    return;
  }

  confirmModal({
    query: t('pages.participants.closeTheDayConfirm', { count: participantIds.length }),
    okAction: () =>
      mutationRequest({
        methods: [{ method: MODIFY_SIGN_IN_STATUS, params: { signInState: SIGNED_OUT, participantIds } }],
        callback: (result: any) => {
          if (result.success) replaceTableData();
        },
      }),
  });
}

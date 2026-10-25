import sourceEnglish from 'i18n/locales/en.json';
import { t } from 'i18n';

/**
 * The score entry dialog's own words, keyed exactly as courthive-components' `SCORE_ENTRY_TEXT`.
 *
 * Read from the bundled English so the key list has one home: a key added there for a new string in the
 * dialog is translated by adding it to `modals.scoreEntry` and to courthive-i18n, with nothing to change
 * here.
 */
const SCORE_ENTRY_KEYS = Object.keys(sourceEnglish.modals.scoreEntry);

/**
 * Every label the dialog takes: the status names, the scope refusal, and each of its own strings.
 *
 * `skipInterpolation` hands the dialog its `{{placeholders}}` unfilled; the dialog fills them with the
 * participant, status or score it is showing.
 */
export function getScoreEntryLabels(): Record<string, string> {
  const own = Object.fromEntries(
    SCORE_ENTRY_KEYS.map((key) => [key, t(`modals.scoreEntry.${key}`, { skipInterpolation: true })]),
  );
  return {
    ...own,
    RETIRED: t('modals.scoring.retired'),
    WALKOVER: t('modals.scoring.walkover'),
    DEFAULTED: t('modals.scoring.defaulted'),
    ABANDONED: t('modals.scoring.abandoned'),
    CANCELLED: t('modals.scoring.cancelled'),
    INCOMPLETE: t('modals.scoring.incomplete'),
    SUSPENDED: t('modals.scoring.suspended'),
    IN_PROGRESS: t('modals.scoring.inProgress'),
    AWAITING_RESULT: t('modals.scoring.awaitingResult'),
    DEAD_RUBBER: t('modals.scoring.deadRubber'),
    CHALLENGED: t('modals.scoring.challenged'),
    statusUnavailable: t('modals.scoring.statusUnavailable', { status: '{{status}}' }),
  };
}

import { DEFAULT_SCHEDULE_CELL_CONFIG } from 'courthive-components';
import { t } from 'i18n';

// Rebuilt at render time so a locale change never leaves a module-level English snapshot.
export function getScheduleAnnotationLabels() {
  return {
    NOT_BEFORE: {
      label: t('schedule.timeModifiers.NOT_BEFORE.label'),
      short: t('schedule.timeModifiers.NOT_BEFORE.short'),
    },
    FOLLOWED_BY: {
      label: t('schedule.timeModifiers.FOLLOWED_BY.label'),
      short: t('schedule.timeModifiers.FOLLOWED_BY.short'),
    },
    NEXT_AVAILABLE: {
      label: t('schedule.timeModifiers.NEXT_AVAILABLE.label'),
      short: t('schedule.timeModifiers.NEXT_AVAILABLE.short'),
    },
    AFTER_REST: {
      label: t('schedule.timeModifiers.AFTER_REST.label'),
      short: t('schedule.timeModifiers.AFTER_REST.short'),
    },
    TO_BE_ANNOUNCED: {
      label: t('schedule.timeModifiers.TO_BE_ANNOUNCED.label'),
      short: t('schedule.timeModifiers.TO_BE_ANNOUNCED.short'),
    },
    RAIN_DELAY: {
      label: t('schedule.timeModifiers.RAIN_DELAY.label'),
      short: t('schedule.timeModifiers.RAIN_DELAY.short'),
    },
  };
}

export function getScheduleCellConfig() {
  return { ...DEFAULT_SCHEDULE_CELL_CONFIG, timeModifierLabels: getScheduleAnnotationLabels() };
}

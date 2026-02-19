import { t } from 'i18n';
import { listPicker } from './listPicker';

export function scheduleSetMatchUpStatus({ callback }: { callback?: (result: any) => void }): void {
  const options = [
    { label: t('schedule.called'), value: 'called' },
    { label: t('schedule.oncourt'), value: 'oncourt' },
    { label: t('schedule.warmingup'), value: 'warmingup' },
    { label: t('schedule.suspended'), value: 'suspended' },
    { label: t('schedule.abandoned'), value: 'abandoned' },
    { label: t('schedule.raindelay'), value: 'raindelay' },
    { label: t('schedule.clear'), value: 'clear' },
  ];
  listPicker({ options, callback, isOpen: true } as any);
}

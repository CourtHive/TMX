import { lang } from 'services/translator';
import { listPicker } from './listPicker';

export function scheduleSetMatchUpStatus({ callback }) {
  const options = [
    { label: lang.tr('schedule.called'), value: 'called' },
    { label: lang.tr('schedule.oncourt'), value: 'oncourt' },
    { label: lang.tr('schedule.warmingup'), value: 'warmingup' },
    { label: lang.tr('schedule.suspended'), value: 'suspended' },
    { label: lang.tr('schedule.abandoned'), value: 'abandoned' },
    { label: lang.tr('schedule.raindelay'), value: 'raindelay' },
    { label: lang.tr('schedule.clear'), value: 'clear' },
  ];
  listPicker({ options, callback, isOpen: true });
}

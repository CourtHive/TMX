import { lang } from 'services/translator';
import { listPicker } from './listPicker';

export function scheduleSetMatchUpHeader({ callback } = {}) {
  let options = [
    { label: lang.tr('schedule.matchestime'), value: 'matchestime' },
    { label: lang.tr('schedule.notbefore'), value: 'notbefore' },
    { label: lang.tr('schedule.followedby'), value: 'followedby' },
    { label: lang.tr('schedule.afterrest'), value: 'afterrest' },
    { label: lang.tr('schedule.raindelay'), value: 'raindelay' },
    { label: lang.tr('schedule.tba'), value: 'tba' },
    { label: lang.tr('schedule.nextavailable'), value: 'next' },
    { label: lang.tr('schedule.clear'), value: 'clear' }
  ];

  listPicker({ options, callback, isOpen: true });
}

/**
 * Time picker modal with 12-hour clock format.
 * Uses timepicker-ui library with accept callback and time format conversion.
 */
import { timepickerConfig } from 'config/timepickerConfig';
import { isFunction } from 'functions/typeOf';
import { TimepickerUI } from 'timepicker-ui';
import { t } from 'i18n';

function resolveTheme(): ReturnType<typeof timepickerConfig.get>['theme'] {
  const override = timepickerConfig.get().theme;
  if (override) return override;
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : undefined;
}

function timepickerLabels() {
  return {
    am: t('timepicker.am'),
    pm: t('timepicker.pm'),
    ok: t('common.ok'),
    cancel: t('common.cancel'),
    time: t('timepicker.selectTime'),
    mobileTime: t('timepicker.enterTime'),
    mobileHour: t('timepicker.hour'),
    mobileMinute: t('timepicker.minute'),
    clear: t('timepicker.clear'),
  };
}

type TimePickerParams = {
  time?: string;
  options?: any;
  callback?: (result: { time: string }) => void;
};

export function timePicker({ time, options, callback }: TimePickerParams = {}): void {
  const timeValue = document.getElementById('timevalue') as HTMLInputElement;
  timeValue.value = regularTime(time);
  const theme = resolveTheme();
  const tpu = new TimepickerUI(document.getElementById('timepicker')!, {
    clock: { type: '12h', autoSwitchToMinutes: true },
    ...(theme && { ui: { theme } }),
    labels: timepickerLabels(),
    callbacks: {
      onConfirm: () => {
        const value = timeValue.value;
        if (isFunction(callback) && callback) {
          callback({ time: value });
        }
        tpu.destroy();
      },
    },
    ...options,
  });
  tpu.create();
  tpu.open();
}

function regularTime(value?: string, env?: any): string {
  const time = splitTime(value || env?.schedule?.default_time);
  if (time.ampm) return value || '';
  if (Number(time.hours) > 12) {
    time.hours = (Number(time.hours) - 12).toString();
    time.ampm = 'PM';
  } else if (time.hours === '12') {
    time.ampm = 'PM';
  } else if (time.hours === '00') {
    time.hours = '12';
    time.ampm = 'AM';
  } else {
    time.ampm = 'AM';
  }
  return `${time.hours || '12'}:${time.minutes || '00'} ${time.ampm}`;
}

function splitTime(value: string = '00:00'): { hours: string; minutes: string; ampm?: string } {
  const parts = value?.split(' ') || [];
  const timeParts = parts[0]?.split(':') || [];
  return {
    hours: timeParts[0] || '00',
    minutes: timeParts[1] || '00',
    ampm: parts[1],
  };
}

/**
 * Time picker modal with 12-hour clock format.
 * Uses timepicker-ui library with accept callback and time format conversion.
 */
import { isFunction } from 'functions/typeOf';
import { TimepickerUI } from 'timepicker-ui';

type TimePickerParams = {
  time?: string;
  options?: any;
  callback?: (result: { time: string }) => void;
};

export function timePicker({ time, options, callback }: TimePickerParams = {}): void {
  const timeValue = document.getElementById('timevalue') as HTMLInputElement;
  timeValue.value = regularTime(time);
  const tpu = new TimepickerUI(document.getElementById('timepicker')!, {
    clock: { type: '12h' },
    behavior: { autoSwitchToMinutes: true },
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

import { isFunction } from 'functions/typeOf';
import { TimepickerUI } from 'timepicker-ui';

export function timePicker({ time, callback } = {}) {
  const timepicker = document.getElementById('timepicker');
  const timeValue = document.getElementById('timevalue');
  timeValue.value = regularTime(time);
  const tpu = new TimepickerUI(document.getElementById('timepicker'), {
    switchToMinutesAfterSelectHour: true,
    clockType: '12h'
  });
  tpu.create();
  tpu.open();
  timepicker.addEventListener('accept', () => {
    const value = timeValue.value;
    isFunction(callback) && callback({ time: value });
    tpu.destroy();
  });
}

function regularTime(value, env) {
  let time = splitTime(value || env?.schedule?.default_time);
  if (time.ampm) return value;
  if (time.hours > 12) {
    time.hours -= 12;
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

function splitTime(value) {
  value = value || '00:00';
  let o = {},
    time = {};
  ({ 0: o.time, 1: o.ampm } = (value && value.split(' ')) || '');
  ({ 0: time.hours, 1: time.minutes } = (o.time && o.time.split(':')) || '');
  time.ampm = o.ampm;
  return time;
}

type TimerControls = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
};

export function tmxTimer(callback: () => void, delay = 0): TimerControls {
  let remaining = delay;
  let timerId: number;
  let start: Date;

  const pause = () => {
    remaining -= new Date().getTime() - start.getTime();
    window.clearTimeout(timerId);
  };
  const reset = () => (remaining = delay);
  const resume = () => {
    start = new Date();
    timerId = window.setTimeout(function () {
      remaining = delay;
      callback();
    }, remaining);
  };

  resume();

  return { pause, resume, reset };
}

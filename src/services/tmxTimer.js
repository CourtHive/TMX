export function tmxTimer(callback, delay = 0) {
  let remaining = delay;
  let timerId;
  let start;

  const pause = () => {
    remaining -= new Date() - start;
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

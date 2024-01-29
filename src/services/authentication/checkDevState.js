export function checkDevState() {
  const notLocal = !window.location.host.startsWith('localhost');
  if (notLocal && window['dev']) {
    delete window['dev'];
    console.log('%c dev cancelled', 'color: cyan');
  }
}

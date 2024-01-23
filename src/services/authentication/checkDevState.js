export function checkDevState() {
  const notLocal = !window.location.host.startsWith('localhost');
  if (notLocal) {
    delete window['dev'];
    console.log('%c dev cancelled', 'color: cyan');
  }
}

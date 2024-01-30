export function checkDevState() {
  const notLocal = !window.location.host.startsWith('localhost');
  const isGithub = window.location.host.endsWith('github.io');
  if (!isGithub && notLocal && window['dev']) {
    delete window['dev'];
    console.log('%c dev cancelled', 'color: cyan');
  }
}

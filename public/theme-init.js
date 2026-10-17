// Applies the saved theme before first paint, so a dark-theme user never sees a light flash. A file
// rather than an inline <script> so the Content Security Policy needs no 'unsafe-inline' or hash
// (csp.policy.mjs). Keep it tiny and synchronous: it runs before the bundle.
(function () {
  var pref = localStorage.getItem('tmx_theme') || 'dark';
  var theme = pref;
  if (pref === 'system') {
    theme = globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();

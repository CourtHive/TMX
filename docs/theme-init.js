// Applies the saved theme before first paint, so a dark-theme user never sees a light flash. A file
// rather than an inline <script> so the Content Security Policy needs no 'unsafe-inline' or hash
// (csp.policy.mjs). Keep it tiny and synchronous: it runs before the bundle.
//
// data-palette picks the palette for the resolved mode. The bundle re-applies it through
// themeService.applyTheme (which validates the id); an unknown id here matches no palette block, so the
// mode's default palette shows — never an unstyled page.
(function () {
  var pref = localStorage.getItem('tmx_theme') || 'dark';
  var theme = pref;
  if (pref === 'system') {
    theme = globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  var palette = localStorage.getItem('tmx_palette_' + theme) || (theme === 'dark' ? 'midnight' : 'courtside');
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-palette', palette);
})();

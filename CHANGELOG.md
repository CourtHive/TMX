# Changelog

## [4.0.1](https://github.com/CourtHive/TMX/compare/v4.0.0...v4.0.1) (2026-05-18)


### Bug Fixes

* **stalenessGuard:** silence + gate the inactivity check so local-only tournaments don't toast ([638507e](https://github.com/CourtHive/TMX/commit/638507e0c8ec41075508072f7554c47b81ccb1b8))

## [4.0.0](https://github.com/CourtHive/TMX/compare/v3.4.0...v4.0.0) (2026-05-18)


### ⚠ BREAKING CHANGES

* **i18n:** TMX now requires CFS to be reachable for non-English locales. If CFS is unreachable AND the locale isn't already cached in localStorage, the user sees English keys with their translation falling back through i18next.fallbackLng. The runtime-loader path silently no-ops on network failure rather than throwing, so the UI stays usable.

### Features

* **chat:** remember the chat panel's last position across sessions ([9d4d913](https://github.com/CourtHive/TMX/commit/9d4d91350e019e6835ca1cab32b1f390dc0d5cbd))
* **common:** shared view-toggle + setTabHeader banner helpers ([e3d7f9e](https://github.com/CourtHive/TMX/commit/e3d7f9e025a279710b2da8c51bbb65f827514aa3))
* **events:** card-grid integration with banner-style tab header ([85980e7](https://github.com/CourtHive/TMX/commit/85980e786dc540a5a4afaf351aa1ac52b6c18b26))
* **i18n:** drop non-English bundled locales, fetch at runtime only ([adefbfa](https://github.com/CourtHive/TMX/commit/adefbfaa5f7b7f892272bfe180171772e11b057a))
* **i18n:** resolve boot language from provider default + mark user-explicit picks ([76de296](https://github.com/CourtHive/TMX/commit/76de296b9a343405cd3ed6e1d8d0ab2bc17aa6bc))
* **reports:** promote Reports tab to production, drop the beta flag ([9ed40be](https://github.com/CourtHive/TMX/commit/9ed40be5d0387151c50f88499ebc03855a3b5e41))
* **scalings:** histogram on overview + compact sparkline in participants header ([167973e](https://github.com/CourtHive/TMX/commit/167973ebd9971f6032fe51cd5ad649b3bf35183c))
* **schedule2:** add (x) clear button to header "Search schedule" field ([9327053](https://github.com/CourtHive/TMX/commit/93270539f4d062865c3efb432fb165ac19168b76))
* **tournaments:** card-grid redesign with two-row banner strip ([6811f61](https://github.com/CourtHive/TMX/commit/6811f6135cef7dd663343f2ca083fac6181aadd2))
* **venues:** card-grid integration + venue detail page with court cards ([11cb727](https://github.com/CourtHive/TMX/commit/11cb727f292aa015a830d35c6f1c950d524ad940))


### Bug Fixes

* **baseApi:** honor silenceErrors on the error response interceptor ([2bf7378](https://github.com/CourtHive/TMX/commit/2bf73783ca6f5b5f942acd465a9fa40936ab5b9d))
* **deps:** update dependency focus-trap to v8.2.1 ([319108f](https://github.com/CourtHive/TMX/commit/319108ffe7036c3f57deecfbd4c667c91193717d))
* **deps:** update dependency focus-trap to v8.2.1 ([b83578d](https://github.com/CourtHive/TMX/commit/b83578dadf8d07bcf9faa21bd5dade1f1b803f29))
* **deps:** update dependency qs to v6.15.2 ([26480fc](https://github.com/CourtHive/TMX/commit/26480fc030e09708a9a3047aa172bbff39fc893e))
* **deps:** update dependency qs to v6.15.2 ([b08c2d5](https://github.com/CourtHive/TMX/commit/b08c2d5d8afbf208638f0112414091849cf71f9c))
* **entries:** widen Grouping column so segment badges aren't clipped to "…" ([7ba044f](https://github.com/CourtHive/TMX/commit/7ba044f3da5f0391785c4d1d1b03dd640c2e5016))
* **i18n:** language switch actually takes effect on reload ([ec5cc44](https://github.com/CourtHive/TMX/commit/ec5cc447dfc71686a663962260719c04311345a6))
* **i18n:** selectIdiom force-refreshes the manifest on open ([0a62822](https://github.com/CourtHive/TMX/commit/0a628225f5633745e640fff803cec5e26caadc3d))
* **matchUps:** re-apply filter-active pulse on tab re-mount ([4fe1712](https://github.com/CourtHive/TMX/commit/4fe171244a063a654dac60a20612f99e5313b4de))
* **overviewTab:** dashboard panel overflow + dark-mode select ([1fd0515](https://github.com/CourtHive/TMX/commit/1fd05151eac66f93ebe435dd202a2e2356e555e7))
* **providerSwitcher:** consolidate #provider click into a single handler ([4d8fb31](https://github.com/CourtHive/TMX/commit/4d8fb31aa2e5b34bf6cf607b93e2db8322a0b31d))
* **providerSwitcher:** land the actual consolidated click handler ([0e6a4c9](https://github.com/CourtHive/TMX/commit/0e6a4c9ffa39a2578f7d404d6e241cf92dcec592))
* **providerSwitcher:** only open switcher when already on /tournaments ([349aac3](https://github.com/CourtHive/TMX/commit/349aac3511bf862e70128b483fcaa3ae3ff119a3))
* **scalings:** seed participants header on tableBuilt, move selector right of chart ([5a71b53](https://github.com/CourtHive/TMX/commit/5a71b536ee02e471d92ec1f866e9eedc43bb9e23))
* **schedule2:** hide the issues warning button in profile view ([bc7fbb5](https://github.com/CourtHive/TMX/commit/bc7fbb52eee491da63b6b8d9fe51aefbfd90787e))
* **schedule2:** switch Search schedule to type=text to drop native browser (x) ([81ce18d](https://github.com/CourtHive/TMX/commit/81ce18dce68385d8b46ffc9fab01c2c575268c45))
* **theme:** introduce --tmx-fill-* vars for AA-safe white-text-on-color backgrounds ([67b1eea](https://github.com/CourtHive/TMX/commit/67b1eea9ac60ff1bf33b16b561545ea663c2aece))

## [3.4.0](https://github.com/CourtHive/TMX/compare/v3.3.0...v3.4.0) (2026-05-16)


### Features

* **schedule2:** persist matchUp catalog filters across tab navigation ([1730c75](https://github.com/CourtHive/TMX/commit/1730c75c992295cd6710c8b6204609f0f456393f))

# Changelog

## [5.0.1](https://github.com/CourtHive/TMX/compare/v5.0.0...v5.0.1) (2026-05-22)


### Bug Fixes

* **deps:** update dependency courthive-components to v1.8.0 ([41f524d](https://github.com/CourtHive/TMX/commit/41f524d51aaff63c6f5d7d503ed4e8a998a0396c))

## [5.0.0](https://github.com/CourtHive/TMX/compare/v4.1.0...v5.0.0) (2026-05-21)


### ⚠ BREAKING CHANGES

* **policies:** BUILTIN_POLICIES no longer includes the 5 federation ranking policies. Any TMX install that referenced them by built-in id (builtin-ranking-points-usta-junior, -tennis-europe, -lta, -tennis- australia, -tennis-canada) will see the id resolve to nothing in loadUserPolicies. Existing user-saved copies in IndexedDB are unaffected — they continue to load.

### Features

* **overview:** tournament categories editor + dates panel full-width ([5b0b401](https://github.com/CourtHive/TMX/commit/5b0b4013e47f9547fd6eb890b0dbdd7d1c87cada))
* **policies:** public policy catalog browser ([064341e](https://github.com/CourtHive/TMX/commit/064341eabd9b13696207d637791f1abe8482181b))
* **policies:** remove federation builtins from TMX policy catalog ([ef08419](https://github.com/CourtHive/TMX/commit/ef08419451f5c76c1a9876f329906b92e2acea36))
* **provider:** multi-provider session switcher for N&gt;1 users (Phase 2 — TMX) ([0564400](https://github.com/CourtHive/TMX/commit/056440039663d1d14ab763197c06c9b74a17f124))
* **schedule2:** collapsible scheduling results sections + readable badges ([4c5b085](https://github.com/CourtHive/TMX/commit/4c5b085f54f27ac73ce75a5eca08f869b57180b9))
* **schedule2:** reorder view switcher + tournament-scoped persistence ([2c3cb88](https://github.com/CourtHive/TMX/commit/2c3cb88e76aa2fad9a2136149ab2112393f7c904))
* **schedule2:** scheduleToast wrapper for bottom-center toasts above modal footer ([1ca42c6](https://github.com/CourtHive/TMX/commit/1ca42c6f46448da1efae6e25b29612a3bd6a6bbf))
* **schedule2:** unify Scheduled-tab cards + hide cross-date catalog items ([cbe9858](https://github.com/CourtHive/TMX/commit/cbe98580ca4a563f3f35ed43ca3168da5cb6c6ec))


### Bug Fixes

* **categories-editor:** inset padding on modal content body ([63fcb16](https://github.com/CourtHive/TMX/commit/63fcb16c3bcb79528a5d53c3e403cfc1f99a522b))
* **deps:** update dependency courthive-components to v1.7.1 ([2612a21](https://github.com/CourtHive/TMX/commit/2612a21141d80ae15ea371fc22f0f0171f6773e6))
* **deps:** update dependency courthive-components to v1.8.0 ([fb1b800](https://github.com/CourtHive/TMX/commit/fb1b800f88dd3e2c5dc0b32b6e5b8485ebd1b95c))
* **deps:** update dependency tods-competition-factory to v4.0.0 ([dc98c0a](https://github.com/CourtHive/TMX/commit/dc98c0a14196394df4e084e3a93c30d0f65574c7))
* **deps:** update dependency tods-competition-factory to v4.1.0 ([af819c1](https://github.com/CourtHive/TMX/commit/af819c1839d4dee817add10362625b79cc1ce52e))
* **provider:** honor impersonation handoff without association lookup ([98b6e5f](https://github.com/CourtHive/TMX/commit/98b6e5f1e883e9744a865e1b2094a67345f58891))
* **provider:** silence effective-config 403 toast on impersonation ([c24f962](https://github.com/CourtHive/TMX/commit/c24f96292aa14675beac3756b57d8a50ef26d803))
* **toaster:** apply px unit to offset values so non-zero offsets work ([dcd5f57](https://github.com/CourtHive/TMX/commit/dcd5f5717fa9af49e076d5e6e3543dc1a165248b))
* **tournaments-header:** neutralize banner background on header bar ([08a21a3](https://github.com/CourtHive/TMX/commit/08a21a3b281f7880eef98d9eb37befd76238753d))

## [4.1.0](https://github.com/CourtHive/TMX/compare/v4.0.1...v4.1.0) (2026-05-19)


### Features

* **drawsView:** per-card visualizations with display-options popover ([61847b7](https://github.com/CourtHive/TMX/commit/61847b7041d23ed7df1363493c8fffe0a4e5e913))
* **drawsView:** use competitiveness donut on draw cards ([926a78b](https://github.com/CourtHive/TMX/commit/926a78b7f7bb00beff8bf0b5cca5197fa5f6aa14))
* **eventsTab:** card-grid view for the per-event draws list ([9cc4e1b](https://github.com/CourtHive/TMX/commit/9cc4e1b3ea29945a4b41dd69c7195a9792bb64d9))
* **eventsTab:** two-row draws view — header with toggle, controls below ([a909899](https://github.com/CourtHive/TMX/commit/a9098997779c4f7c1e715fc6838dcf0697e45526))
* **filters:** highlight currently-active filters inside popover ([ed95f53](https://github.com/CourtHive/TMX/commit/ed95f53de268d777ab9027ac1354dfd48582d3ab))
* **venues:** add website + image URL inputs to edit venue drawer ([a5a1be0](https://github.com/CourtHive/TMX/commit/a5a1be019cd82d66fe9bdfa51caac951e0113c31))
* **venues:** address fields on add + edit venue drawers ([e1e5d21](https://github.com/CourtHive/TMX/commit/e1e5d21613bf5663a90d5c403f8214748084c9c2))
* **venues:** website column + URL fields on add venue drawer ([69ed4ad](https://github.com/CourtHive/TMX/commit/69ed4adfc41d243b087984bf9a9e8494bd6ff0e2))
* **views:** default to table view; hide card display options in table mode ([f2a85a9](https://github.com/CourtHive/TMX/commit/f2a85a90dc680bd605633e67e45ebd87b8b516e5))


### Bug Fixes

* **compositions:** publish-extension snapshots full configuration ([5d0b652](https://github.com/CourtHive/TMX/commit/5d0b6529f38762795fe3f3a44f74ada5737dfe53))
* **compositions:** user compositions resolve across draws + load colors ([249cca9](https://github.com/CourtHive/TMX/commit/249cca9e087cd0b97f0a00e64ab8872e0376bb94))
* **deps:** update dependency @courthive/provider-config to ^0.2.0 ([9191d8a](https://github.com/CourtHive/TMX/commit/9191d8a35507cc835e1757bcf031e362f1b47f40))
* **deps:** update dependency courthive-components to v1.6.0 ([8581ee2](https://github.com/CourtHive/TMX/commit/8581ee256feacf02a108ffb988f0e47b09f405a6))
* **deps:** update dependency pdf-factory to v0.6.0 ([498852a](https://github.com/CourtHive/TMX/commit/498852acd322f682b9ab124453c8067d045b921f))
* **deps:** update dependency pdf-factory to v0.6.1 ([3929b65](https://github.com/CourtHive/TMX/commit/3929b65bc932599618e7cb2d4fb9001c05a58a26))
* **deps:** update dependency tods-competition-factory to v3.8.0 ([8594a5b](https://github.com/CourtHive/TMX/commit/8594a5bda6b70d62065bb13e7c15118d9878c2ad))
* **deps:** update dependency tods-competition-factory to v3.9.0 ([149fb9b](https://github.com/CourtHive/TMX/commit/149fb9b3dc69eb57abdd73e8fa9c2925e5ebaeab))
* **drawsView:** fetch competitiveness with contextProfile; add e2e spec ([6ab394a](https://github.com/CourtHive/TMX/commit/6ab394adb9053221fee0837e51595cffe129c450))
* **drawsView:** histogram + competitiveness + sunburst data plumbing ([0fceea8](https://github.com/CourtHive/TMX/commit/0fceea846c832c72f00f5b6b70831886a6b64ea7))
* **drawsView:** pass enriched structure to sunburst transformer ([cdc15e1](https://github.com/CourtHive/TMX/commit/cdc15e16752a3e2ee354cf5d80e71d3014b52c4f))
* **eventsTab:** wire event card click ([cc8ef15](https://github.com/CourtHive/TMX/commit/cc8ef15fc598f1f511daddc19a55dff57b04e5fb))
* **eventsView:** keep cards/table toggle right-aligned on every render ([8710d04](https://github.com/CourtHive/TMX/commit/8710d04cd745e31384ab9fe419e1f2ee0b705747))
* **notesEditor:** wider modal + scroll-contained editor area ([c2507fb](https://github.com/CourtHive/TMX/commit/c2507fb2ca4f5951ac005f09efc361a6a29b3f16))
* **tournaments:** remove border from page header ([b5fda73](https://github.com/CourtHive/TMX/commit/b5fda73096e6844a4942ec2633b68cd36287e23d))
* **venues:** replace country-code free-text with country selector ([c405bc1](https://github.com/CourtHive/TMX/commit/c405bc1ad76dd541b55aa0629a1af8526264dc39))

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

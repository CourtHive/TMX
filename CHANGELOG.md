# Changelog

## [7.0.0](https://github.com/CourtHive/TMX/compare/v6.0.1...v7.0.0) (2026-06-01)


### ⚠ BREAKING CHANGES

* **deps:** consume courthive-components v3.0.0 + factory 5.0.0; rename Temporal* → Availability*
* import AvailabilityEngine from factory 5.0.0

### Features

* **active-rating:** auto-switch or prompt when loaded tournament lacks active rating ([1477741](https://github.com/CourtHive/TMX/commit/1477741d9fbbc58cab9096367e36c5f277fed9f6))
* **active-rating:** nicer prompt layout — card-style chips for available + inactive ratings ([f0ad0e6](https://github.com/CourtHive/TMX/commit/f0ad0e6b40befb1532c2c3380aa7ae0986321db2))
* **active-rating:** re-prompt when the tournament's rating set changes ([ad6acd8](https://github.com/CourtHive/TMX/commit/ad6acd8ad9216c515d9bed0292bc58b4e7f389fc))
* **api:** handle /factory/save 400 + validationErrors with details modal ([3167c6a](https://github.com/CourtHive/TMX/commit/3167c6ad70b14fa5dc84dbdc4268d51b66ae4f13))
* **api:** handle /factory/save 400 + validationErrors with details modal ([33b5ca6](https://github.com/CourtHive/TMX/commit/33b5ca6bc2c60929b107e3d82e7769dbc0137c3f))
* **auth:** self-service recovery email modal in main menu ([#1104](https://github.com/CourtHive/TMX/issues/1104)) ([d18383c](https://github.com/CourtHive/TMX/commit/d18383c18ef051f48d38bbdfe15101d4a106050a))
* **config:** apply provider themeTokens + stylesheetUrl in applyBranding ([7b8bb63](https://github.com/CourtHive/TMX/commit/7b8bb637887d15161a587f8e3cf855adba21a500))
* **deps:** consume courthive-components v3.0.0 + factory 5.0.0; rename Temporal* → Availability* ([2ed5617](https://github.com/CourtHive/TMX/commit/2ed5617f067f461a2324ad9419f1a01a39d7ade9))
* **draws:** circle variant for the minimap toggle ([c6cc631](https://github.com/CourtHive/TMX/commit/c6cc631fbc48004a905c8d0d95745d1854367e41))
* **draws:** persistable show/hide toggle for the bracket minimap ([727e3b3](https://github.com/CourtHive/TMX/commit/727e3b3d4b5652b4fa5a0c3ef25958e8aaf889ba))
* **draws:** viewport-fit minimap height, 8-segment threshold for ≥128 draws, true-circle toggle ([74ae34c](https://github.com/CourtHive/TMX/commit/74ae34c641031cbef805860cc1632aeeb9d29e9f))
* **draws:** wire bracket minimap navigator into the draw view ([3337198](https://github.com/CourtHive/TMX/commit/333719895f18587befc0d2d9d3659bc6ce5da27e))
* **import:** map a column to participantRole (COMPETITOR, COACH, MEDICAL, …) ([712fae4](https://github.com/CourtHive/TMX/commit/712fae4ac5298c4833152d7d59f3fc848c382e4d))
* **import:** team affiliation + jersey number mapping in participant wizard ([043d639](https://github.com/CourtHive/TMX/commit/043d63926bef79438b72cc1d138397e93261d57d))
* **matchups:** gender-tinted Type chips + future/past coloring for date and time columns ([d42d6c8](https://github.com/CourtHive/TMX/commit/d42d6c8e82e27cef10be7bbfa5aa66d0d2e259a1))
* **participantProfile:** team affiliation + jersey number chips ([76f9660](https://github.com/CourtHive/TMX/commit/76f9660c563ab0953317af8a43fc5645b262482d))
* **participants:** add Staff view + jersey # + team affiliation columns ([6b717ab](https://github.com/CourtHive/TMX/commit/6b717ab4aa30beb949117f0702b51b3d9857a3ee))
* **participants:** team profile modal — roster + coaches + staff view ([9907cd4](https://github.com/CourtHive/TMX/commit/9907cd426b72834d74865c5891bac3fd7420b82e))
* **participants:** wire PHYSIO + TRAINER roles into wizard + Staff view ([b214249](https://github.com/CourtHive/TMX/commit/b214249e300eafe0ca50dcfbce45d7daf83fc162))
* **practice:** manage-practice-registrations modal ([f5b93b3](https://github.com/CourtHive/TMX/commit/f5b93b35e173b3f1d3426f75c097e533315616d5))
* **practice:** open manage-registrations modal from availability-grid popover ([354b8b5](https://github.com/CourtHive/TMX/commit/354b8b549bad647d6b82cc5bcd04624b19722d39))
* **practice:** tournament-wide default capacity setting on overview ([1bc60bd](https://github.com/CourtHive/TMX/commit/1bc60bd3edbf3ecf47e2ce4e277ed8d9a354794b))
* **registrations:** director-side registrations tab (hiveid phase 2-B) ([1ab6041](https://github.com/CourtHive/TMX/commit/1ab6041de81929139d75e2fd97c5132ac767dd4b))
* **registrations:** nav icon + visibility gates (hiveid phase 2-B.1) ([56b264c](https://github.com/CourtHive/TMX/commit/56b264c1942b3b0c40ddc2fda2bd1b53357f81dc))
* **schedule2:** footer min cell-width stepper ([946bb1e](https://github.com/CourtHive/TMX/commit/946bb1e8bae03b4236cf33887c4c6bf4f3c12445))
* **schedule2:** scheduled-panel parity with unscheduled catalog ([eb51a32](https://github.com/CourtHive/TMX/commit/eb51a324b252d8031b655e246011ffbc0bcf3117))
* **schedule2:** search field on the Scheduled catalog panel ([8e34573](https://github.com/CourtHive/TMX/commit/8e34573f58f9612f7fbc448ae19805bde978171a))
* **schedule2:** surface practice registrant names on active strip ([e4fb35c](https://github.com/CourtHive/TMX/commit/e4fb35c78969f0b8ce0e8f050f089d279cd116b9))
* **schedule2:** surface stage + round-offset on catalog cards ([649b5e8](https://github.com/CourtHive/TMX/commit/649b5e81730c943c683eb3ca5ba4d23a14fcb775))
* **schedule2:** symmetrical (n) badge on the Unscheduled tab ([92cb181](https://github.com/CourtHive/TMX/commit/92cb181def154afc982cd4b61bff48f6dff7e0ee))
* **scheduling:** /scheduling/:date?/:mode? workspace shell + queue service ([be14d63](https://github.com/CourtHive/TMX/commit/be14d6385b12744f85b62549f97281cf7cd4a8b6))
* **scheduling:** 301 redirects from /schedule2/* and /venues/availability ([250f46b](https://github.com/CourtHive/TMX/commit/250f46b4df83e7462256d4fa6eddd3fd25120c8a))
* **scheduling:** align painter dirty state with workspace queue ([eb80586](https://github.com/CourtHive/TMX/commit/eb80586c434ab9db33769d93f8173855f15eee24))
* **scheduling:** match schedule2 control-bar shape with 3-segment switcher ([1b417e8](https://github.com/CourtHive/TMX/commit/1b417e8bafa828d40bc0a74456a7f60e4ce0d602))
* **scheduling:** row [#2](https://github.com/CourtHive/TMX/issues/2).7 — confirm modal when drop won't complete before block ([6aac5c4](https://github.com/CourtHive/TMX/commit/6aac5c4223252ca6a3d5d49f24cd68c64c3e9b05))
* **scheduling:** row [#3](https://github.com/CourtHive/TMX/issues/3)(a) — always-visible capacity meter in profile ([46440ca](https://github.com/CourtHive/TMX/commit/46440ca7054329d89171dc039cbf387d712beaf3))
* **scheduling:** wire AvailabilityGrid into workspace via queueService ([005ff31](https://github.com/CourtHive/TMX/commit/005ff314a50e87ad9412aef4476546218aa7b488))
* **scheduling:** wire renderProfileView + renderGridView into workspace ([323eb5e](https://github.com/CourtHive/TMX/commit/323eb5e0d24585154aeba2587c8dba0008e784cb))
* **scheduling:** wire row [#1](https://github.com/CourtHive/TMX/issues/1) + row [#2](https://github.com/CourtHive/TMX/issues/2) (workspace integration debut) ([5ac94c5](https://github.com/CourtHive/TMX/commit/5ac94c5cf7fd2e5d1663746fc48740db051ea8c6))
* **scheduling:** workspace queue tests + UX polish ([85a997d](https://github.com/CourtHive/TMX/commit/85a997d7531704cd0a24afe98a6a9db42ed87487))
* stamp matchUp.schedule.calledAt on active-strip drop ([905f993](https://github.com/CourtHive/TMX/commit/905f993c49b4657e1e1d90f6da92d56ef1e119be))
* stamp matchUp.schedule.calledAt on active-strip drop ([a55d793](https://github.com/CourtHive/TMX/commit/a55d7933a3ba48379912351bf752fb5c9c36da23))
* **venues:** default Court Name Base to "Court" in the Add venue drawer ([d2026e5](https://github.com/CourtHive/TMX/commit/d2026e52582115b2bb1a6be86e135bea6c4ece67))


### Bug Fixes

* **chatModal:** align send button to match input height ([3daa6e2](https://github.com/CourtHive/TMX/commit/3daa6e23f5004d1445f34fcfe3cfeb6c48dab0a0))
* **deps:** update dependency @courthive/provider-config to ^0.4.0 ([c76a797](https://github.com/CourtHive/TMX/commit/c76a797703cdbabcedad78b3f1eba49e549bb87c))
* **deps:** update dependency @courthive/provider-config to ^0.4.0 ([c447a5a](https://github.com/CourtHive/TMX/commit/c447a5a5a3a3dc8924b6c4c52e16a3b612226f61))
* **deps:** update dependency courthive-components to v1.10.1 ([9fff352](https://github.com/CourtHive/TMX/commit/9fff352fc4162a2693534e8d89fff14ce82a9df4))
* **deps:** update dependency dexie to v4.4.3 ([a896181](https://github.com/CourtHive/TMX/commit/a89618106d9d52cadb7b329e94c6741ba357d89e))
* **deps:** update dependency pdf-factory to v0.8.2 ([0bbb774](https://github.com/CourtHive/TMX/commit/0bbb77489294d90540a7af9a05a5fc31e2f29d99))
* **deps:** update dependency pdf-factory to v0.8.2 ([0bf463c](https://github.com/CourtHive/TMX/commit/0bf463cdfd3df76f66b472d622000f2c85006b43))
* **dev:** seed engine + render full view in dev.load so parentOrganisation tournaments are usable ([f274dbb](https://github.com/CourtHive/TMX/commit/f274dbbd5163d9d39ed93de924fd5328544acd5b))
* **e2e/40-minimap:** use named-import S so selectors resolve ([680151b](https://github.com/CourtHive/TMX/commit/680151be593abe9803ce0cabad9aa87e4fe494e1))
* **i18n:** use 'regs' for Registrations tab so it doesn't collide with 'reg' ([ad8d6e8](https://github.com/CourtHive/TMX/commit/ad8d6e8585708a2d4d5801a35a41f579b7fc2b27))
* **participants:** drop header filter + sort icons on jersey/affiliation ([0d6590e](https://github.com/CourtHive/TMX/commit/0d6590edeb0aaef76f89b9c803aaa013a40c2826))
* **schedule2:** left-align Min Width stepper next to the issues button ([b73eb24](https://github.com/CourtHive/TMX/commit/b73eb2452d584662e691f07891e3315e2c739a1b))
* **schedule2:** pass scheduleCompletedMatchUps when clearing includes completed ([2b29d0d](https://github.com/CourtHive/TMX/commit/2b29d0d93db5aacf45e5fd584b8c3f532b463e2a))
* **schedule2:** refresh grid in place after Add venue from the grid placeholder ([52dee2b](https://github.com/CourtHive/TMX/commit/52dee2bf9636f7b09d5a2cac655b78525524301b))
* **schedule2:** scheduled-panel adopts unscheduled-catalog header layout ([260948d](https://github.com/CourtHive/TMX/commit/260948d5e793354c2e3402a559964ee3d7e20770))
* **scheduling:** live-strip warnings work when strip date != today ([33cd489](https://github.com/CourtHive/TMX/commit/33cd489f49c588793ee2cd112f8142a6bf531cc1))
* **scheduling:** one Save button, not two — split painter dirty from workspace bar ([8bffd72](https://github.com/CourtHive/TMX/commit/8bffd727102e5c5ff08a64cf7adf5732743c7965))
* **scheduling:** painter inherits workspace's selected date as initialDay ([3630550](https://github.com/CourtHive/TMX/commit/3630550631ca515e3f71fa291b3486bf9d2d554b))
* **scheduling:** surface availability save errors + correct dirty-reset timing ([9143fe2](https://github.com/CourtHive/TMX/commit/9143fe2a93735fa276b54431cf0c9c55659207c9))
* **scheduling:** wire onSave on workspace availability painter ([0b7520f](https://github.com/CourtHive/TMX/commit/0b7520f08e3c53632c32101fd0d1eeba45b7baa9))
* **types:** delete dead keys passed to engine methods that never read them ([4fc3397](https://github.com/CourtHive/TMX/commit/4fc3397e8e85357391c301cfc5ee8db47fe81a66))
* **types:** drop `as any` casts now that DrawDefinition declares flightNumber ([f296fb3](https://github.com/CourtHive/TMX/commit/f296fb3fa026898041e7f356b88b8e45e92ac474))
* **types:** final TMX type-error cleanups (category G) ([75d19f2](https://github.com/CourtHive/TMX/commit/75d19f2446e2f9684f5ccc8e5061a761d7c00782))
* **types:** narrow result envelopes + cast enum unions (categories A+B) ([baf5364](https://github.com/CourtHive/TMX/commit/baf5364a5445ebf8f0dba8e31d750157258e0095))
* **types:** null-safety sweep across TMX consumers of typed engine surface ([f990c74](https://github.com/CourtHive/TMX/commit/f990c74e8e98446ad08c15496f5546360caf5765))
* **types:** providerValue extends factory Organisation ([0dbcb09](https://github.com/CourtHive/TMX/commit/0dbcb09021cd012584312f10ea918fe5d0f30a19))
* **types:** refresh cross-package cast comment in createRatingsTable ([8abccaa](https://github.com/CourtHive/TMX/commit/8abccaa2189fb5c23aa506cc2834e4a82c3052be))
* **types:** widen eventFilter return + narrow activeDates union (category F) ([14ed13f](https://github.com/CourtHive/TMX/commit/14ed13ff32d576789dc44dd58982b2e07a60a147))


### Documentation

* **scheduling:** readme capturing the 7 workspace queue invariants ([2988bb5](https://github.com/CourtHive/TMX/commit/2988bb57edab460f708359fd872995b737d5463b))


### Refactor

* import AvailabilityEngine from factory 5.0.0 ([7061413](https://github.com/CourtHive/TMX/commit/70614130ff5e2ae980f79b760032a829fe629250))

## [6.0.1](https://github.com/CourtHive/TMX/compare/v6.0.0...v6.0.1) (2026-05-26)


### Bug Fixes

* **deps:** update dependency @courthive/provider-config to ^0.3.0 ([80d0015](https://github.com/CourtHive/TMX/commit/80d0015728b475d24fa857df7a74db50d91d6ac1))
* **deps:** update dependency dayjs to v1.11.21 ([d8f3746](https://github.com/CourtHive/TMX/commit/d8f37466ee3942024b17b81c9f95227d096053a2))

## [6.0.0](https://github.com/CourtHive/TMX/compare/v5.2.1...v6.0.0) (2026-05-25)


### ⚠ BREAKING CHANGES

* **policies:** BUILTIN_POLICIES no longer includes the 5 federation ranking policies. Any TMX install that referenced them by built-in id (builtin-ranking-points-usta-junior, -tennis-europe, -lta, -tennis- australia, -tennis-canada) will see the id resolve to nothing in loadUserPolicies. Existing user-saved copies in IndexedDB are unaffected — they continue to load.
* **i18n:** TMX now requires CFS to be reachable for non-English locales. If CFS is unreachable AND the locale isn't already cached in localStorage, the user sees English keys with their translation falling back through i18next.fallbackLng. The runtime-loader path silently no-ops on network failure rather than throwing, so the UI stays usable.
* **schedule:** The /tournament/:id/schedule/:date URL is no longer served by a legacy tab. It now redirects to /tournament/:id/schedule2/:date so any bookmarked URLs keep working.

### Features

* ask TMX assistant panel ([ff4a552](https://github.com/CourtHive/TMX/commit/ff4a552e996575e2c852938d4f98c072cba271b4))
* **auth:** passwordless magic-link login (client) ([4415f82](https://github.com/CourtHive/TMX/commit/4415f8246218383deb8bf0255b77925bcb04e89a))
* **auth:** provider-admin from scoped role + provisioner, not global admin ([#1074](https://github.com/CourtHive/TMX/issues/1074)) ([978da22](https://github.com/CourtHive/TMX/commit/978da226cc7cfe936dcb9ea33916be9889f2c90b))
* **auth:** silent access-token refresh via rotating refresh token ([77cb9ad](https://github.com/CourtHive/TMX/commit/77cb9adf600d67a37323a685f10747a2aa3e6541))
* **chat:** add online presence chip and persistent lastReadAt ([4f05064](https://github.com/CourtHive/TMX/commit/4f05064266636fe77d1db8193b2014d6efaac120))
* **chat:** remember the chat panel's last position across sessions ([9d4d913](https://github.com/CourtHive/TMX/commit/9d4d91350e019e6835ca1cab32b1f390dc0d5cbd))
* **common:** shared view-toggle + setTabHeader banner helpers ([e3d7f9e](https://github.com/CourtHive/TMX/commit/e3d7f9e025a279710b2da8c51bbb65f827514aa3))
* **crowd:** td promotion ui consuming score-relay rest api (Phase 4) ([acb6304](https://github.com/CourtHive/TMX/commit/acb630443382e02d02cc6700e0a868cd0bd1a4dc))
* **draw-popover:** add 'View player card' to participant menu ([cd3cc82](https://github.com/CourtHive/TMX/commit/cd3cc82cb0e7ac5768153578b242220ca93d73d0))
* **drawsView:** per-card visualizations with display-options popover ([61847b7](https://github.com/CourtHive/TMX/commit/61847b7041d23ed7df1363493c8fffe0a4e5e913))
* **drawsView:** use competitiveness donut on draw cards ([926a78b](https://github.com/CourtHive/TMX/commit/926a78b7f7bb00beff8bf0b5cca5197fa5f6aa14))
* **entries:** destroy pairs + row-number/column-selector; fix row-select crash ([616135d](https://github.com/CourtHive/TMX/commit/616135d2c71245940346a0fedbc142db1d9d5beb))
* **entries:** status chip for special acceptances + cap doubles name width ([9e4ed90](https://github.com/CourtHive/TMX/commit/9e4ed90f39ce12df543f2e8bc2224014b99d4123))
* **events:** card-grid integration with banner-style tab header ([85980e7](https://github.com/CourtHive/TMX/commit/85980e786dc540a5a4afaf351aa1ac52b6c18b26))
* **eventsTab:** card-grid view for the per-event draws list ([9cc4e1b](https://github.com/CourtHive/TMX/commit/9cc4e1b3ea29945a4b41dd69c7195a9792bb64d9))
* **eventsTab:** two-row draws view — header with toggle, controls below ([a909899](https://github.com/CourtHive/TMX/commit/a9098997779c4f7c1e715fc6838dcf0697e45526))
* **filters:** highlight currently-active filters inside popover ([ed95f53](https://github.com/CourtHive/TMX/commit/ed95f53de268d777ab9027ac1354dfd48582d3ab))
* **format-wizard:** apply button + confirmation + events/entries ([ac4636e](https://github.com/CourtHive/TMX/commit/ac4636e53fc956543556c7debf79e5278b5b4b62))
* **format-wizard:** beta-flag, banded plan cards, FEED_IN, VC, per-event, consideration lane ([04b264f](https://github.com/CourtHive/TMX/commit/04b264f857f97a3cc2ae62a38df5c28c16905651))
* **format-wizard:** convert from modal to tournament-context page ([0ea7ec8](https://github.com/CourtHive/TMX/commit/0ea7ec882278a3155e2e5f8665f5cd181f491c7c))
* **format-wizard:** modal scaffold + constraints form (left pane) ([401fac9](https://github.com/CourtHive/TMX/commit/401fac9744e3e79aa51e87421b92f7897f5a1518))
* **format-wizard:** persist state in tournament extension + reset ([372a066](https://github.com/CourtHive/TMX/commit/372a06617afc963f913e319bae24979b138427dd))
* **format-wizard:** plan-to-mutation translator + apply orchestrator ([33af021](https://github.com/CourtHive/TMX/commit/33af02109533e7d08415fdc42d26ba9e2c453060))
* **format-wizard:** right-pane distribution + plan cards + live recompute ([7d91748](https://github.com/CourtHive/TMX/commit/7d917481c505da16436681365a8a7acb66485152))
* **format-wizard:** service module bridging engine to runtime ([317db01](https://github.com/CourtHive/TMX/commit/317db013ec897f7aeccf31e95520ca63d123e10c))
* **format-wizard:** tournament actions menu entry + conditional visibility ([3edc120](https://github.com/CourtHive/TMX/commit/3edc120836c730e3ab6e5e597d3ca83e5c0d404a))
* **format-wizard:** tournament-capacity stale-state cue ([e566d6b](https://github.com/CourtHive/TMX/commit/e566d6b42b6a8aaa4827c2621ab948728742b516))
* **i18n:** add TMX runtime locale loader ([473b35e](https://github.com/CourtHive/TMX/commit/473b35e9443b2806a2c450c1c95cc0d45922df37))
* **i18n:** drop non-English bundled locales, fetch at runtime only ([adefbfa](https://github.com/CourtHive/TMX/commit/adefbfaa5f7b7f892272bfe180171772e11b057a))
* **i18n:** resolve boot language from provider default + mark user-explicit picks ([76de296](https://github.com/CourtHive/TMX/commit/76de296b9a343405cd3ed6e1d8d0ab2bc17aa6bc))
* **i18n:** source available locales from CFS manifest in selectIdiom ([208d478](https://github.com/CourtHive/TMX/commit/208d4780a6b3d1bd871ed4a64fbe917c0e71029c))
* **i18n:** translate providerSwitcher block in fr/es/pt-BR/de/ar/zh-CN ([df7502c](https://github.com/CourtHive/TMX/commit/df7502c03040b6ed69fb0d3e801a77011853671c))
* **matchups:** add scheduled-date filter to MatchUps tab ([1c127c0](https://github.com/CourtHive/TMX/commit/1c127c0d3d5a795e539f07dc5a22c8603bf703b0))
* **matchUps:** competitiveness summary bar in controlBar options-right ([3706493](https://github.com/CourtHive/TMX/commit/37064938453dcc8908459025598e0ddf7707500d))
* **matchUps:** extend status filter with toBePlayed, retired, irregularEnding ([c65883d](https://github.com/CourtHive/TMX/commit/c65883dace95eb4530b90a7bed3b71029769c03b))
* **matchups:** surface factory's new matchUp.updatedAt as hidden column ([b9f95c9](https://github.com/CourtHive/TMX/commit/b9f95c92c43d5fe16da37e8a436cd33d4bb632a4))
* **overview:** :sparkles: donut chart defaults to all matchUps and skips hydration ([76e066b](https://github.com/CourtHive/TMX/commit/76e066b35811d12431c4df0016993fe1f0d04e33))
* **overview:** add competitiveness donut toggle on tournament overview ([63a8ac3](https://github.com/CourtHive/TMX/commit/63a8ac38ea7bae8f635498eec9d325351ef451e9))
* **overview:** auto-refresh dashboard on remote mutations ([8d23cae](https://github.com/CourtHive/TMX/commit/8d23caedbd6612ee4abd8aa272032f79e523e824))
* **overview:** donut chart is the default + remember last user choice ([bf78546](https://github.com/CourtHive/TMX/commit/bf78546f09e4423a6fd1037ad32eb0499915bd70))
* **overview:** tournament categories editor + dates panel full-width ([5b0b401](https://github.com/CourtHive/TMX/commit/5b0b4013e47f9547fd6eb890b0dbdd7d1c87cada))
* **pdf:** user/provider-selectable PDF font with Latin-2 support ([#1082](https://github.com/CourtHive/TMX/issues/1082)) ([8464352](https://github.com/CourtHive/TMX/commit/84643526c6cc2067876c70ab913b34ff468843ec))
* **policies:** public policy catalog browser ([064341e](https://github.com/CourtHive/TMX/commit/064341eabd9b13696207d637791f1abe8482181b))
* **policies:** remove federation builtins from TMX policy catalog ([ef08419](https://github.com/CourtHive/TMX/commit/ef08419451f5c76c1a9876f329906b92e2acea36))
* print fact sheet from overview dashboard ([965bf98](https://github.com/CourtHive/TMX/commit/965bf98357ae52f0836115262073e93afbb72d10))
* promote google sheets, chat, and unified entries to standard ([9757cd1](https://github.com/CourtHive/TMX/commit/9757cd1f36ef085304bded7358dfe7ebaddb6afe))
* provider impersonation switcher + cross-app handoff ([fc3475f](https://github.com/CourtHive/TMX/commit/fc3475fa53b6eed96c5a49fe7d2bbcad8d301599))
* **provider-config:** mirror printPolicies addition ([ad1fbba](https://github.com/CourtHive/TMX/commit/ad1fbba6166600b3ee9af24e9ed476ffb6b19b12))
* **providerConfig:** consume server effective config + expand mutation gates ([6d39713](https://github.com/CourtHive/TMX/commit/6d397134e692a67ec0bc62e795a17892c02a5732))
* **providerConfig:** export canonical KEYS arrays + contract test ([f280faf](https://github.com/CourtHive/TMX/commit/f280faf90074ff8d9c8fb112e4e18693a1300f0b))
* **provider:** multi-provider session switcher for N&gt;1 users (Phase 2 — TMX) ([0564400](https://github.com/CourtHive/TMX/commit/056440039663d1d14ab763197c06c9b74a17f124))
* **publishing:** cap-aware city/state publish-column toggle ([34391de](https://github.com/CourtHive/TMX/commit/34391dee4942bae6c2fd21d5fc40d638f9637264))
* put TMX assistant behind beta feature flag ([6e519d4](https://github.com/CourtHive/TMX/commit/6e519d42b67a4c455fd98e83a288c9a44fc2e19c))
* registration profile editor, contact card insert, personnel wizard ([0d3caf8](https://github.com/CourtHive/TMX/commit/0d3caf8ccf00965ac0552046288014ba0434df51))
* reports tab handles server-sourced audit reports via audit-worker ([75c0e7b](https://github.com/CourtHive/TMX/commit/75c0e7bd7a04afe324a4acc54672c89c3a31bd30))
* reports tab with 9 reports, PDF/CSV/JSON export, beta feature flag ([7cbea25](https://github.com/CourtHive/TMX/commit/7cbea2588fe57a40b913280ac15b522153c62618))
* **reports:** promote Reports tab to production, drop the beta flag ([9ed40be](https://github.com/CourtHive/TMX/commit/9ed40be5d0387151c50f88499ebc03855a3b5e41))
* **scalings:** histogram on overview + compact sparkline in participants header ([167973e](https://github.com/CourtHive/TMX/commit/167973ebd9971f6032fe51cd5ad649b3bf35183c))
* **schedule2:** active courts strip above the grid ([a94dd92](https://github.com/CourtHive/TMX/commit/a94dd92daeb99c5d3c9cdd34142026b3c8cad4d9))
* **schedule2:** active strip cells open the cell popover on click ([750d4d1](https://github.com/CourtHive/TMX/commit/750d4d1675f133676cec2bfb8a0b0ada847d5a7b))
* **schedule2:** add (x) clear button to header "Search schedule" field ([9327053](https://github.com/CourtHive/TMX/commit/93270539f4d062865c3efb432fb165ac19168b76))
* **schedule2:** apply-grid modal with optional daily-limit policy ([d3cb2ee](https://github.com/CourtHive/TMX/commit/d3cb2ee4ad0ca2863a933f10dd23d5ab9a3e8e8c))
* **schedule2:** bulk row actions popover ([4991131](https://github.com/CourtHive/TMX/commit/4991131df1948d69363c4eca5c5a6493469219a7))
* **schedule2:** collapsible scheduling results sections + readable badges ([4c5b085](https://github.com/CourtHive/TMX/commit/4c5b085f54f27ac73ce75a5eca08f869b57180b9))
* **schedule2:** confirm scheduling policy before Apply Times ([f4fa368](https://github.com/CourtHive/TMX/commit/f4fa3688ede8e6c1c015dd7bc93157651de3d631))
* **schedule2:** move catalog/strip/print icons into court grid header ([d95c3dd](https://github.com/CourtHive/TMX/commit/d95c3ddc7c84c6a514ed32a19717ede495b60825))
* **schedule2:** move profile actions into Day Plan header ([0cc2d29](https://github.com/CourtHive/TMX/commit/0cc2d29745ceb5d9f67bd05520d3dd780ce52499))
* **schedule2:** persist catalog show/hide across reloads ([fab1068](https://github.com/CourtHive/TMX/commit/fab106855b92cb3a9d279aa98b9436875bd67cf2))
* **schedule2:** persist matchUp catalog filters across tab navigation ([1730c75](https://github.com/CourtHive/TMX/commit/1730c75c992295cd6710c8b6204609f0f456393f))
* **schedule2:** place catalog toggle next to "Court Grid" / "Day Plan" titles ([fe50cb8](https://github.com/CourtHive/TMX/commit/fe50cb86d40b49f75bdea4fae78efae539f720b7))
* **schedule2:** render scheduler explain-why payloads in results drawer ([c359be8](https://github.com/CourtHive/TMX/commit/c359be85ed0036ca0115222fd5ba159fa0f4bfdb))
* **schedule2:** reorder view switcher + tournament-scoped persistence ([2c3cb88](https://github.com/CourtHive/TMX/commit/2c3cb88e76aa2fad9a2136149ab2112393f7c904))
* **schedule2:** results drawer + minRows extension + scheduled-tab UX ([4938488](https://github.com/CourtHive/TMX/commit/49384885d1635598c735cdad0140d25714c7306a))
* **schedule2:** scheduleToast wrapper for bottom-center toasts above modal footer ([1ca42c6](https://github.com/CourtHive/TMX/commit/1ca42c6f46448da1efae6e25b29612a3bd6a6bbf))
* **schedule2:** scheduling policy editor + Apply Times polish ([c2d2bef](https://github.com/CourtHive/TMX/commit/c2d2befadb3aec3511c6571da315deeb82d64077))
* **schedule2:** unify Scheduled-tab cards + hide cross-date catalog items ([cbe9858](https://github.com/CourtHive/TMX/commit/cbe98580ca4a563f3f35ed43ca3168da5cb6c6ec))
* **schedule:** remove legacy schedule tab and bump TMX to 3.3.0 ([77609b9](https://github.com/CourtHive/TMX/commit/77609b9b9f519f02c99eaf723c48a579d3d24bb3))
* **scoring:** persistent crowdsourced score badge in tables and brackets ([1296f5a](https://github.com/CourtHive/TMX/commit/1296f5a81982887ef50762b1ef24978c0d0b85fb))
* show delete panel for tournament creators ([ec5b2ab](https://github.com/CourtHive/TMX/commit/ec5b2ab09579e2f39616fcd06eabb416a39c1ba5))
* **tmx/nav:** invert provider element on hover ([da3de3f](https://github.com/CourtHive/TMX/commit/da3de3fd365b48137ce59b86680d63926e616170))
* **tmx/schedule2:** clear schedule actions in grid view ([92b70b6](https://github.com/CourtHive/TMX/commit/92b70b6362f602cc9a75e39715ab179194896c76))
* **tmx/schedule2:** court header menu + per-matchUp court card print ([bd2e809](https://github.com/CourtHive/TMX/commit/bd2e809df8100d343fdf4d5309a67c488ca457ef))
* **tmx/schedule2:** scope Apply Times / Apply Grid to visible courts ([84ca123](https://github.com/CourtHive/TMX/commit/84ca123e2b5697ca08e6714318fcf79c336ff063))
* **tmx:** make schedule2 the default; legacy schedule behind fallback option ([5bdde9f](https://github.com/CourtHive/TMX/commit/5bdde9fe9f3f2cb6091b24ba0f308b9178d0320b))
* **tmx:** offer calendar cleanup when tournament record is missing ([bcca883](https://github.com/CourtHive/TMX/commit/bcca883297269ba65fe1f33780c176e33fb7045e))
* **tournament:** edit + render local time zone (IANA-aware) ([41bc27d](https://github.com/CourtHive/TMX/commit/41bc27dff51761484622eea7c768a9ea1f15a636))
* **tournaments:** card-grid redesign with two-row banner strip ([6811f61](https://github.com/CourtHive/TMX/commit/6811f6135cef7dd663343f2ca083fac6181aadd2))
* **venues:** add website + image URL inputs to edit venue drawer ([a5a1be0](https://github.com/CourtHive/TMX/commit/a5a1be019cd82d66fe9bdfa51caac951e0113c31))
* **venues:** address fields on add + edit venue drawers ([e1e5d21](https://github.com/CourtHive/TMX/commit/e1e5d21613bf5663a90d5c403f8214748084c9c2))
* **venues:** card-grid integration + venue detail page with court cards ([11cb727](https://github.com/CourtHive/TMX/commit/11cb727f292aa015a830d35c6f1c950d524ad940))
* **venues:** website column + URL fields on add venue drawer ([69ed4ad](https://github.com/CourtHive/TMX/commit/69ed4adfc41d243b087984bf9a9e8494bd6ff0e2))
* **version:** notify on factory + TMX version drift ([e2f68c1](https://github.com/CourtHive/TMX/commit/e2f68c116e65dd7f101c2bbf25bb4c2790e34c3e))
* **views:** default to table view; hide card display options in table mode ([f2a85a9](https://github.com/CourtHive/TMX/commit/f2a85a90dc680bd605633e67e45ebd87b8b516e5))


### Bug Fixes

* always confirm event deletion, warn louder on bulk delete ([186b1e6](https://github.com/CourtHive/TMX/commit/186b1e6366003cd4425954dfca6d52160598d1d8))
* **auth:** handle forced first-login password change in TMX ([4568a1b](https://github.com/CourtHive/TMX/commit/4568a1bcee71cf0cf30c7dd889107a7030a0ed21))
* **baseApi:** honor silenceErrors on the error response interceptor ([2bf7378](https://github.com/CourtHive/TMX/commit/2bf73783ca6f5b5f942acd465a9fa40936ab5b9d))
* **categories-editor:** inset padding on modal content body ([63fcb16](https://github.com/CourtHive/TMX/commit/63fcb16c3bcb79528a5d53c3e403cfc1f99a522b))
* clear SERVER and ASSISTANT_URL from .env.development ([a5aee0d](https://github.com/CourtHive/TMX/commit/a5aee0d48087a4cd91c7d4ca59a6e4260da7466a))
* **compositions:** publish-extension snapshots full configuration ([5d0b652](https://github.com/CourtHive/TMX/commit/5d0b6529f38762795fe3f3a44f74ada5737dfe53))
* **compositions:** user compositions resolve across draws + load colors ([249cca9](https://github.com/CourtHive/TMX/commit/249cca9e087cd0b97f0a00e64ab8872e0376bb94))
* **deps:** update dependency @babel/plugin-transform-private-property-in-object to v7.29.7 ([c003c71](https://github.com/CourtHive/TMX/commit/c003c71dcccfd40a29f0d032c230929e48446bf5))
* **deps:** update dependency @courthive/provider-config to ^0.2.0 ([9191d8a](https://github.com/CourtHive/TMX/commit/9191d8a35507cc835e1757bcf031e362f1b47f40))
* **deps:** update dependency axios to v1.15.1 ([8e48031](https://github.com/CourtHive/TMX/commit/8e480318b4c0ecd5366dc2a47d6c18d6c9078861))
* **deps:** update dependency axios to v1.15.2 ([b0ad82b](https://github.com/CourtHive/TMX/commit/b0ad82b36ccd5af52548400105d50b1533ad6208))
* **deps:** update dependency axios to v1.16.0 ([baafaae](https://github.com/CourtHive/TMX/commit/baafaae5239f51ad5f9e28f28fefc1464c8bce56))
* **deps:** update dependency axios to v1.16.1 ([d8f4070](https://github.com/CourtHive/TMX/commit/d8f4070c19d15bee5aa1cd12abfca54a1d72749c))
* **deps:** update dependency courthive-components to v1.10.0 ([16935c9](https://github.com/CourtHive/TMX/commit/16935c9c10b5dd39f07597ab6ca17d1a1def702c))
* **deps:** update dependency courthive-components to v1.6.0 ([8581ee2](https://github.com/CourtHive/TMX/commit/8581ee256feacf02a108ffb988f0e47b09f405a6))
* **deps:** update dependency courthive-components to v1.7.1 ([2612a21](https://github.com/CourtHive/TMX/commit/2612a21141d80ae15ea371fc22f0f0171f6773e6))
* **deps:** update dependency courthive-components to v1.8.0 ([41f524d](https://github.com/CourtHive/TMX/commit/41f524d51aaff63c6f5d7d503ed4e8a998a0396c))
* **deps:** update dependency courthive-components to v1.8.0 ([fb1b800](https://github.com/CourtHive/TMX/commit/fb1b800f88dd3e2c5dc0b32b6e5b8485ebd1b95c))
* **deps:** update dependency courthive-components to v1.8.1 ([6db376e](https://github.com/CourtHive/TMX/commit/6db376e8f44783cd61cb49267a163a1facd8362d))
* **deps:** update dependency focus-trap to v8.1.0 ([193c9df](https://github.com/CourtHive/TMX/commit/193c9dfba92154a01d570d5e109d477710594efb))
* **deps:** update dependency focus-trap to v8.2.0 ([9ff0704](https://github.com/CourtHive/TMX/commit/9ff07046c40ccc1090cd9ae431eb396c9a0fe4bb))
* **deps:** update dependency focus-trap to v8.2.1 ([319108f](https://github.com/CourtHive/TMX/commit/319108ffe7036c3f57deecfbd4c667c91193717d))
* **deps:** update dependency focus-trap to v8.2.1 ([b83578d](https://github.com/CourtHive/TMX/commit/b83578dadf8d07bcf9faa21bd5dade1f1b803f29))
* **deps:** update dependency hotkeys-js to v4.0.4 ([58cd609](https://github.com/CourtHive/TMX/commit/58cd609da52bce2a9b0cad6cbfea7e0ede553a5b))
* **deps:** update dependency pdf-factory to ^0.4.0 ([3fb3e56](https://github.com/CourtHive/TMX/commit/3fb3e56e486276bb2b15281b5906d3f2125cc42c))
* **deps:** update dependency pdf-factory to ^0.5.0 ([ece84f5](https://github.com/CourtHive/TMX/commit/ece84f55885a88bbb746297ab58c671b6764a600))
* **deps:** update dependency pdf-factory to v0.6.0 ([498852a](https://github.com/CourtHive/TMX/commit/498852acd322f682b9ab124453c8067d045b921f))
* **deps:** update dependency pdf-factory to v0.6.1 ([3929b65](https://github.com/CourtHive/TMX/commit/3929b65bc932599618e7cb2d4fb9001c05a58a26))
* **deps:** update dependency pdf-factory to v0.7.0 ([dcd24be](https://github.com/CourtHive/TMX/commit/dcd24beca0d71abad8a8f1e6b8c483e8fb937011))
* **deps:** update dependency pdf-factory to v0.8.0 ([33352f4](https://github.com/CourtHive/TMX/commit/33352f4fb074938749503a6b8c437381abe1f576))
* **deps:** update dependency qs to v6.15.2 ([26480fc](https://github.com/CourtHive/TMX/commit/26480fc030e09708a9a3047aa172bbff39fc893e))
* **deps:** update dependency qs to v6.15.2 ([b08c2d5](https://github.com/CourtHive/TMX/commit/b08c2d5d8afbf208638f0112414091849cf71f9c))
* **deps:** update dependency tods-competition-factory to v3.8.0 ([8594a5b](https://github.com/CourtHive/TMX/commit/8594a5bda6b70d62065bb13e7c15118d9878c2ad))
* **deps:** update dependency tods-competition-factory to v3.9.0 ([149fb9b](https://github.com/CourtHive/TMX/commit/149fb9b3dc69eb57abdd73e8fa9c2925e5ebaeab))
* **deps:** update dependency tods-competition-factory to v4.0.0 ([dc98c0a](https://github.com/CourtHive/TMX/commit/dc98c0a14196394df4e084e3a93c30d0f65574c7))
* **deps:** update dependency tods-competition-factory to v4.1.0 ([af819c1](https://github.com/CourtHive/TMX/commit/af819c1839d4dee817add10362625b79cc1ce52e))
* **deps:** update dependency tods-competition-factory to v4.1.1 ([155f7a8](https://github.com/CourtHive/TMX/commit/155f7a8f448c88ed35c8f2734a3bc030734f1d43))
* **deps:** update dependency tods-competition-factory to v4.2.0 ([21fece0](https://github.com/CourtHive/TMX/commit/21fece0cc5cbdeb8a7e0c8f2ce747d65d9c6c6d0))
* **drawsView:** fetch competitiveness with contextProfile; add e2e spec ([6ab394a](https://github.com/CourtHive/TMX/commit/6ab394adb9053221fee0837e51595cffe129c450))
* **drawsView:** histogram + competitiveness + sunburst data plumbing ([0fceea8](https://github.com/CourtHive/TMX/commit/0fceea846c832c72f00f5b6b70831886a6b64ea7))
* **drawsView:** pass enriched structure to sunburst transformer ([cdc15e1](https://github.com/CourtHive/TMX/commit/cdc15e16752a3e2ee354cf5d80e71d3014b52c4f))
* **e2e:** update Journey 21 tests to use renamed legacyEntriesTable flag ([6b8b134](https://github.com/CourtHive/TMX/commit/6b8b1347a883126c434ac79eaa56a43700b56744))
* **entries:** enable cross-draw add for placed participants ([0d893de](https://github.com/CourtHive/TMX/commit/0d893de81d6dc77cec36a659972cb8d46e5284e9))
* **entries:** remove redundant rowSelection cellClick that double-toggled selection ([8848ca3](https://github.com/CourtHive/TMX/commit/8848ca3640213d8e7914103418e0ec432f177305))
* **entries:** widen Grouping column so segment badges aren't clipped to "…" ([7ba044f](https://github.com/CourtHive/TMX/commit/7ba044f3da5f0391785c4d1d1b03dd640c2e5016))
* **eventsTab:** wire event card click ([cc8ef15](https://github.com/CourtHive/TMX/commit/cc8ef15fc598f1f511daddc19a55dff57b04e5fb))
* **eventsView:** keep cards/table toggle right-aligned on every render ([8710d04](https://github.com/CourtHive/TMX/commit/8710d04cd745e31384ab9fe419e1f2ee0b705747))
* force local save for new tournaments and ERR_MISSING_TOURNAMENT recovery ([dfd7921](https://github.com/CourtHive/TMX/commit/dfd7921e54ce64c1a53e4006fa8b44f1e60e6b5a))
* **i18n:** language switch actually takes effect on reload ([ec5cc44](https://github.com/CourtHive/TMX/commit/ec5cc447dfc71686a663962260719c04311345a6))
* **i18n:** selectIdiom force-refreshes the manifest on open ([0a62822](https://github.com/CourtHive/TMX/commit/0a628225f5633745e640fff803cec5e26caadc3d))
* **login:** set type='email' on email input ([eecd8a4](https://github.com/CourtHive/TMX/commit/eecd8a4b03cebe3b9578a6569c00c41263c3bca3))
* **matchUps:** re-apply filter-active pulse on tab re-mount ([4fe1712](https://github.com/CourtHive/TMX/commit/4fe171244a063a654dac60a20612f99e5313b4de))
* **matchups:** rebalance Type/Round/Side column widths ([0802a44](https://github.com/CourtHive/TMX/commit/0802a443ab60848cc17d3c4919c35211c5aae1e2))
* **modals:** prevent map.setView crash in getLatLong when opened without coords ([82b5417](https://github.com/CourtHive/TMX/commit/82b5417bdd9eb05a69981af9aa6b6b88a0ce2a62))
* move Ask TMX icon to always-visible navbar slot ([71dbbf6](https://github.com/CourtHive/TMX/commit/71dbbf69c15a0d2bad920ad81712654596b88a4a))
* **notesEditor:** wider modal + scroll-contained editor area ([c2507fb](https://github.com/CourtHive/TMX/commit/c2507fb2ca4f5951ac005f09efc361a6a29b3f16))
* **overviewTab:** dashboard panel overflow + dark-mode select ([1fd0515](https://github.com/CourtHive/TMX/commit/1fd05151eac66f93ebe435dd202a2e2356e555e7))
* persist and hydrate assistant feature flag ([ea141da](https://github.com/CourtHive/TMX/commit/ea141dab11088550564cd820438cb14dd579019e))
* pnpm 11 install — kebab-case .npmrc + ignoredBuiltDependencies ([af9b1a7](https://github.com/CourtHive/TMX/commit/af9b1a7925196be0ac57cf5d98652290f447fdb5))
* preserve draw-level button bar after completing all matchUps ([9cd6cf1](https://github.com/CourtHive/TMX/commit/9cd6cf15d54a8e3887137698de68994daa422441))
* **provider-switcher:** force calendar refresh + tooltip on badge ([d13504c](https://github.com/CourtHive/TMX/commit/d13504cc27b0a7dc36d83ee531134bcbfa5f43ea))
* **provider:** honor impersonation handoff without association lookup ([98b6e5f](https://github.com/CourtHive/TMX/commit/98b6e5f1e883e9744a865e1b2094a67345f58891))
* **provider:** silence effective-config 403 toast on impersonation ([c24f962](https://github.com/CourtHive/TMX/commit/c24f96292aa14675beac3756b57d8a50ef26d803))
* **providerSwitcher:** consolidate #provider click into a single handler ([4d8fb31](https://github.com/CourtHive/TMX/commit/4d8fb31aa2e5b34bf6cf607b93e2db8322a0b31d))
* **providerSwitcher:** land the actual consolidated click handler ([0e6a4c9](https://github.com/CourtHive/TMX/commit/0e6a4c9ffa39a2578f7d404d6e241cf92dcec592))
* **providerSwitcher:** only open switcher when already on /tournaments ([349aac3](https://github.com/CourtHive/TMX/commit/349aac3511bf862e70128b483fcaa3ae3ff119a3))
* replace prompt() chains with inline form panels in registration profile ([3ac0811](https://github.com/CourtHive/TMX/commit/3ac0811d4362f2e81115e056f575b401371d4acc))
* **reports:** render N/A in number columns for non-finite values ([f47e825](https://github.com/CourtHive/TMX/commit/f47e825dfb6d32c20aae53f4e3103d1644c95666))
* revert forceSave — provider tournaments live on server, not IndexedDB ([4d5eee9](https://github.com/CourtHive/TMX/commit/4d5eee9d90c26fa865ee8b44ceba0beb0535721b))
* **scalings:** seed participants header on tableBuilt, move selector right of chart ([5a71b53](https://github.com/CourtHive/TMX/commit/5a71b536ee02e471d92ec1f866e9eedc43bb9e23))
* **schedule2:** close cell popover when its trigger cell is clicked again ([89a2f70](https://github.com/CourtHive/TMX/commit/89a2f704b31ccf25b1c682df91fd615ba8e2497f))
* **schedule2:** convert inline px font-sizes to rem so the Settings Font panel scales the page ([71d04fc](https://github.com/CourtHive/TMX/commit/71d04fce605cb11533de7cdcfad99ccea3afc337))
* **schedule2:** disable print button while in bulk mode ([0b2bddf](https://github.com/CourtHive/TMX/commit/0b2bddfb4f7111ee6444eeef72fc856490eb15bf))
* **schedule2:** give the control bar horizontal padding on mobile ([511bda5](https://github.com/CourtHive/TMX/commit/511bda5816b7aad895cf72afce47e2a74f748ac6))
* **schedule2:** hide the issues warning button in profile view ([bc7fbb5](https://github.com/CourtHive/TMX/commit/bc7fbb52eee491da63b6b8d9fe51aefbfd90787e))
* **schedule2:** per-view catalog visibility for grid and profile ([71c1f85](https://github.com/CourtHive/TMX/commit/71c1f856c6dd7dad94ca9f82404e2fbaf7dcc025))
* **schedule2:** refresh active strip on court visibility change ([028b96a](https://github.com/CourtHive/TMX/commit/028b96a59be065bf150d2161bfff197e378f0248))
* **schedule2:** responsive header layout for phone viewports ([bc08dcd](https://github.com/CourtHive/TMX/commit/bc08dcd3bb826e24c20aff7daa0aff00fb26217e))
* **schedule2:** sort Scheduled tab by scheduledTime ascending ([65da198](https://github.com/CourtHive/TMX/commit/65da198eb47ae2fc13a1e3acbae79e9e98d9cc2e))
* **schedule2:** switch Search schedule to type=text to drop native browser (x) ([81ce18d](https://github.com/CourtHive/TMX/commit/81ce18dce68385d8b46ffc9fab01c2c575268c45))
* **stalenessGuard:** silence + gate the inactivity check so local-only tournaments don't toast ([638507e](https://github.com/CourtHive/TMX/commit/638507e0c8ec41075508072f7554c47b81ccb1b8))
* **tables:** tickCross column reflects completedMatchUpStatuses ([cbc8d00](https://github.com/CourtHive/TMX/commit/cbc8d00ee64353c4a61ad62d029c4b410b01b5c0))
* **tables:** tighten Type/Round and widen Side1/Side2 in matchUps table ([ecc31ab](https://github.com/CourtHive/TMX/commit/ecc31abe609f99c89cfedf1235cf6cfef0a42149))
* **theme:** introduce --tmx-fill-* vars for AA-safe white-text-on-color backgrounds ([67b1eea](https://github.com/CourtHive/TMX/commit/67b1eea9ac60ff1bf33b16b561545ea663c2aece))
* **tmx/overview:** support legacy ISO startDate/endDate strings ([a72dcd1](https://github.com/CourtHive/TMX/commit/a72dcd1576fc6aac42c9e06989b661b3445bd363))
* **tmx/schedule2:** make date count badge legible in dark mode ([b9e6d8b](https://github.com/CourtHive/TMX/commit/b9e6d8b4e2293f7b73dba45ff07ef50eeb559ab1))
* **tmx/schedule2:** persist catalog visibility + selected date across refreshes ([2f94bde](https://github.com/CourtHive/TMX/commit/2f94bde002c07fda79d396c0a4d0b3303614137a))
* **tmx/schedule2:** refresh grid cells on remote mutations ([193a9c7](https://github.com/CourtHive/TMX/commit/193a9c7cdba99dbf5148db32f925a13fc9229edd))
* **toaster:** apply px unit to offset values so non-zero offsets work ([dcd5f57](https://github.com/CourtHive/TMX/commit/dcd5f5717fa9af49e076d5e6e3543dc1a165248b))
* **tournaments-header:** neutralize banner background on header bar ([08a21a3](https://github.com/CourtHive/TMX/commit/08a21a3b281f7880eef98d9eb37befd76238753d))
* **tournaments:** remove border from page header ([b5fda73](https://github.com/CourtHive/TMX/commit/b5fda73096e6844a4942ec2633b68cd36287e23d))
* **types:** guard possibly-undefined deleteBtn in deleteEvents test ([d8d8fe6](https://github.com/CourtHive/TMX/commit/d8d8fe68cacdd30b46a50a6dd95dce82922fcb12))
* use location.origin for server URL in production builds ([d03cfb8](https://github.com/CourtHive/TMX/commit/d03cfb87f678b6b35c73720038b4207f144ac42c))
* **venues:** replace country-code free-text with country selector ([c405bc1](https://github.com/CourtHive/TMX/commit/c405bc1ad76dd541b55aa0629a1af8526264dc39))


### Documentation

* add .env.example with VITE_ASSISTANT_URL ([34147a2](https://github.com/CourtHive/TMX/commit/34147a2143c63e2d9d1e7d4d5bd3b16dec9ce050))

## [5.2.1](https://github.com/CourtHive/TMX/compare/v5.2.0...v5.2.1) (2026-05-25)


### Bug Fixes

* **deps:** update dependency @babel/plugin-transform-private-property-in-object to v7.29.7 ([c003c71](https://github.com/CourtHive/TMX/commit/c003c71dcccfd40a29f0d032c230929e48446bf5))
* **deps:** update dependency courthive-components to v1.10.0 ([16935c9](https://github.com/CourtHive/TMX/commit/16935c9c10b5dd39f07597ab6ca17d1a1def702c))
* **deps:** update dependency tods-competition-factory to v4.2.0 ([21fece0](https://github.com/CourtHive/TMX/commit/21fece0cc5cbdeb8a7e0c8f2ce747d65d9c6c6d0))

## [5.2.0](https://github.com/CourtHive/TMX/compare/v5.1.0...v5.2.0) (2026-05-25)


### Features

* **auth:** silent access-token refresh via rotating refresh token ([77cb9ad](https://github.com/CourtHive/TMX/commit/77cb9adf600d67a37323a685f10747a2aa3e6541))
* **pdf:** user/provider-selectable PDF font with Latin-2 support ([#1082](https://github.com/CourtHive/TMX/issues/1082)) ([8464352](https://github.com/CourtHive/TMX/commit/84643526c6cc2067876c70ab913b34ff468843ec))

## [5.1.0](https://github.com/CourtHive/TMX/compare/v5.0.1...v5.1.0) (2026-05-24)


### Features

* **auth:** provider-admin from scoped role + provisioner, not global admin ([#1074](https://github.com/CourtHive/TMX/issues/1074)) ([978da22](https://github.com/CourtHive/TMX/commit/978da226cc7cfe936dcb9ea33916be9889f2c90b))
* **entries:** destroy pairs + row-number/column-selector; fix row-select crash ([616135d](https://github.com/CourtHive/TMX/commit/616135d2c71245940346a0fedbc142db1d9d5beb))
* **entries:** status chip for special acceptances + cap doubles name width ([9e4ed90](https://github.com/CourtHive/TMX/commit/9e4ed90f39ce12df543f2e8bc2224014b99d4123))


### Bug Fixes

* **auth:** handle forced first-login password change in TMX ([4568a1b](https://github.com/CourtHive/TMX/commit/4568a1bcee71cf0cf30c7dd889107a7030a0ed21))
* **deps:** update dependency courthive-components to v1.8.1 ([6db376e](https://github.com/CourtHive/TMX/commit/6db376e8f44783cd61cb49267a163a1facd8362d))
* **deps:** update dependency tods-competition-factory to v4.1.1 ([155f7a8](https://github.com/CourtHive/TMX/commit/155f7a8f448c88ed35c8f2734a3bc030734f1d43))
* **entries:** remove redundant rowSelection cellClick that double-toggled selection ([8848ca3](https://github.com/CourtHive/TMX/commit/8848ca3640213d8e7914103418e0ec432f177305))

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

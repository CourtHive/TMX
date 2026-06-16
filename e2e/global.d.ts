// Ambient declarations for the e2e suite.
//
// `dev` is a runtime-injected debug global wired by `setDev()` in TMX's
// production bundle and exposed via `initDevBridge()` from the e2e
// dev-bridge helper. Its shape is intentionally untyped — different
// specs reach into different sub-trees (factory engines, tmx2db,
// context, mock generators) and we don't want spec authors fighting
// the type system to seed test fixtures.
//
// Without this declaration `tsc --noEmit -p e2e/tsconfig.json` emits
// 220+ TS2304 "Cannot find name 'dev'" errors and the e2e suite has
// no usable type-check baseline.
declare global {
  // Reachable as bare `dev` (most spec call sites) AND as
  // `globalThis.dev` (the dev-bridge helper uses the explicit form
  // to make the runtime injection point obvious). `var` is required
  // here — `let`/`const` inside `declare global` doesn't attach to
  // the globalThis index signature.
  // eslint-disable-next-line no-var
  var dev: any;
}

export {};

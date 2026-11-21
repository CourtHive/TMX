# Scheduling Lab

**Enter Time Warp** in the login menu creates a disposable deep copy of the open tournament, keeps its name and
view, and opens a paused clock. It works while signed in, signed out, or already in Demo mode. Finish pending
commands and save/discard drafts first. The copy has a unique `time-warp-*` id and `isMock: true`; its tournament
references are rebased and its participant/draw/match ids are preserved.

Warp is local to this tab. CFS/query/auth/AMS/score-relay requests are blocked at API boundaries, realtime sockets
are suspended, earlier reads are aborted, and server outbox writes/replay are disabled. Sandbox ids are refused
at the network boundary even after exit. Tournament saves skip IndexedDB and the local calendar. No production
"Go offline" custody marker is written and no sandbox is ever brought online.

The navigation and active footer turn red. Clock controls offer forward steps, venue date/time, next schedule
boundary, and opt-in recording. Backward steps do not undo stored calls/results and are refused.

**Exit Warp** discards the copy and all its drafts, restores the previous Demo posture and schedule date, and
returns to the original view. Online provider records reload through the normal authoritative loader; existing
offline custody and local records reload the latest committed IndexedDB original, falling back to the untouched entry snapshot only when no persisted original exists. Navigating outside the
sandbox exits to that original view. Reload abandons the copy and follows a sessionStorage return address (or
returns to the tournament list if the address is unavailable); no record is persisted for the sandbox.

**Load guided scheduling demo**, in the Demo mode drawer, generates a disposable Scheduling Lab and enters
Warp in guided mode. Exit returns to wherever it was launched. Older saved Scheduling Labs can still use
**Open Demo Clock** to reopen the legacy clock directly.

The guided fixture demonstrates Garman, Pro, and their composition:

| Day | Run                                          | Inspect                                                                            |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Apply Garman times                           | Singles start times, recovery gaps, court availability                             |
| 2   | Open day; Apply Pro grid                     | Doubles court order with no assigned start times                                   |
| 3   | Open day; Apply Garman times; Apply Pro grid | The same singles/doubles matchUps retain their times and receive court coordinates |

Open each day in Grid to inspect the output. Use the regular scheduling controls to demonstrate
not-before/follow-by annotations, locks, bulk edits, availability changes and contingency Plans.
The demo buttons run ordinary mutations scoped to a single date. Pro uses its unrestricted default;
the normal Profile → Apply Grid dialog offers the daily-limit policy choices.

The fixture starts unscheduled. Two rounds per draw leave results and downstream dependencies to
demonstrate. Day three's policy permits four matches per participant (two singles and two doubles),
and court hours run 10:00–23:00 so the mixed recovery requirements fit. Court 3 has a 12:00–13:00
maintenance block.

The clock occupies the middle of the existing Scheduling bottom bar (Grid, Profile, Plan and
Availability). Pages without a bottom bar, including MatchUps, receive a slim centered dock; table
space is measured so the dock does not cover rows. No extra bar is added on Scheduling.

The compact clock stays visible while its controls are hidden. **Clock controls** opens the
1/5/15-minute steps, explicit venue date/time, next time boundary, and demo scenes above the bar.
Legacy direct clock control uses a warm tint; Warp uses red for both the navigation and active bottom bar.
Opening an earlier day only changes the viewed date. Save or discard drafts before running a scheduler.
Legacy direct clock control on a saved Scheduling Lab still requires an anonymous demo session. Warp has an
explicit sandbox capability instead: signed-in identity/provider context is retained, while tournament writes
run locally. The selected Demo restriction overlay remains in effect. Warp intentionally grants local desk capability to
viewers and signed-out users as well as directors; this enables auto-call experimentation on the disposable copy
and grants no server permission. Production desk permissions resume after exit.

Calls, check-ins, starts and results use ordinary tournament actions. The active sandbox is its local running desk
(`isRunningDesk`) for automatic calling, regardless of login state. Production provider records retain their normal
staff gate, and ordinary anonymous local records do not auto-call. Scripted match actions, recovery-boundary jumps,
checkpoint restoration, accelerated playback and synchronized online simulation are subsequent increments.
Re-enter Warp to start from an unchanged original.

## Local verification

```sh
pnpm test --run src/services/timeWarp src/services/clock --maxWorkers=2
pnpm exec playwright test --config e2e/playwright.warp.config.ts e2e/journeys/222-time-warp.spec.ts e2e/journeys/170-scheduling-demo-clock.spec.ts e2e/journeys/171-free-demo-clock.spec.ts
```

The Warp configuration starts an isolated dev server on :5181. The Warp journeys stub synthetic-login traffic so
it cannot reach a running development backend. Their network observer has a positive control outside Warp and
asserts zero HTTP/socket traffic while isolated, then proves authoritative reload and offline-custody preservation.

**Start recording** captures the initial record, clock/navigation steps and applied
mutation commands with resulting record checkpoints. **Export recording** downloads
JSON; stopping or exiting Warp retains the capture in memory for export from the login menu or Demo drawer.
Export does not clear it. Starting another recording replaces it; reload or identity changes clear it.
Export is restricted to the capturing identity.
The isolated `replayDemoWalkthrough` test driver (`services/clock/testing/`) reexecutes commands and compares
checkpoints. Uninstrumented state edits and nondeterministic results are reported
as unverified; recordings are candidates for regression fixtures, not automatically
certified tests. Recording is limited to 1,000 steps / 25 MiB.

For performance checks, enable `dev.context({ perf: true })` in the browser console
and inspect repeated method entries per action. Factory perf logging only emits
calls exceeding its threshold (true currently means 1 ms), so absence from that log
is not proof a method was never called. Distinguish dry-run entries from committed
mutations and compare the same action with recording enabled and disabled.

## Isolation and lifecycle boundaries

`services/network/serverNetwork` owns server Axios adapters, fetch and socket creation. An issued-id ledger checks
only tournament identity fields, maps and tournament URLs; names, notes and participant data containing
`time-warp-` are ordinary data. Isolation aborts native requests and disconnects registered sockets, including
incomplete handshakes. Outbound HTTP/socket request attempts and late HTTP answers fail with `NetworkIsolationError`
(`code: NETWORK_ISOLATED`); it never becomes an undefined API result. Caller-initiated cancellation retains its
normal cancellation error. Boundary refusal observers notify the UI synchronously, before a caller can catch the error; notices are limited
to one per epoch. Late inbound socket events and ack callbacks cannot reject an already completed request: they
are discarded and counted as stale via `networkRefusalCount`. Background reconnect/room/outbox lifecycle work
pauses deliberately while offline. These lifecycle pauses are distinct from explicit outbound request failures.

The network ESLint rule rejects this repository's direct use of raw network primitives/imports in application
TypeScript outside that boundary. A source-inventory unit check includes directories otherwise excluded from lint.
This is an application boundary, not a browser firewall: dependency-internal networking (including pdf-factory's
parser fetch), browser navigations, links/downloads and `window.open` are outside its enforcement. The zero-request
browser observer covers exercised flows, not every possible dependency or browser action. The two
explicit fetch exceptions are static PDF fonts and service-worker update assets. Unit canaries cover new fetches,
constructor aliases, dynamic imports and sockets. CI's required `lint` job caches Chromium and runs the affected files 170, 171 and 222 with the isolated
configuration (one retry on CI). OS browser dependencies are still installed on each fresh Linux runner; the
browser/Vite run adds CI time. The isolated relay URL is disabled: this tests explicit relay API refusals and socket
factory behavior, not real relay integration. Guidon real-stack evidence must be reported separately.

The domain lifecycle imports no page or component and registers no listeners on import. Startup explicitly wires
its UI host, and the tournament page registers its own draft guard and teardown via `registerWarpParticipant`.
The entry identity/permissions snapshot intentionally remains fixed during local experimentation; expiry and
normal token validation/refresh and server authorization resume on exit. Cross-tab identity changes discard the sandbox.

Copying uses one native clone and then rewrites known identity fields/lists/maps, reference extension values,
JSON reference extensions and tournament URLs in place. It preserves prose and opaque extension text. Other live
linked tournaments are not copied or fetched. Only the copy becomes `isMock: true`: this intentionally enables
TMX's mock-only Pipeline Features controls, while any attached scoring policy still takes precedence. The original
record and its Pipeline Features eligibility remain unchanged.

The exact UUID-shaped `time-warp-<uuid>` tournament-ID namespace is reserved for disposable records. One shared
`networkPolicy.isSandboxId` check applies to network, mutation, storage and routing, even after reload; arbitrary
prefixes in normal IDs/names/notes remain valid. Importing a record in that reserved namespace cannot save it:
the save rejects with a typed error and a notice explaining that a new tournament ID is required. This is a
namespace reservation, not a claim that arbitrary UUID-shaped IDs prove historical provenance. Opaque extension
text is not searched for identifiers. Structured JSON, multipart fields/JSON blobs, URL-encoded fields and cloned
Request bodies are inspected at dispatch. Full records are traversed once at the Axios boundary; this has a
measurable cost on large records, reported by `scripts/benchmark-network-policy.ts` rather than described as free.

Exit always releases isolation in a finalizer, including teardown exceptions, local read failures and superseded
local reads. A restore failure discards the sandbox and shows a recovery notice. Source data is restored before
asynchronous local reload; the barrier prevents edits from the outgoing sandbox during that interval.

Local browser evidence is a set of test cases, not the entire journey suite: files 170 (guided demo), 171 (free
clock) and 222 (Warp). The guided demo now launches inside a disposable Warp copy and returns to its launch
location on exit. Report exact counts and source refs in the validation record. Local validation is not remote
CI or a release: this branch remains local until explicitly authorized for push/PR.

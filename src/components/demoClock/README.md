# Scheduling Lab

This first increment demonstrates Garman, Pro, and their composition in one local tournament.

1. While signed out, open **Demo mode…** in the login menu.
2. Choose **Load guided scheduling demo** to create a fresh local Scheduling Lab.
3. Time starts paused at 09:55 on day one, in `America/New_York`.
4. Use **Clock controls** in the centered bottom-bar clock to reveal time settings and demo scenes.

For an existing local tournament, choose **Open Demo Clock** for free clock mode
(starting at 08:00 on the selected schedule date). The Scheduling Lab mode selector
can switch between guided scenes and free clock operation.

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
The navigation and active bottom bar share a warm tint while clock control is active.
Opening an earlier day only changes the viewed date. Save or discard drafts before running a scheduler.
Closing the clock, leaving demo mode, leaving the tournament or changing login identity releases
the simulated clocks and restores the normal bar colors. Clock control is unavailable to every
signed-in session, including super-admins, and requires an active demo overlay.
The clock is not persisted across reloads.

Calls, check-ins, starts and results still use ordinary tournament actions. Automatic calling
currently requires provider membership, so it does not run in this anonymous demo. Scripted match
actions, recovery-boundary jumps, checkpoint restoration, accelerated playback and synchronized
online simulation are subsequent increments. Recreate the example to start with clean tournament data.

## Local verification

```sh
pnpm test --run src/services/clock/demoClock.test.ts src/pages/tournaments/schedulerDemoProfile.test.ts --maxWorkers=2
pnpm exec playwright test --config e2e/playwright.demo-clock.config.ts
```

The dedicated browser configuration uses port 5187 and a separate Vite cache, with filesystem access
to the workspace's linked dependencies. It never reuses a server running from another checkout.

The Demo mode drawer now offers **Load guided scheduling demo**, which creates a
fresh local copy and opens the guided clock, and **Open Demo Clock**, which enables
free clock control on the current local tournament. The mode selector switches a
Scheduling Lab between guided and free operation. Signed-in sessions are excluded.

**Start recording** captures the initial record, clock/navigation steps and applied
mutation commands with resulting record checkpoints. **Export recording** downloads
JSON; captures stay in memory until exported and are cleared on identity changes.
The isolated `replayDemoWalkthrough` test driver reexecutes commands and compares
checkpoints. Uninstrumented state edits and nondeterministic results are reported
as unverified; recordings are candidates for regression fixtures, not automatically
certified tests. Recording is limited to 1,000 steps / 25 MiB.

For performance checks, enable `dev.context({ perf: true })` in the browser console
and inspect repeated method entries per action. Factory perf logging only emits
calls exceeding its threshold (true currently means 1 ms), so absence from that log
is not proof a method was never called. Distinguish dry-run entries from committed
mutations and compare the same action with recording enabled and disabled.

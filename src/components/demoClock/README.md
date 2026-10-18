# Scheduling Lab

This first increment demonstrates Garman, Pro, and their composition in one local tournament.

1. While signed out, choose **Examples → Scheduling Lab — Garman + Pro** in the tournaments list.
2. Open the generated tournament, then choose **Demo mode… → Open Demo Clock** in the login menu.
3. Time starts paused at 09:55 on day one, in `America/New_York`.

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

The clock offers forward steps of 1/5/15 minutes, explicit venue date/time, and the next scheduled
start or court-block boundary. Collapse retains the visible time; drag the header to move the panel.
Opening an earlier day only changes the viewed date. Save or discard drafts before running a scheduler.
Closing the clock, leaving the tournament or changing login identity releases the simulated clocks.
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

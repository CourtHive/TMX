# Scheduling Workspace — Queue Service

`/tournament/:id/scheduling/:date/:mode` is the unified scheduling surface in
TMX. It replaces the previously-separate `/schedule2/*` and
`/venues/availability` routes with one workspace that switches between three
modes — **Availability**, **Profile**, and **Grid** — sharing one save model.

`queueService.ts` is that save model. The companion
`queueService.test.ts` pins the invariants documented here; if you change
behavior, those tests are the lock that surfaces it.

For the why (the design debate, the precedence research, the option
comparison), see
[`Mentat/planning/SCHEDULE2_AVAILABILITY_INTEGRATION.md`](../../../../Mentat/planning/SCHEDULE2_AVAILABILITY_INTEGRATION.md).

## The seven invariants

1. **Every workspace mutation goes through `executeMethods`.** Mode renderers
   (`renderGridView`, `renderProfileView`, `renderAvailabilityGrid`) accept
   callbacks that the workspace wires to `executeMethods`. The renderers
   must **not** call `mutationRequest` directly when running inside the
   workspace. Outside the workspace (e.g. the standalone
   `/venues/availability` fallback, kept reachable via 301), they fall back
   to `mutationRequest` exactly as before.

2. **Immediate mode = direct dispatch.** When `isBulkMode()` is `false`,
   `executeMethods` calls `mutationRequest` synchronously. Pre-workspace
   behavior; no queue.

3. **Bulk mode = queue + local apply.** `executeMethods` pushes the methods
   onto `pendingBatches` and runs `competitionEngine.executionQueue(methods,
   true)` for in-memory visual feedback. `mutationRequest` does **not** fire.
   The server has no awareness of the pending state until step 4.

4. **One save flushes everything.** `savePending` issues exactly **one**
   `mutationRequest` containing all pending methods across all modes in
   queue order. Modes never flush independently. This is the core property
   that fixes the dual-save race the planning doc's critic flagged.

5. **Discard reloads from IndexedDB.** `discardPending` does a full
   `competitionEngine.setState(record)` from `tmx2db.findTournament`. This
   is **destructive** — anything that mutated the tournament record outside
   the workspace queue between "start bulk" and "discard" gets clobbered
   along with the pending changes. The fix isn't to defend against it; it's
   to route those mutations through `executeMethods` too so they queue
   alongside everything else.

6. **Turning off bulk mode with pending changes triggers discard.** Callers
   must show a confirm modal **before** calling `setBulkMode(false)` if
   `hasUnsavedChanges()` is `true`. There is no auto-save path — that was a
   deliberate choice to avoid silently saving state the user didn't
   authorize.

7. **Subscribers fire on every transition.** `subscribeQueue(listener)`
   notifies on bulk-mode toggle, queue push, save, and discard. The
   workspace's sticky save/discard action bar uses this to reflect state.

## Adding a new mode

If you add a fourth mode (or any other surface that wants to participate in
the workspace queue), follow the existing two integration patterns:

### Pattern A — the renderer already builds method arrays

(Used by Profile and Grid via `renderProfileView` / `renderGridView`.) The
renderer's existing internal queue stays in place; the workspace mounts the
renderer with the same config it uses for `/schedule2`. This is the
zero-change path while we still keep `/schedule2` alive as a safety net.

### Pattern B — the renderer dispatches mutations

(Used by Availability via `renderAvailabilityGrid`.) Add an optional
`onMutationMethods?: (methods) => void` to the renderer's options. When
provided, route methods through that callback **instead** of
`mutationRequest`. The workspace passes `(methods) =>
executeMethods({ mode: '<your-mode>', methods })`. Standalone callers (e.g.
`/venues/availability`) omit the callback and keep their direct-dispatch
behavior.

Either way: extend `queueService.test.ts` with at minimum a "queues in bulk
+ flushes in one save" pair tagged with your new mode.

## Things the queue does NOT do (today)

- **It does not persist across page reloads.** A user who refreshes mid-bulk
  loses the queue. This is intentional — recovering local in-memory
  mutations after a reload reopens the consistency questions the queue was
  designed to close.
- **It does not coordinate across browser tabs.** Two open tabs each have
  their own queue. If you need that, add cross-tab broadcasting via
  `BroadcastChannel` and reconcile both queues at save time — but think
  hard about what "save order" means when two operators are queuing
  simultaneously.
- **It does not mediate disagreements with remote mutations.** When another
  client mutates the tournament while you have pending changes,
  `refreshActiveTable` re-renders cells but does **not** rebase your
  pending methods. If a remote mutation invalidates a pending one, save
  surfaces the error from the server rather than self-resolving.

All three of these are tractable extensions if the workflow demands them.
None are load-bearing for the v1 workspace.

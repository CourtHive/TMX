# Scheduling workspace mutation paths

`/tournament/:id/scheduling/:date/:mode` supports four modes: Availability, Profile, Grid and Plan. They share navigation and presentation, but do not share one mutation queue.

| Mode         | Current write path                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Availability | Painter `onMutationMethods` → `queueService.executeMethods` → `mutationRequest` in immediate mode |
| Profile      | Calls `mutationRequest` directly for each edit; no `BulkScheduleDraft`                            |
| Grid         | `gridView.ts` owns `BulkScheduleDraft` previews, save and discard                                 |
| Plan         | Owns scenario edits                                                                               |

No production caller enables `queueService` bulk mode. Its unit tests describe that optional service behavior, not the active Grid save contract. Standalone `/venues/availability` painters keep their direct `mutationRequest` path.

## Availability and the optional service queue

- Immediate `executeMethods` dispatches through `mutationRequest`; its callback reports the result and refreshes the view.
- In optional bulk mode, successful local execution appends a method batch. `savePending` submits the valid batches in one request; it currently removes them before acknowledgement. This latent failure-recovery limitation must be repaired before enabling it in production.
- `discardPending` reloads IndexedDB. It may clobber concurrent changes or find no provider record; this is another reason to keep this service's bulk mode disabled. Discard must never dispatch the queued methods.
- Turning bulk mode off invokes discard. Callers must confirm unsaved changes first.
- Painter dirty state is separate from pending method batches. The painter buffers edits until its own Save callback produces methods; `savePending` invokes that callback without awaiting it.
- `subscribeQueue` notifies on queue transitions. This action bar reflects the Availability service, while Grid has its own save/discard controls.

## Grid recovery

`BulkScheduleDraft` owns an in-memory baseline and the preview independently of the rendered grid and IndexedDB. Failed saves retain the pending methods. Discard restores preview-owned fields while retaining concurrent changes; append-only timeItems histories remove only the preview delta. A full authoritative replacement invalidates the preview rather than rolling the replacement back. Navigation cancellation preserves both the draft and the current URL. The draft is not persisted across a reload and is not coordinated across browser tabs.

## Adding a mode

Choose its mutation boundary explicitly. A renderer using the Availability service may expose `onMutationMethods`; the workspace wires that hook to `executeMethods`, while standalone callers retain direct dispatch. A renderer with its own queue needs its own acknowledgement, discard, navigation and concurrent-update tests. Mounting Grid or Profile inside the workspace does not route their edits through this service.

The historical integration design is in `Mentat/planning/SCHEDULE2_AVAILABILITY_INTEGRATION.md`. Validate its proposals against the current source before treating them as implemented invariants.

# Returning to the tab: how TMX gets back in sync

When a director leaves TMX — switches tabs, navigates away and comes back, locks a phone, loses the network — other
directors may keep mutating the same tournament. TMX does **not** receive those mutations afterwards: Socket.IO keeps no
record of messages broadcast while a socket was closed, so they are not replayed. TMX instead **detects** that its copy
is behind the server and pulls the whole record, which brings every missed change at once.

## Leaving the page

When the browser is about to put the page into its back-forward cache (`pagehide` with `persisted`), TMX closes its
sockets itself: the `/tmx` socket, the scoring relay, and the chat relay's room and monitor sockets. Each socket is kept,
with its tournament and subscriptions, so it can be reopened. The browser therefore has no open socket to kill, which
is what used to log `WebSocket … failed: Page entered Back-Forward Cache`.

Closing a socket this way is still a disconnect: it sets the same "disconnected since last navigation" flag as a socket
the browser or the network drops, so everything below behaves identically either way.

## What happens when you come back to the tab

1. **Closing marks a disconnect.** The explicit close fires Socket.IO's `disconnect` event, so TMX sets
   `disconnectedSinceLastNav` exactly as when the browser kills the socket.
2. **The restore reconnects.** The page-lifecycle sweep — on `pageshow` (restored from the cache), `visibilitychange`
   (visible again) or `online` — reopens the same sockets. Sweeps closer together than 2 seconds are merged into one.
3. **Reconnecting rejoins the room and checks for missed writes.** Because the disconnect flag is set, the connect
   handler treats this as a reconnect: it re-joins the tournament room, replays anything written while offline, and
   calls the reconnect listeners.
4. **TMX compares its copy with the server's.** The staleness guard asks the server only for the tournament's last
   write time (not the record). If the server holds a write this tab never applied, it waits 2 seconds for an
   acknowledgement or broadcast still in flight, then marks the copy stale.
5. **Stale means blocked until refreshed.** The sync icon appears and every change is refused with "Please refresh
   tournament data before making changes", so nobody acts on old data. Clicking the icon pulls the full record, and every
   missed change arrives together.

If nothing was missed, the check clears the disconnect flag and nothing visible happens.

### Backstops

The same last-write-time check also runs:

- **every 45 seconds** while the tab is visible and a director is logged in, for a socket that dropped silently;
- **on becoming visible** when the 5-minute inactivity timer has expired or a disconnect occurred;
- **on every socket reconnect**, whatever caused the disconnect.

## Where this lives

| step                                                                                | code                                                                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Suspend on `pagehide`, recovery sweep on `pageshow` / `visibilitychange` / `online` | `src/services/messaging/connectionLifecycle.ts`                                                      |
| Disconnect flag, reconnect handling, reconnect listeners                            | `src/services/messaging/socketIo.ts` (`connectSocket`, `connectionEvent`)                            |
| Last-write-time probe, 2-second grace, 45-second poll, inactivity timer             | `src/services/staleness/stalenessGuard.ts`                                                           |
| Stale mode, the sync icon, pulling the record on click                              | `src/services/messaging/remoteMutations.ts` (`markStaleNeedsRefresh`, `refreshTournamentFromServer`) |
| Refusing changes while stale                                                        | `src/services/mutation/mutationRequest.ts`                                                           |

## Not automatic

Step 5 needs a click: TMX blocks changes and shows the icon but does not pull the record itself, by design — the
background checks never fetch the full record. One exception: when a super-admin moves the tournament to another
provider, CFS broadcasts `tournamentReplaced` and an open tab marks itself stale **and** pulls the record immediately.

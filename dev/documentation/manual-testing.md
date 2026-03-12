# TMX — Manual Testing Script

## Prerequisites

- `cd TMX && pnpm start` — Vite dev server on `localhost:5176`
- `cd competition-factory-server && pnpm watch` — NestJS server (for server-connected tests)
- Redis running (for server cache)
- Browser DevTools console open for log output
- Two browser windows/tabs for multi-client sync tests

### Quick Setup — Local Only

For tests that don't need a server connection, just run `pnpm start`.
Tournament data persists in IndexedDB between sessions.

---

## 1. Tournament List & Creation

### 1.1 Welcome view (empty state)

1. Clear IndexedDB (`Application → Storage → Clear site data` in DevTools)
2. Navigate to `/#/tournaments`
3. **Verify**: Welcome/onboarding view appears (no tournaments)
4. **Verify**: "Create Tournament" button is visible

### 1.2 Create a tournament

1. Click **Create Tournament**
2. Fill in tournament name, start/end dates, category
3. Click **Save**
4. **Verify**: Redirected to tournament Overview tab
5. **Verify**: Tournament header shows correct name and dates
6. Navigate back to `/#/tournaments`
7. **Verify**: New tournament appears in the list

### 1.3 Tournament table with Court SVG image

1. Create a tournament and add an event with a tennis matchUpFormat
2. Generate a draw for the event
3. Navigate to `/#/tournaments`
4. **Verify**: Tournament row shows a tennis court SVG (landscape) as its image
5. Repeat with a different sport format (e.g., pickleball `SET3-S:11/TB@RALLY`)
6. **Verify**: Correct court SVG renders for each sport

### 1.4 Import tournament from JSON

1. From the tournaments page, click the import/upload button
2. Select a valid tournament JSON file (or drag-drop onto the dropzone)
3. **Verify**: Tournament appears in list after import
4. Click to open — **Verify**: all data loads correctly (events, participants, draws)

### 1.5 Load tournament by ID (server required)

1. Log in to a provider
2. Click **Load by ID** and enter a valid tournament ID from the server
3. **Verify**: Tournament loads and renders

---

## 2. Tournament Navigation

### 2.1 Desktop sidebar navigation

1. Open any tournament
2. Click each nav icon in the sidebar: Overview, Participants, Events, MatchUps, Schedule, Venues, Publishing, Settings
3. **Verify**: Correct tab renders for each click
4. **Verify**: Active icon is highlighted blue (`var(--tmx-accent-blue)`)
5. **Verify**: Tooltip appears on hover when sidebar is collapsed

### 2.2 Mobile dropdown navigation

1. Resize browser to mobile width (< 768px)
2. **Verify**: Sidebar icons are replaced by a dropdown toggle
3. Tap the dropdown toggle
4. **Verify**: Menu opens with translated page names
5. Tap a page name (e.g., "Events")
6. **Verify**: Menu closes, correct tab renders, toggle label updates
7. Tap outside the menu — **Verify**: dropdown closes

### 2.3 Schedule2 tab visibility

1. Open DevTools console, run: `featureFlags.set({ schedule2: false })`
2. Navigate to a tournament — **Verify**: Schedule2 icon is hidden
3. Set `schedule2: true` — **Verify**: Schedule2 icon appears

---

## 3. Overview Tab

### 3.1 Dashboard panels

1. Open a tournament with events and participants
2. Navigate to Overview
3. **Verify**: Dashboard panels show tournament summary (participant count, event count, dates)
4. **Verify**: Notes section is visible

### 3.2 Edit tournament dates

1. Click the dates area to open the edit dates modal
2. Change start and/or end date
3. Save — **Verify**: Dates update in the header

### 3.3 Edit tournament notes

1. Click the notes section
2. Enter or edit notes text
3. Save — **Verify**: Notes persist after navigating away and back

---

## 4. Participants Tab

### 4.1 Add mock participants

1. Navigate to the Participants tab
2. Use the action menu to add mock participants (e.g., 32 individuals)
3. **Verify**: Participants table populates with generated names
4. **Verify**: Table supports sorting by column headers

### 4.2 Search and filter

1. Type a name fragment in the search box
2. **Verify**: Table filters to matching participants
3. Clear search — **Verify**: All participants return

### 4.3 Edit participant

1. Click a participant row to open the profile modal
2. Edit a field (e.g., nationality)
3. Save — **Verify**: Change reflected in the table

### 4.4 Delete participant

1. Select one or more participants
2. Choose delete from actions
3. Confirm — **Verify**: Participants removed from table
4. Navigate to Events — **Verify**: Removed participants no longer appear in entries

---

## 5. Events Tab

### 5.1 Create a singles event

1. Navigate to Events tab
2. Click **Add Event**
3. Set event type: Singles, select match format (e.g., Best of 3 sets)
4. Add participants to entries (accept some)
5. **Verify**: Event appears in event list with correct entry count

### 5.2 Create a doubles event

1. Add a Doubles event
2. Pair participants into doubles teams
3. **Verify**: Doubles pairs display correctly in entries

### 5.3 Generate a draw

1. Select an event with accepted entries
2. Click **Generate Draw**
3. Choose draw type (Single Elimination, Round Robin, etc.) and draw size
4. Click Generate
5. **Verify**: Bracket/draw renders with participants placed
6. **Verify**: Seeds are positioned correctly

### 5.4 Draw bracket — initial round selector

1. Open a large draw (32+ participants, Single Elimination)
2. Locate the initial round selector (round tabs at top)
3. Click through rounds sequentially: R1 → R2 → R3 → R4 → R5
4. **Verify**: Bracket re-renders showing from the selected round
5. **Verify**: Connector lines between rounds are correct at each step
6. Now click back down: R5 → R4 → R3 → R2
7. **Verify**: Connector lines remain correct (no broken vertical lines)
8. Jump directly: R1 → R4 → R2
9. **Verify**: Connector lines still render correctly

### 5.5 Draw position context menu

1. Click a participant name in the bracket
2. **Verify**: Context menu appears with available actions (e.g., Assign, Swap, Remove)
3. Select an action — **Verify**: Draw updates accordingly

### 5.6 Scoring a matchUp

1. Click a matchUp in the draw bracket
2. **Verify**: Scoring modal opens
3. Enter a score (e.g., `6-4, 6-3`)
4. Click Submit
5. **Verify**: Score appears on the bracket, winner advances to next round
6. **Verify**: MatchUp status updates (COMPLETED)

### 5.7 Ranking points view

1. Open an event that has completed matchUps
2. From the event menu (three-dot), select **Ranking Points**
3. **Verify**: Points table displays with columns: Participant, Finish, Wins, Position pts, Per Win, Bonus, Quality, Total
4. Use the policy dropdown to switch between ranking policies (Basic, ATP, WTA, etc.)
5. **Verify**: Point values update for each policy

### 5.8 Topology / schematic view

1. From a draw's Actions menu, select the topology/schematic option
2. **Verify**: Topology page renders with draw structure visualization
3. Navigate back — **Verify**: Returns to normal draw view

---

## 6. MatchUps Tab

### 6.1 Tournament matchUps listing

1. Navigate to the MatchUps tab
2. **Verify**: All tournament matchUps display in a table
3. **Verify**: Columns include round, participants, score, status, scheduled time

### 6.2 MatchUp actions

1. Click a matchUp row's action menu
2. **Verify**: Options include: Clear schedule, Start time, End time, Select official
3. Set a start time via the time picker
4. **Verify**: Time appears in the schedule column

---

## 7. Schedule Tab (Legacy)

### 7.1 Schedule grid display

1. Navigate to the Schedule tab
2. **Verify**: Calendar grid shows courts as columns and time slots as rows
3. **Verify**: Scheduled matchUps appear in their assigned cells

### 7.2 Date navigation

1. Click different dates in the date selector
2. **Verify**: Grid updates to show matchUps for the selected date

---

## 8. Schedule2 Tab (Feature-flagged)

> Requires `featureFlags.set({ schedule2: true })`

### 8.1 Three-column layout

1. Navigate to Schedule2
2. **Verify**: Three-column layout renders — left (dates/issues), center (court grid), right (catalog + inspector)
3. **Verify**: Left and right panels are collapsible

### 8.2 Drag-drop scheduling

1. Drag a matchUp from the catalog (right panel) onto a court/time cell in the grid
2. **Verify**: MatchUp appears in the grid cell
3. **Verify**: MatchUp is removed from the unscheduled catalog
4. Drag a scheduled matchUp from one cell to another
5. **Verify**: MatchUp moves to the new cell
6. Drag a matchUp from the grid back to the catalog
7. **Verify**: MatchUp returns to unscheduled list, cell clears

### 8.3 Conflict detection

1. Schedule two matchUps with the same participant at overlapping times
2. **Verify**: Conflict indicator appears (in issues panel or cell highlight)
3. Resolve the conflict by moving one matchUp
4. **Verify**: Conflict indicator clears

### 8.4 Scheduling profile builder

1. Open the profile view (toggle in Schedule2 header)
2. Select venues, rounds, and constraints
3. Click **Apply Schedule**
4. **Verify**: MatchUps are auto-scheduled according to the profile
5. **Verify**: No conflicts in the generated schedule

### 8.5 Bulk scheduling mode

1. Toggle bulk mode on (button in Schedule2 header)
2. Make several scheduling changes (drag/drop, time edits)
3. **Verify**: Changes appear locally but are NOT sent to server
4. **Verify**: `beforeunload` warning fires if you try to close the tab
5. Click **Save** — **Verify**: All changes batch-submit to server
6. Or click **Discard** — **Verify**: All local changes revert

---

## 9. Venues Tab

### 9.1 Add a venue

1. Navigate to Venues tab
2. Click **Add Venue**
3. Enter venue name, add courts (name, surface type)
4. Save — **Verify**: Venue appears in list with correct court count

### 9.2 Edit venue / courts

1. Click a venue to expand
2. Edit court names, surface types, or availability hours
3. Save — **Verify**: Changes persist

### 9.3 Venue availability in scheduling

1. Set venue operating hours (e.g., 9:00 AM – 5:00 PM)
2. Navigate to Schedule tab
3. **Verify**: Time picker restricts selections to within venue hours

---

## 10. Publishing Tab

### 10.1 Publish an event

1. Navigate to Publishing tab
2. Toggle an event to "Published"
3. **Verify**: Public URL is generated or status indicator updates

### 10.2 Unpublish

1. Toggle the event back to unpublished
2. **Verify**: Status reverts

---

## 11. Settings Tab

### 11.1 Tournament settings

1. Navigate to Settings
2. Review available settings (seeding policy, scheduling policy, entry restrictions)
3. Change a setting — **Verify**: Saved and reflected in relevant tabs

---

## 12. Theme & Font Settings (Global)

### 12.1 Theme switching

1. Navigate to global Settings (`/#/settings`)
2. Select **Dark** theme
3. **Verify**: Entire UI switches to dark color scheme
4. Select **Light** — **Verify**: UI switches back
5. Select **System** — **Verify**: Follows OS preference

### 12.2 Font family

1. In Settings, change font family to "Inter"
2. **Verify**: All text updates to Inter font (Google Font loads)
3. Switch to "Poppins" — **Verify**: Font changes again

### 12.3 Font size

1. In Settings, change font size to "xs" (13px)
2. **Verify**: All UI text shrinks (including tables, modals, navigation)
3. Change to "xl" (20px) — **Verify**: Text enlarges proportionally
4. **Verify**: courthive-components (schedule grid, buttons) scale with the size change
5. Reset to "md" (16px)

---

## 13. Authentication & Login

### 13.1 Login flow (server required)

1. Click the login icon in the header
2. Enter email and password
3. Click **Login**
4. **Verify**: UI updates to show logged-in state (user icon, provider info)
5. **Verify**: Server-dependent features become available (load by ID, sync)

### 13.2 Registration

1. Click **Register** from the login modal
2. Fill in name, email, password
3. Submit — **Verify**: Account created, user logged in

### 13.3 Logout

1. Click the user icon → Logout
2. **Verify**: UI reverts to logged-out state
3. **Verify**: Server-connected features are hidden/disabled

---

## 14. Multi-Client Sync (Server Required)

> These tests require two browser windows connected to the same server.

### 14.1 Tournament room registration

1. **Window A**: Log in, open a tournament
2. **Window B**: Log in, open the **same** tournament
3. **Verify** (server logs): Both clients joined the tournament room

### 14.2 Mutation broadcasting

1. **Window A**: Score a matchUp (enter `6-4, 6-3`, submit)
2. **Verify** (Window B): Sync indicator appears in the navbar (pulsing amber icon)
3. **Window B**: Click the sync indicator
4. **Verify**: Page re-renders with the new score visible
5. **Verify**: Sync indicator disappears after click

### 14.3 Sync indicator clears on navigation

1. **Window A**: Make another mutation (e.g., schedule a matchUp)
2. **Window B**: Sync indicator appears
3. **Window B**: Navigate to a different tab (e.g., Participants)
4. **Verify**: Sync indicator clears on navigation

### 14.4 Room leave on tournament switch

1. **Window B**: Navigate to a different tournament
2. **Window A**: Make a mutation on the original tournament
3. **Verify** (Window B): No sync indicator appears (left the room)

### 14.5 No room join when logged out

1. Open a tournament while **not logged in**
2. **Verify**: No `joinTournament` message sent (check DevTools Network → WS frames)
3. Log in → re-open the tournament
4. **Verify**: `joinTournament` message now sent

### 14.6 Server-first mutation acknowledgement

1. **Window A**: Open DevTools Network → WS tab
2. Score a matchUp
3. **Verify**: Client sends `executionQueue` message
4. **Verify**: Server responds with `ack` message
5. **Verify**: Only after ack does the local engine apply the mutation
6. **Verify**: `tournamentMutation` broadcast appears in Window B's WS frames

---

## 15. Offline / Local-Only Mode

### 15.1 Local mutations without server

1. Stop the competition-factory-server
2. Open TMX — load or create a tournament (no login)
3. Make mutations (score matchUps, schedule, edit participants)
4. **Verify**: All mutations apply locally and persist to IndexedDB
5. Refresh the page — **Verify**: Data persists

### 15.2 Offline tournament flag

1. Mark a tournament as "offline" (via timeItem)
2. Start the server and log in
3. Open the offline tournament
4. **Verify**: Mutations run locally, not through the server

---

## 16. Export

### 16.1 Export tournament JSON

1. From the tournament header menu, select **Export**
2. **Verify**: JSON file downloads with tournament data
3. **Verify**: File contains tournamentRecord with events, participants, draws

### 16.2 Print draw

1. Open a draw bracket
2. Click **Print** from the draw actions
3. **Verify**: Print-friendly view renders (or PDF generates if feature-flagged)

---

## 17. Electron Desktop (Desktop Build Only)

> Run with `pnpm electron:dev` or build the desktop app

### 17.1 Window management

1. Launch the Electron app
2. Resize the window, move it
3. Close and reopen — **Verify**: Window position and size are restored

### 17.2 Native file dialogs

1. Export a tournament — **Verify**: Native OS save dialog appears
2. Import a tournament — **Verify**: Native OS open dialog appears

### 17.3 DevTools toggle

1. Use the menu or shortcut to toggle DevTools
2. **Verify**: DevTools panel opens/closes

---

## 18. Internationalization (i18n)

### 18.1 Language switching

1. Open Settings → Language/Idiom selector
2. Switch to French (fr)
3. **Verify**: Navigation labels, button text, and toast messages display in French
4. Switch to Spanish (es) — **Verify**: UI updates
5. Return to English (en) — **Verify**: All labels restore

### 18.2 Mobile nav translations

1. In mobile view, open the nav dropdown
2. **Verify**: Page names show in the currently selected language

---

## Regression Checklist

After any significant change, verify these critical paths:

- [ ] Create tournament → add participants → create event → generate draw → score matchUp → winner advances
- [ ] Schedule a matchUp via time picker → verify time bounds respect venue hours
- [ ] Navigate all tournament tabs without errors
- [ ] Theme switch (Light → Dark → Light) renders correctly
- [ ] Font size change propagates to all components
- [ ] Import → Export → Re-import produces identical tournament
- [ ] Multi-client sync: mutation in Window A → indicator in Window B → click refreshes
- [ ] Mobile navigation dropdown works on all tabs
- [ ] Draw initial round selector: R1→R5→R2 produces correct connector lines

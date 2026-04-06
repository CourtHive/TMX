# Court Visibility & Targeting Plan

## Problem

Tournament directors often have access to only a subset of courts on certain days, or when
tournaments are re-created only a few courts (e.g. 1-3 and 10-12) are actually used. Scrolling
past empty court columns to find the courts in use is annoying.

## Phase 1: Court Visibility Toggle (schedule2 grid)

Replace the "Row" label in the grid corner with an `fa-eye` icon. Clicking opens a Tippy
popover listing all courts with toggles. Courts with zero matchUps on the current date are
visually distinguished and can be hidden.

### UX

- Eye icon in the sticky top-left corner cell of the CSS grid
- Badge count when courts are hidden
- Popover contents:
  - "Show all" / "Hide empty" quick-action buttons
  - Court list (grouped by venue when multiple venues), each with:
    - Court name
    - Match count for the date ("3 matchUps" or "empty")
    - Toggle switch (on = visible, off = hidden)
  - Empty courts shown muted
- Changes apply immediately (grid re-renders)
- `hiddenCourtIds` resets on date change (different days use different courts)

### Files

- `schedule2Tab/gridView.ts` — eye icon, visibility filtering in `render()`, popover

## Phase 2: Court Targeting for Pro Scheduling

Merge the auto-schedule court targeting concept (currently `fa-crosshairs` in the original
schedule tab's `courtTargetButton.ts`) into the schedule2 grid. The visibility popover gains
a second dimension: each court row shows both a visibility toggle and a targeting toggle.

Targeted courts are the ones the auto-scheduler (`scheduleProfileRounds` / `scheduleProfileGrid`)
will place matchUps on. This replaces the separate crosshairs button with an integrated UX.

### UX

- Same eye-icon popover from Phase 1, extended with a crosshairs column
- Each court row: `[toggle eye] Court Name (3 matchUps) [toggle crosshairs]`
- "Target all" / "Target visible" quick actions
- Targeted court IDs passed to factory scheduling methods via params
- Visual indicator on targeted court column headers (e.g. subtle accent border)

### Files

- `schedule2Tab/gridView.ts` — extend popover, pass targeted courts to executeMethods
- `schedule2Tab/profileView.ts` — pass targeted courts to `scheduleProfileRounds` / `scheduleProfileGrid`
- Possibly `schedule2Header.ts` if a header-level indicator is needed

## Phase 3: Persistence & Polish

- Persist hidden/targeted courts per tournament+date in localStorage
- Keyboard shortcut to toggle "Hide empty"
- Column header right-click → "Hide this court"
- Animated column collapse/expand transitions

## Architecture Notes

- Court grid is built entirely in TMX (`gridView.ts`), not in courthive-components
- `courtsData` comes from `competitionEngine.competitionScheduleMatchUps()`
- `MINIMUM_SCHEDULE_COLUMNS` (10) applies to visible courts only
- No changes needed in courthive-components for any phase

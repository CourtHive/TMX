# Draw Entries Modal Implementation

## Overview

Added a cellClick handler to the 'entries' column in the Draws table that opens a modal displaying participants assigned to a specific draw, with seeding functionality similar to the Event Entries 'Accepted' table.

## Files Created

### 1. Modal Entry Point
**`src/components/modals/drawEntriesModal.ts`**
- Main modal function that opens the draw entries modal
- Fetches draw and event data using tournamentEngine
- Maps entries to include participant details, ratings, rankings, and seeding
- Creates Tabulator table with control bar
- Filters out withdrawn entries
- Determines draw stage (MAIN or QUALIFYING) for proper seeding

**Key Features:**
- Uses `cModal` from courthive-components for consistent modal styling
- Large modal size (`is-large`) to accommodate table
- Control bar with entry count and seeding options
- Responsive table layout with collapse functionality

### 2. Column Definitions
**`src/components/modals/drawEntriesColumns/getDrawEntriesColumns.ts`**
- Column definitions for the draw entries table
- Similar structure to `getEntriesColumns` used in Event Entries view
- Includes columns for:
  - Row number
  - Responsive collapse
  - Participant name (formatted side-by-side)
  - Ranking (conditional visibility)
  - WTN rating (conditional visibility)
  - UTR rating (conditional visibility)
  - City/State (conditional visibility)
  - Seed number (editable with manual seeding, conditional visibility)

**Key Features:**
- Conditional column visibility based on data presence
- Numeric editor for seed number with validation (1 to entry count)
- Initially non-editable seed column (enabled via seeding selector)

### 3. Seeding Functionality
**`src/components/modals/drawEntriesColumns/seeding/drawEntriesSeedingSelector.ts`**
- Seeding options selector specific to draw entries modal
- Provides options for:
  - Manual seeding (enables editable seed column)
  - Clear seeding
  - Seed by ranking
  - Seed by WTN (if WTN data present)
  - Seed by UTR (if UTR data present)

**Key Features:**
- Reuses existing seeding functions from event entries:
  - `enableManualSeeding` - makes seed column editable
  - `clearSeeding` - removes all seed values
  - `generateSeedValues` - auto-generates seeds based on ratings
  - `cancelManualSeeding` - cancels manual seeding mode
  - `saveSeeding` - saves seed values to tournament data
- Determines group (ACCEPTED or QUALIFYING) based on draw stage
- Properly integrates with existing seeding infrastructure

### 4. Cell Click Handler
**`src/components/tables/eventsTable/drawEntriesClick.ts`**
- Simple handler that extracts eventId, drawId, eventName, and drawName
- Opens the drawEntriesModal with appropriate parameters

### 5. Updated Draws Columns
**`src/components/tables/eventsTable/getDrawsColumns.ts`**
- Added import for `drawEntriesClick`
- Added `cellClick` handler to 'entries' column
- Clicking on the entries count now opens the draw entries modal

## File Organization

```
TMX/
├── src/
│   ├── components/
│   │   ├── modals/
│   │   │   ├── drawEntriesModal.ts                           [NEW - Main modal]
│   │   │   └── drawEntriesColumns/
│   │   │       ├── getDrawEntriesColumns.ts                  [NEW - Column definitions]
│   │   │       └── seeding/
│   │   │           └── drawEntriesSeedingSelector.ts         [NEW - Seeding options]
│   │   └── tables/
│   │       └── eventsTable/
│   │           ├── drawEntriesClick.ts                       [NEW - Click handler]
│   │           ├── getDrawsColumns.ts                        [MODIFIED - Added cellClick]
│   │           └── seeding/                                  [REUSED - Existing seeding functions]
│   │               ├── enableManualSeeding.ts
│   │               ├── generateSeedValues.ts
│   │               ├── clearSeeding.ts
│   │               ├── cancelManualSeeding.ts
│   │               └── saveSeeding.ts
```

## Pattern Followed

### 1. CellClick Handler Pattern
Follows the established pattern from other tables:
```typescript
export const drawEntriesClick = (eventRow: any) => (_e: Event, cell: any): void => {
  const { eventId, eventName } = eventRow.getData();
  const { drawId, drawName } = cell.getRow().getData();
  
  drawEntriesModal({ eventName, eventId, drawName, drawId });
};
```

### 2. Modal Pattern
Uses courthive-components `cModal`:
```typescript
cModal.open({
  title: modalTitle,
  content,
  buttons: [{ label: 'Close', close: true }],
  config: { modalSize: 'is-large' },
});
```

### 3. Table Pattern
Uses Tabulator with standard TMX configuration:
- `headerSortElement` for sortable columns
- `responsiveLayout: 'collapse'` for mobile view
- `index: 'participantId'` for row identification
- `layout: 'fitColumns'` for responsive sizing
- `reactiveData: true` for live updates

### 4. Control Bar Pattern
Uses existing `controlBar` component with items array:
```typescript
const items = [
  { label: 'Entry count', location: LEFT, stateDisplay: true },
  drawEntriesSeedingSelector(event, drawStage, table),
  cancelManualSeeding(event),
  saveSeeding(event),
];

controlBar({ target: controlElement, table, items });
```

### 5. Seeding Pattern
Reuses existing seeding infrastructure:
- Same seeding functions used in Event Entries
- Determines appropriate "group" based on draw stage
- Manual seeding toggles column editability
- Auto-seeding generates values based on ratings with confidence bands
- Save/Cancel functionality integrated with tournament engine

## Usage

1. Navigate to Events tab
2. Expand an event to see its draws
3. Click on the entries count number in any draw row
4. Modal opens showing all participants in that draw
5. Use Seeding dropdown to:
   - Enable manual seeding (makes Seed column editable)
   - Auto-generate seeds by ranking, WTN, or UTR
   - Clear all seeding
6. Click "Save" to persist seed changes
7. Click "Cancel" to discard manual seed changes
8. Click "Close" to close the modal

## Technical Details

### Data Flow
1. **Click** → `drawEntriesClick` handler extracts eventId, drawId, eventName, drawName
2. **Fetch** → `tournamentEngine.getEvent()` retrieves event and draw definition
3. **Map** → `mapEntry()` enriches entries with participant details, ratings, rankings
4. **Filter** → Remove withdrawn entries
5. **Render** → Create modal with table and control bar
6. **Seed** → Optional seeding operations via control bar

### Stage Detection
The modal automatically determines whether the draw is MAIN or QUALIFYING:
```typescript
const drawStage = drawDefinition.stage || 'MAIN';
```

This ensures seeding is applied to the correct scale:
- MAIN stage → uses eventId as scaleName
- QUALIFYING stage → uses `${eventId}QUALIFYING` as scaleName

### Column Visibility
Columns show/hide based on data presence:
- Rankings: shown if any entry has ranking
- WTN: shown if any entry has WTN rating
- UTR: shown if any entry has UTR rating
- City/State: shown if any entry has city/state
- Seed: shown if any entry has seed number, or after seeding operation

## Benefits

1. **Consistency**: Uses same patterns and components as Event Entries view
2. **Reusability**: Leverages existing seeding infrastructure
3. **Maintainability**: Well-organized file structure with clear separation of concerns
4. **User Experience**: Familiar interface for users already using Event Entries seeding
5. **Flexibility**: Supports both manual and automatic seeding workflows

## Future Enhancements

Potential improvements:
- Add participant actions (similar to Event Entries)
- Add ability to withdraw/add participants
- Export draw entries to CSV
- Print draw entries report
- Add search/filter functionality
- Add drag-and-drop seeding

# Grid Booking UI Implementation Guide

## Overview
This document outlines the TMX UI changes needed to support grid-based court bookings for proScheduling.

## Factory Backend Changes (✅ COMPLETED)

1. **Schema Updated**: Added `courtOrder` and `rowCount` fields to `Booking` type
2. **Created `getGridBookings()`**: Separates grid bookings from time bookings  
3. **Updated `courtGridRows()`**: Marks blocked cells in the grid
4. **Updated `proAutoSchedule()`**: Skips blocked cells when scheduling
5. **Created `addCourtGridBooking()`**: Adds grid bookings with validation
6. **Created `removeCourtGridBooking()`**: Removes grid bookings
7. **Added Error Constants**: `BOOKING_NOT_FOUND`, `EXISTING_MATCHUPS`
8. **Exported from scheduleGovernor**: Both new mutation functions

---

## TMX UI Implementation (TODO)

### 1. Empty Cell Menu Handler

**File**: `/TMX/src/components/popovers/scheduleEmptyCellMenu.ts`

```typescript
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { context } from 'services/context';
import { RIGHT } from 'constants/tmxConstants';

export function scheduleEmptyCellMenu({ e, cell }: { e: Event; cell: any }): void {
  const rowData = cell.getRow().getData();
  const field = cell.getColumn().getDefinition().field;
  const cellData = rowData[field];
  const { courtId, courtOrder, venueId } = cellData.schedule || {};
  
  const blockCourt = (rowCount: number, bookingType: string = 'BLOCKED') => {
    const scheduledDate = context.router.params.date;
    
    const methods = [
      {
        method: 'addCourtGridBooking',
        params: {
          courtId,
          scheduledDate,
          courtOrder,
          rowCount,
          bookingType,
        },
      },
    ];
    
    const postMutation = (result: any) => {
      if (result.success) {
        // Refresh the schedule grid
        window.location.reload();
      }
    };
    
    mutationRequest({ methods, callback: postMutation });
  };
  
  const options = [
    {
      option: 'Block this row',
      onClick: () => blockCourt(1, 'BLOCKED'),
    },
    {
      option: 'Block 2 rows',
      onClick: () => blockCourt(2, 'BLOCKED'),
    },
    {
      option: 'Block 3 rows',
      onClick: () => blockCourt(3, 'BLOCKED'),
    },
    {
      option: 'Mark for practice (1 row)',
      onClick: () => blockCourt(1, 'PRACTICE'),
    },
    {
      option: 'Mark for maintenance (1 row)',
      onClick: () => blockCourt(1, 'MAINTENANCE'),
    },
  ].filter(Boolean);
  
  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}
```

### 2. Blocked Cell Menu Handler

**File**: `/TMX/src/components/popovers/scheduleBlockedCellMenu.ts`

```typescript
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tipster } from 'components/popovers/tipster';
import { context } from 'services/context';
import { RIGHT } from 'constants/tmxConstants';

export function scheduleBlockedCellMenu({ 
  e, 
  cell, 
  booking 
}: { 
  e: Event; 
  cell: any; 
  booking: any;
}): void {
  const rowData = cell.getRow().getData();
  const field = cell.getColumn().getDefinition().field;
  const cellData = rowData[field];
  const { courtId, courtOrder } = cellData.schedule || {};
  const scheduledDate = context.router.params.date;
  
  const unblockCourt = () => {
    const methods = [
      {
        method: 'removeCourtGridBooking',
        params: {
          courtId,
          scheduledDate,
          courtOrder: booking.courtOrder,  // Use original booking courtOrder
        },
      },
    ];
    
    const postMutation = (result: any) => {
      if (result.success) {
        window.location.reload();
      }
    };
    
    mutationRequest({ methods, callback: postMutation });
  };
  
  const rowText = booking.rowCount > 1 ? `${booking.rowCount} rows` : '1 row';
  const bookingLabel = booking.bookingType || 'BLOCKED';
  
  const options = [
    {
      option: `Unblock ${rowText} (${bookingLabel})`,
      onClick: unblockCourt,
    },
    booking.notes && {
      option: `Notes: ${booking.notes}`,
      disabled: true,
    },
  ].filter(Boolean);
  
  const target = e.target as HTMLElement;
  tipster({ options, target, config: { placement: RIGHT } });
}
```

### 3. Update Schedule Cell Formatter

**File**: `/TMX/src/components/tables/common/formatters/scheduleCell.ts`

Add to the beginning of the function (after inactive check):

```typescript
  // Handle blocked cells
  if (value?.isBlocked) {
    content.className = 'schedule-cell blocked-cell';
    const booking = value.booking;
    
    const blockLabel = document.createElement('div');
    blockLabel.className = 'block-label';
    
    const blockType = document.createElement('div');
    blockType.className = 'block-type';
    blockType.textContent = booking.bookingType || 'BLOCKED';
    blockLabel.appendChild(blockType);
    
    if (booking.rowCount && booking.rowCount > 1) {
      const rowInfo = document.createElement('div');
      rowInfo.className = 'block-rows';
      rowInfo.textContent = `${booking.rowCount} rows`;
      blockLabel.appendChild(rowInfo);
    }
    
    if (booking.notes) {
      const notes = document.createElement('div');
      notes.className = 'block-notes';
      notes.textContent = booking.notes;
      blockLabel.appendChild(notes);
    }
    
    content.appendChild(blockLabel);
    return content;
  }
```

### 4. Update Schedule Columns Cell Click Handler

**File**: `/TMX/src/components/tables/scheduleTable/getScheduleColumns.ts`

Update the `scheduleCellActions` function:

```typescript
  const scheduleCellActions = (e: any, cell: any) => {
    const field = cell.getColumn().getDefinition().field;
    const cellData = cell.getData()[field];
    
    // Handle blocked cells
    if (cellData?.isBlocked) {
      scheduleBlockedCellMenu({ e, cell, booking: cellData.booking });
      return;
    }
    
    // Handle empty cells
    if (!cellData?.matchUpId) {
      scheduleEmptyCellMenu({ e, cell });
      return;
    }
    
    // Handle matchUp cells (existing code)
    const { drawId, matchUpId } = cellData;
    const callback = () => {
      const matchUp = tournamentEngine.allTournamentMatchUps({
        matchUpFilters: { drawIds: [drawId], matchUpIds: [matchUpId] },
        nextMatchUps: true,
      })?.matchUps?.[0];
      const targetRow = cell.getRow().getData();
      targetRow[field] = matchUp;
      const table = cell.getTable();
      table.updateData([targetRow]);
    };
    scheduleSetMatchUpHeader({ e, cell, matchUpId, callback });
  };
```

Add imports at the top:

```typescript
import { scheduleBlockedCellMenu } from 'components/popovers/scheduleBlockedCellMenu';
import { scheduleEmptyCellMenu } from 'components/popovers/scheduleEmptyCellMenu';
```

### 5. Add CSS Styling for Blocked Cells

**File**: `/TMX/src/styles/schedule.css` (or appropriate stylesheet)

```css
.blocked-cell {
  background-color: #f5f5f5;
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(0, 0, 0, 0.05) 10px,
    rgba(0, 0, 0, 0.05) 20px
  );
  border: 2px dashed #999;
  opacity: 0.8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.blocked-cell:hover {
  background-color: #e8e8e8;
  opacity: 0.9;
}

.block-label {
  padding: 10px;
  text-align: center;
  color: #666;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.block-type {
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.9em;
  color: #333;
  margin-bottom: 4px;
}

.block-rows {
  font-size: 0.8em;
  color: #666;
  margin-bottom: 4px;
}

.block-notes {
  font-size: 0.75em;
  font-style: italic;
  color: #888;
  margin-top: 4px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Different colors for different booking types */
.blocked-cell[data-booking-type="PRACTICE"] {
  background-color: #e3f2fd;
  border-color: #2196f3;
}

.blocked-cell[data-booking-type="MAINTENANCE"] {
  background-color: #fff3e0;
  border-color: #ff9800;
}

.blocked-cell[data-booking-type="BLOCKED"] {
  background-color: #ffebee;
  border-color: #f44336;
}
```

---

## Testing Plan

### Unit Tests
1. Test `getGridBookings()` with mixed time/grid bookings
2. Test `courtGridRows()` correctly marks blocked cells
3. Test `proAutoSchedule()` skips blocked cells
4. Test `addCourtGridBooking()` detects conflicts
5. Test `removeCourtGridBooking()` removes correct booking

### Integration Tests
1. Schedule matchUps with existing grid bookings
2. Add bookings that conflict with scheduled matchUps
3. Remove bookings and verify grid updates
4. Test edge cases: row 1, last row, multiple consecutive rows
5. Test UI interactions: click empty cell, click blocked cell
6. Test visual styling of blocked cells

### Manual Testing Steps
1. Open schedule page with a date that has some matchUps
2. Click on an empty cell → verify "Block court" menu appears
3. Select "Block this row" → verify cell becomes blocked
4. Click blocked cell → verify "Unblock" menu appears
5. Try to auto-schedule matchUps → verify blocked cells are skipped
6. Test blocking multiple consecutive rows
7. Test different booking types (PRACTICE, MAINTENANCE)

---

## Implementation Priority

1. ✅ **Factory backend** (DONE)
2. **TMX UI Components** (TODO - next step):
   - Create `scheduleEmptyCellMenu.ts`
   - Create `scheduleBlockedCellMenu.ts`
   - Update `scheduleCell.ts` formatter
   - Update `getScheduleColumns.ts` click handler
3. **CSS Styling** (TODO)
4. **Testing** (TODO)

---

## Notes

- **Backward Compatibility**: Time-based bookings (`startTime`/`endTime`) continue to work unchanged
- **Data Persistence**: Bookings are stored in `court.dateAvailability.bookings[]`
- **Conflict Detection**: `addCourtGridBooking()` validates against existing matchUps
- **Grid Row Reference**: Uses `courtOrder` (1-based row number) instead of time
- **Multiple Rows**: `rowCount` parameter allows blocking consecutive rows with one booking
- **Visual Distinction**: Different booking types can have different colors/styling

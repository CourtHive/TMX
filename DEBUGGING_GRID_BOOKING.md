# Debugging Grid Booking UI

## Issue (RESOLVED ✅)
Menu appeared but factory methods weren't being called when clicking menu items.

## Root Cause
**Error**: `Cannot read properties of undefined (reading 'date')` at `context.router.params.date`

**Fix**: Changed to `context.displayed.selectedScheduleDate` (the correct way to access the current schedule date)

## Fixed Files
- ✅ `/src/components/popovers/scheduleEmptyCellMenu.ts` 
- ✅ `/src/components/popovers/scheduleBlockedCellMenu.ts`

## Changes Made

### 1. Updated Menu Text
Changed menu options to clarify "court" blocking (not entire row):
- ✅ "Block court (1 row)" instead of "Block this row"
- ✅ "Block court (2 rows)" instead of "Block 2 rows"
- ✅ "Block court (3 rows)" instead of "Block 3 rows"
- ✅ "Mark court for practice (1 row)"
- ✅ "Mark court for maintenance (1 row)"
- ✅ "Unblock court (1 row, BLOCKED)" instead of "Unblock 1 row (BLOCKED)"

### 2. Added Console Logging

#### In `getScheduleColumns.ts` - Cell Click Handler
```typescript
console.log('scheduleCellActions:', { 
  field, 
  cellData, 
  isBlocked: cellData?.isBlocked, 
  hasMatchUpId: !!cellData?.matchUpId 
});
console.log('Routing to scheduleEmptyCellMenu'); // or scheduleBlockedCellMenu, etc
```

#### In `scheduleEmptyCellMenu.ts`
```typescript
console.log('scheduleEmptyCellMenu called');
console.log('Empty cell data:', { rowData, field, cellData });
console.log('Extracted data:', { courtId, courtOrder });
console.log('blockCourt called:', { courtId, scheduledDate, courtOrder, rowCount, bookingType });
console.log('addCourtGridBooking result:', result);
```

#### In `scheduleBlockedCellMenu.ts`
```typescript
console.log('scheduleBlockedCellMenu called', { booking });
console.log('Blocked cell data:', { rowData, field, cellData });
console.log('Extracted data:', { courtId, scheduledDate });
console.log('unblockCourt called:', { courtId, scheduledDate, courtOrder: booking.courtOrder });
console.log('removeCourtGridBooking result:', result);
```

## How to Debug

### Step 1: Open Browser Console
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Clear console (⌘K or Ctrl+L)

### Step 2: Click on a Schedule Cell
When you click any cell in the schedule grid, you should see:
```
scheduleCellActions: {
  field: "court0",
  cellData: { ... },
  isBlocked: false,
  hasMatchUpId: false
}
Routing to scheduleEmptyCellMenu
```

**If you DON'T see this**, the click handler isn't working at all.

### Step 3: Check Empty Cell Menu
After clicking an empty cell, you should see:
```
scheduleEmptyCellMenu called
Empty cell data: { rowData: {...}, field: "court0", cellData: {...} }
Extracted data: { courtId: "abc-123", courtOrder: 5 }
```

**If courtId or courtOrder is undefined**, the cell data structure isn't correct.

### Step 4: Click a Menu Option
When you click "Block court (1 row)", you should see:
```
blockCourt called: {
  courtId: "abc-123",
  scheduledDate: "2024-01-15",
  courtOrder: 5,
  rowCount: 1,
  bookingType: "BLOCKED"
}
```

**If you DON'T see this**, the onClick handler in the tipster menu isn't working.

### Step 5: Check Mutation Result
After the factory method is called, you should see:
```
addCourtGridBooking result: { success: true, booking: {...} }
```

**If you see an error**, check the error details:
```
Failed to block court: { message: "...", code: "..." }
```

## Common Issues & Solutions

### Issue 1: Menu doesn't appear
**Symptom**: No logs at all when clicking cell
**Likely cause**: Click handler not attached
**Solution**: Check that `cellClick: scheduleCellActions` is set in column config

### Issue 2: Menu appears but no logs when clicking options
**Symptom**: Menu shows, but no "blockCourt called" log
**Likely cause**: onClick handler not being triggered by tipster
**Solution**: Check tipster implementation and option structure

### Issue 3: courtId or courtOrder is undefined
**Symptom**: "Missing courtId or courtOrder, cannot show menu"
**Likely cause**: Cell data structure doesn't match expected format
**Solution**: Check what's in `cellData` - it should have a `schedule` property with `courtId` and `courtOrder`

### Issue 4: Factory method called but fails
**Symptom**: "addCourtGridBooking result: { error: {...} }"
**Likely causes**:
- Invalid parameters (check error message)
- Court not found
- Booking conflict
- Missing tournament record
**Solution**: Check the error code and message in the result

### Issue 5: Factory method returns success but no reload
**Symptom**: Logs show success but page doesn't reload
**Likely cause**: window.location.reload() not working
**Solution**: Check browser console for any errors preventing reload

## Expected Data Structures

### Empty Cell Data
```typescript
{
  schedule: {
    courtId: string,    // e.g., "abc-123"
    courtOrder: number, // e.g., 5
    venueId: string     // e.g., "venue-xyz"
  }
}
```

### Blocked Cell Data
```typescript
{
  isBlocked: true,
  booking: {
    courtOrder: number,    // e.g., 3
    rowCount: number,      // e.g., 2
    bookingType: string,   // e.g., "BLOCKED"
    notes?: string,        // e.g., "Court maintenance"
    createdAt: string      // e.g., "2024-01-15T10:30:00Z"
  },
  schedule: {
    courtId: string,
    courtOrder: number,
    venueId: string
  }
}
```

## Next Steps Based on Logs

1. **If no logs appear**: Check if schedule grid is using the updated build
2. **If "scheduleEmptyCellMenu called" appears**: Good! Menu function is reached
3. **If "blockCourt called" appears**: Good! onClick is working
4. **If mutation result shows success**: Perfect! Factory is working
5. **If mutation result shows error**: Investigate the specific error code

## Removing Debug Logs

Once issue is resolved, remove console.log statements from:
- `/src/components/tables/scheduleTable/getScheduleColumns.ts`
- `/src/components/popovers/scheduleEmptyCellMenu.ts`
- `/src/components/popovers/scheduleBlockedCellMenu.ts`

Search for `console.log` and remove all debugging statements added in this session.

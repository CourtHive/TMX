# Draw Entries Modal - Quick Start Guide

## 🎯 What Was Added

A **clickable entries column** in the Draws table that opens a modal showing all participants in that draw with full seeding functionality.

## 🚀 How to Test

### Step 1: Navigate to Events Tab
1. Open TMX application
2. Load a tournament with events
3. Go to **Events** tab

### Step 2: Expand an Event
1. Find an event with draws (e.g., "Men's Singles")
2. Click to expand the event row
3. You'll see a sub-table with all draws for that event

### Step 3: Open Draw Entries Modal
1. Look for the **"Entries"** column in the draws table
2. You'll see a number (e.g., "32", "16", "8")
3. **Click on this number** → Modal opens! 🎉

### Step 4: Explore the Modal

#### What You'll See:
```
┌────────────────────────────────────────────────────┐
│     Main Draw Entries - Men's Singles              │
├────────────────────────────────────────────────────┤
│ Control Bar:                                       │
│   [32 Entries]   [Seeding ▼] [Cancel] [Save]      │
│                                                    │
│ Table with columns:                                │
│   # | Name | Rank | WTN | UTR | City/State | Seed │
│                                                    │
│   [Close]                                          │
└────────────────────────────────────────────────────┘
```

## 🎮 Test Scenarios

### Scenario 1: View Draw Entries
✅ **Test:** Click entries count  
✅ **Expected:** Modal opens with participant list  
✅ **Verify:** All participants shown (except withdrawn)  

### Scenario 2: Manual Seeding
1. Click **[Seeding ▼]**
2. Select **"Manual seeding"**
3. ✅ **Expected:** Seed column becomes editable
4. Click on a seed cell and type a number (e.g., "3")
5. Click **[Save]**
6. ✅ **Expected:** Seed saved successfully

### Scenario 3: Auto-Seed by WTN
1. Click **[Seeding ▼]**
2. Select **"Seed by WTN"**
3. ✅ **Expected:** Seeds assigned automatically based on WTN ratings
4. ✅ **Verify:** Higher WTN ratings get lower seed numbers
5. Click **[Save]** to persist

### Scenario 4: Auto-Seed by UTR
1. Click **[Seeding ▼]**
2. Select **"Seed by UTR"**
3. ✅ **Expected:** Seeds assigned automatically based on UTR ratings
4. ✅ **Verify:** Higher UTR ratings get lower seed numbers
5. Click **[Save]** to persist

### Scenario 5: Clear Seeding
1. (After seeding is applied)
2. Click **[Seeding ▼]**
3. Select **"Clear seeding"**
4. ✅ **Expected:** All seed numbers removed immediately

### Scenario 6: Cancel Manual Seeding
1. Click **[Seeding ▼]**
2. Select **"Manual seeding"**
3. Edit some seed values
4. Click **[Cancel]**
5. ✅ **Expected:** Changes discarded, original values restored

## 🔍 Edge Cases to Test

### Empty/Small Draws
- [ ] Draw with 0 entries → Modal shows "No entries in this draw"
- [ ] Draw with 1 entry → Seed column works correctly
- [ ] Draw with 2 entries → Both entries visible

### Missing Data
- [ ] Participant without WTN → WTN column shows empty/placeholder
- [ ] Participant without UTR → UTR column shows empty/placeholder
- [ ] Participant without ranking → Ranking column shows empty
- [ ] Participant without city/state → City/State column hidden or empty

### Qualifying Draws
- [ ] Open entries for a **Qualifying** draw
- [ ] Verify modal title shows "Qualifying Entries"
- [ ] Verify seeding works correctly (uses QUALIFYING scale)

### Multiple Draws
- [ ] Event with 2+ draws (e.g., Main Draw + Qualifying)
- [ ] Click entries for Draw 1 → correct participants shown
- [ ] Close modal
- [ ] Click entries for Draw 2 → correct participants shown
- [ ] Verify each draw shows its own participants

## 🎨 Visual Verification

### Control Bar
```
┌─────────────────────────────────────────────────────┐
│ [32 Entries] │        │ [Seeding ▼] [Cancel] [Save] │
│   (LEFT)     │        │         (RIGHT)             │
└─────────────────────────────────────────────────────┘
```

### Table Columns (all present)
- ✅ Row number (#)
- ✅ Collapse indicator ([+]/[-])
- ✅ Participant name
- ✅ Ranking (if data exists)
- ✅ WTN (if data exists)
- ✅ UTR (if data exists)
- ✅ City/State (if data exists)
- ✅ Seed (if seeding applied)

### Modal Styling
- ✅ Large modal (`is-large` size)
- ✅ Minimum width: 800px
- ✅ Maximum width: 95vw
- ✅ Close button at bottom
- ✅ Proper spacing between control bar and table

## 🐛 Known Issues / Limitations

### Current Behavior
- Withdrawn entries are **excluded** from the modal (by design)
- Seed column **hidden** until seeding is applied or entries have seeds
- Control bar buttons appear/disappear based on state

### Not Yet Implemented
- Participant actions (move, withdraw, etc.) - see Future Enhancements
- Search/filter functionality
- Export to CSV
- Print functionality

## 📱 Responsive Testing

### Desktop (> 1024px)
- [ ] All columns visible
- [ ] Proper spacing
- [ ] Modal centers correctly

### Tablet (768px - 1024px)
- [ ] Responsive collapse indicator appears
- [ ] Less critical columns hidden
- [ ] Table remains readable

### Mobile (< 768px)
- [ ] Responsive collapse works
- [ ] Click [+] to expand row details
- [ ] Modal fits within screen
- [ ] Control bar stacks vertically if needed

## ✅ Acceptance Criteria Verification

| Criteria | Status | Notes |
|----------|--------|-------|
| CellClick handler on entries column | ✅ | `drawEntriesClick` added |
| Modal opens showing draw entries | ✅ | `drawEntriesModal` function |
| Table similar to Event Entries | ✅ | Uses same column structure |
| Seeding functionality | ✅ | Full seeding dropdown |
| Column toggles to editable | ✅ | Manual seeding enables editing |
| Files in appropriate folders | ✅ | See file structure |
| Follows existing patterns | ✅ | Consistent with TMX patterns |
| Build succeeds | ✅ | No TypeScript errors |

## 🎯 Quick Test Checklist

**5-Minute Smoke Test:**
- [ ] Open TMX
- [ ] Go to Events tab
- [ ] Expand any event
- [ ] Click entries count → modal opens
- [ ] See participant list
- [ ] Click Seeding → Manual seeding
- [ ] Seed column editable
- [ ] Type seed number
- [ ] Click Save
- [ ] Close modal
- [ ] ✅ Test passed!

## 📝 Testing Notes Template

Use this template when testing:

```markdown
## Test Session: [Date]
**Tester:** [Your Name]
**Build:** [Commit Hash]
**Browser:** [Chrome/Firefox/Safari/Edge]

### Test Results:
- [ ] Scenario 1: View Draw Entries
  - Status: PASS/FAIL
  - Notes: 

- [ ] Scenario 2: Manual Seeding
  - Status: PASS/FAIL
  - Notes: 

- [ ] Scenario 3: Auto-Seed by WTN
  - Status: PASS/FAIL
  - Notes: 

### Issues Found:
1. [Description]
   - Severity: High/Medium/Low
   - Steps to reproduce:
   - Expected:
   - Actual:

### Overall Assessment:
- [ ] Ready for production
- [ ] Needs fixes
- [ ] Requires more testing
```

## 🆘 Troubleshooting

### Modal doesn't open
- ✅ Check console for errors
- ✅ Verify `drawEntriesClick` is imported in `getDrawsColumns.ts`
- ✅ Verify `cellClick` is added to entries column

### No participants shown
- ✅ Check if draw has entries (`drawDefinition.entries`)
- ✅ Verify entries are not all WITHDRAWN
- ✅ Check console for `tournamentEngine.getEvent()` errors

### Seeding doesn't work
- ✅ Verify seeding buttons appear in control bar
- ✅ Check if event has rating/ranking data
- ✅ Look for errors in `generateSeedValues()` call
- ✅ Verify `drawStage` is set correctly

### Table looks wrong
- ✅ Check Tabulator initialization
- ✅ Verify `getDrawEntriesColumns()` returns correct structure
- ✅ Check for CSS conflicts
- ✅ Verify modal width settings

## 📞 Support

If you encounter issues:
1. Check **DRAW_ENTRIES_MODAL_IMPLEMENTATION.md** for detailed docs
2. Review **DRAW_ENTRIES_FLOW_DIAGRAM.md** for architecture
3. See **DRAW_ENTRIES_SUMMARY.md** for overview
4. Check browser console for errors
5. Contact development team with:
   - Steps to reproduce
   - Console errors
   - Screenshots
   - Browser/OS info

---

**Last Updated:** January 31, 2026  
**Feature Version:** 1.0.0  
**Status:** ✅ Ready for Testing

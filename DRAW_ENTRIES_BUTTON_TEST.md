# Draw Entries Modal - Save/Cancel Button Test

## How It Works

The Save and Cancel buttons ARE implemented and should appear automatically when you enable manual seeding.

### Button Configuration

```typescript
// Control bar items in drawEntriesModal.ts
const items = [
  { label: '32 Entries', ... },           // Entry count (always visible)
  drawEntriesSeedingSelector(...),        // [Seeding ▼] dropdown (has class 'drawEntriesSeedingOptions')
  cancelManualSeeding(event),             // [Cancel] button (has class 'cancelManualSeeding', initially hidden)
  saveSeeding(event),                     // [Save seeding] button (has class 'saveSeeding', initially hidden)
];
```

### Button States

**Initial State:**
```
┌──────────────────────────────────────────────┐
│ Control Bar:                                 │
│ [32 Entries]  |  [Seeding ▼]                │
│                  (visible)                   │
│                                              │
│ Hidden buttons (display: none):             │
│   [Cancel] (class: cancelManualSeeding)     │
│   [Save seeding] (class: saveSeeding)       │
└──────────────────────────────────────────────┘
```

**After Clicking "Manual seeding":**
```
┌──────────────────────────────────────────────┐
│ Control Bar:                                 │
│ [32 Entries]  |  [Cancel] [Save seeding]    │
│                   (visible) (visible)        │
│                                              │
│ Hidden button (display: none):              │
│   [Seeding ▼] (class: drawEntriesSeedingOptions)│
└──────────────────────────────────────────────┘
```

## Test Checklist

### ✅ Step 1: Open Modal
- [ ] Navigate to Events tab
- [ ] Expand an event to see draws
- [ ] Click on entries count number
- [ ] **Verify:** Modal opens wide (1400px)
- [ ] **Verify:** Control bar shows: `[32 Entries] [Seeding ▼]`
- [ ] **Verify:** No Save or Cancel buttons visible yet

### ✅ Step 2: Enable Manual Seeding
- [ ] Click **[Seeding ▼]** dropdown
- [ ] Select **"Manual seeding"**
- [ ] **Verify:** [Seeding ▼] button disappears
- [ ] **Verify:** [Cancel] button appears in same location
- [ ] **Verify:** [Save seeding] button appears next to Cancel
- [ ] **Verify:** Seed column cells get blue border (editable)

### ✅ Step 3: Edit Seeds
- [ ] Click on a Seed column cell
- [ ] Type a number (e.g., "3")
- [ ] Press Enter
- [ ] **Verify:** Seed value updates in cell
- [ ] **Verify:** Buttons still visible

### ✅ Step 4: Save Seeds
- [ ] Click **[Save seeding]** button
- [ ] **Verify:** [Cancel] and [Save seeding] buttons disappear
- [ ] **Verify:** [Seeding ▼] button reappears
- [ ] **Verify:** Seed values persisted
- [ ] **Verify:** Seed column no longer editable (no blue border)

### ✅ Step 5: Cancel Changes
- [ ] Click **[Seeding ▼]** → **"Manual seeding"** again
- [ ] Edit some seed values
- [ ] Click **[Cancel]** button
- [ ] **Verify:** [Cancel] and [Save seeding] buttons disappear
- [ ] **Verify:** [Seeding ▼] button reappears
- [ ] **Verify:** Seed values reverted to original
- [ ] **Verify:** Seed column no longer editable

### ✅ Step 6: Auto-Seeding
- [ ] Click **[Seeding ▼]**
- [ ] Select **"Seed by WTN"** (or UTR)
- [ ] **Verify:** Seeds populate automatically
- [ ] **Verify:** [Save seeding] button appears
- [ ] **Verify:** [Seeding ▼] button remains (or hides?)
- [ ] Click **[Save seeding]**
- [ ] **Verify:** Seeds persist

## Troubleshooting

### Issue: No buttons appear when clicking "Manual seeding"

**Check these:**
1. Open browser DevTools (F12)
2. Click **[Seeding ▼]** → **"Manual seeding"**
3. In Console, check for errors
4. In Elements tab, find `.options_right` element
5. Look for buttons with these classes:
   - `cancelManualSeeding`
   - `saveSeeding`
6. Check their `style.display` property:
   - Should be `""` (empty) or `"inline-block"` when visible
   - Should be `"none"` when hidden

**Expected DOM structure:**
```html
<div class="options_right">
  <!-- Initially visible, then hidden -->
  <div class="dropdown drawEntriesSeedingOptions">...</div>
  
  <!-- Initially hidden, then visible -->
  <button class="button cancelManualSeeding is-warning" style="display: none;">Cancel</button>
  <button class="button saveSeeding is-info" style="display: none;">Save seeding</button>
</div>
```

### Issue: Buttons appear but don't hide Seeding dropdown

**Check:**
1. Verify `drawEntriesSeedingSelector` returns `class: 'drawEntriesSeedingOptions'`
2. Verify `enableDrawEntriesManualSeeding` calls `toggleEditVisibility` with:
   - `className: 'drawEntriesSeedingOptions'` (to hide)
   - `classNames: ['saveSeeding', 'cancelManualSeeding']` (to show)

### Issue: Seed column doesn't become editable

**Check:**
1. Verify `enableDrawEntriesManualSeeding` calls:
   - `table.showColumn('seedNumber')`
   - `table.redraw(true)`
2. Verify `toggleEditVisibility` sets column editable:
   - `table.updateColumnDefinition('seedNumber', { editable: true, formatter: cellBorder })`

## Code Flow

```
User clicks [Seeding ▼] → "Manual seeding"
  ↓
drawEntriesSeedingSelector onClick handler fires
  ↓
enableDrawEntriesManualSeeding(e, table) called
  ↓
toggleEditVisibility() called with:
  - classNames: ['saveSeeding', 'cancelManualSeeding']
  - className: 'drawEntriesSeedingOptions'
  - visible: true
  ↓
toggleEditVisibility logic:
  1. Find .options_right container (parent of buttons)
  2. For each child button in .options_right:
     - If button.classList.includes('drawEntriesSeedingOptions')
       → button.style.display = 'none' (hide Seeding dropdown)
     - If button.classList.includes('saveSeeding' OR 'cancelManualSeeding')
       → button.style.display = '' (show Save/Cancel buttons)
  3. Make seedNumber column editable:
     - table.updateColumnDefinition('seedNumber', { editable: true, formatter: cellBorder })
  ↓
UI updates:
  - [Seeding ▼] hidden
  - [Cancel] [Save seeding] visible
  - Seed cells clickable with blue border
```

## Expected Behavior Summary

| State | Seeding ▼ | Cancel | Save seeding | Seed Column |
|-------|-----------|---------|--------------|-------------|
| **Initial** | ✅ Visible | ❌ Hidden | ❌ Hidden | View only |
| **Manual seeding active** | ❌ Hidden | ✅ Visible | ✅ Visible | ✏️ Editable |
| **After Save/Cancel** | ✅ Visible | ❌ Hidden | ❌ Hidden | View only |

---

**Status:** ✅ Implemented and ready to test  
**Build:** ✅ Successful  
**Files:** All seeding functionality in place

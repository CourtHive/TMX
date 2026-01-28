# Control Bar Component - Quick Start Guide

## View the Stories

```bash
# Start Storybook development server
cd TMX
pnpm run storybook
```

Navigate to **http://localhost:6006** and explore:

- **Components/ControlBar** - Main component stories
- **Components/ControlBar/Composite Pattern** - Full page examples
- **Components/ControlBar/Patterns** - Documentation

## Quick Examples

### Basic Search + Button

```typescript
import { controlBar } from 'components/controlBar/controlBar';

const items = [
  {
    placeholder: 'Search...',
    location: 'LEFT',
    search: true,
    clearSearch: () => table.clearFilter(),
    onKeyUp: (e) => table.setFilter('name', 'like', e.target.value),
  },
  {
    label: 'Add',
    location: 'RIGHT',
    intent: 'is-primary',
    onClick: () => handleAdd(),
  },
];

const target = document.getElementById('control-container');
controlBar({ table, target, items });
```

### Filter Dropdown

```typescript
{
  label: 'All Events',
  location: 'LEFT',
  modifyLabel: true,  // Label updates on selection
  selection: true,
  options: [
    {
      label: '<span style="font-weight: bold">All Events</span>',
      onClick: () => table.clearFilter(),
      close: true
    },
    { divider: true },
    { label: 'Event A', onClick: () => filterByEvent('A'), close: true },
    { label: 'Event B', onClick: () => filterByEvent('B'), close: true },
  ],
}
```

### Overlay Actions (on row selection)

```typescript
{
  label: 'Delete Selected',
  location: 'OVERLAY',  // Shows only when rows are selected
  intent: 'is-danger',
  onClick: () => {
    const selected = table.getSelectedData();
    deleteRows(selected);
  },
}
```

### Complete Pattern with Tabulator

```typescript
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { controlBar } from 'components/controlBar/controlBar';

// 1. Create header
const header = document.createElement('div');
header.className = 'tabHeader';
header.innerHTML = 'Items (0)';
container.appendChild(header);

// 2. Create control bar container
const controlContainer = document.createElement('div');
container.appendChild(controlContainer);

// 3. Create table
const table = new Tabulator(tableElement, {
  data: myData,
  columns: myColumns,
  selectableRows: true,
});

// 4. Set up control bar
const items = [
  { /* search */ },
  { /* filters */ },
  { /* actions */ },
];

controlBar({ table, target: controlContainer, items });

// 5. Update header on data changes
table.on('dataFiltered', (_, rows) => {
  header.innerHTML = `Items (${rows.length})`;
});
```

## Item Locations

```
┌─────────────────────────────────────┐
│  HEADER (clickable)                 │
├─────────────────────────────────────┤
│  OVERLAY (selection-based)          │
├─────────────────────────────────────┤
│ LEFT   CENTER           RIGHT       │
└─────────────────────────────────────┘
```

- **OVERLAY**: Bulk actions (shown on row selection)
- **LEFT**: Search, filters
- **CENTER**: Rarely used
- **RIGHT**: Primary actions, view selectors
- **HEADER**: Clickable header area

## Common Item Types

| Type | Key Properties |
|------|---------------|
| **Search** | `search: true`, `clearSearch`, `onKeyUp` |
| **Button** | `label`, `onClick`, `intent` |
| **Dropdown** | `label`, `options: [...]` |
| **Filter** | `modifyLabel: true`, `selection: true` |
| **Tabs** | `tabs: [...]` |
| **Text/HTML** | `text: '<div>...</div>'` |
| **Input** | `placeholder`, `validator` |

## Intent Classes (Button Colors)

- `'is-primary'` - Blue (main actions)
- `'is-danger'` - Red (destructive actions)
- `'is-info'` - Light blue (info/view)
- `'is-success'` - Green (success)
- `'is-warning'` - Yellow (warnings)
- `''` or `'is-none'` - Default

## Dynamic Updates

```typescript
const { elements, inputs } = controlBar({ table, target, items });

// Show/hide
elements.myButton.style.display = 'none';

// Change text
elements.myButton.innerText = 'New Label';

// Toggle style
elements.myButton.classList.toggle('is-primary');

// Get input value
const value = inputs.searchInput.value;
```

## Real Examples in Codebase

- **Participants**: `src/pages/tournament/tabs/participantTab/renderIndividuals.ts`
- **Events**: `src/pages/tournament/tabs/eventsTab/eventsView.ts`
- **MatchUps**: `src/pages/tournament/tabs/matchUpsTab/matchUpsTab.ts`
- **Venues**: `src/pages/tournament/tabs/venuesTab/venueControl.ts`

## Documentation

- **README.md** - Complete API reference
- **ControlBarPatterns.mdx** - Usage patterns and best practices
- **Storybook** - Interactive examples

## Need Help?

1. Check the Storybook stories for interactive examples
2. Review README.md for detailed API documentation
3. Look at existing usage in the codebase
4. Read ControlBarPatterns.mdx for patterns and best practices

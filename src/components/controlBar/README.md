# Control Bar Component

A versatile component for managing table controls, filters, and actions throughout the TMX application.

## Overview

The Control Bar component provides a consistent interface for:

- Search functionality with clear buttons
- Filter dropdowns with single and multi-select options
- Action buttons with various intents (primary, danger, info, etc.)
- Overlay actions that appear when table rows are selected
- Tab navigation
- Input fields with validation

## Basic Usage

```typescript
import { controlBar } from 'components/controlBar/controlBar';

const items = [
  {
    placeholder: 'Search...',
    location: 'LEFT',
    search: true,
    clearSearch: () => handleClear(),
    onKeyUp: (e) => handleSearch(e.target.value),
  },
  {
    label: 'Add Item',
    location: 'RIGHT',
    intent: 'is-primary',
    onClick: () => handleAdd(),
  },
];

const target = document.getElementById('control-container');
controlBar({ table, target, items });
```

## API

### controlBar(params)

**Parameters:**

- `table` (optional): Tabulator table instance for automatic integration
- `target`: HTMLElement where the control bar will be rendered
- `targetClassName` (optional): Alternative to `target`, finds element by class name
- `items`: Array of item configurations (see below)
- `onSelection`: Callback function when table rows are selected

**Returns:**

```typescript
{
  elements: Record<string, HTMLElement>,
  inputs: Record<string, HTMLInputElement>
}
```

## Item Configuration

### Common Properties

All items support:

- `location`: `'OVERLAY' | 'LEFT' | 'CENTER' | 'RIGHT' | 'HEADER'`
- `id`: Unique identifier (optional, for accessing elements later)
- `hide`: Boolean to hide the item
- `visible`: Boolean for initial visibility (can be toggled via returned elements)

### Item Types

#### 1. Search Input

```typescript
{
  placeholder: 'Search...',
  location: 'LEFT',
  search: true,                    // Adds magnifying glass icon
  clearSearch: () => void,         // Called when X is clicked or Escape pressed
  onKeyUp: (e: KeyboardEvent) => void,
  onKeyDown: (e: KeyboardEvent) => void,
  onChange: (e: Event) => void,
  focus: true,                     // Auto-focus on mount
  value: 'initial value',          // Initial value
  class: 'custom-class',           // Additional CSS class
}
```

#### 2. Button

```typescript
{
  label: 'Button Text',
  location: 'RIGHT',
  intent: 'is-primary',            // Bulma CSS intent class
  onClick: (e: Event, table: any) => void,
  disabled: false,
  stateChange: true,               // Triggers overlay refresh after click
}
```

**Intent Options:**

- `'is-primary'` - Blue
- `'is-info'` - Light blue
- `'is-success'` - Green
- `'is-warning'` - Yellow
- `'is-danger'` - Red
- `'is-none'` or `''` - Default

#### 3. Dropdown Button

```typescript
{
  label: 'Actions',
  location: 'RIGHT',
  options: [
    { label: 'Option 1', onClick: () => {}, close: true },
    { divider: true },
    { heading: 'Section Title' },
    { label: 'Option 2', onClick: () => {}, close: true },
  ],
}
```

**Option Types:**

- `{ label, onClick, close }` - Regular option
- `{ divider: true }` - Visual separator
- `{ heading: 'text' }` - Section heading

#### 4. Filter Dropdown (modifies label)

```typescript
{
  label: 'All Events',
  location: 'LEFT',
  modifyLabel: true,               // Label updates to selected option
  selection: true,
  options: [
    {
      label: '<span style="font-weight: bold">All Events</span>',
      onClick: () => {},
      close: true
    },
    { divider: true },
    { label: 'Event A', onClick: () => {}, close: true },
  ],
}
```

#### 5. Selection with Actions

For dropdowns with too many options, shows a modal instead:

```typescript
{
  label: 'Add to team',
  location: 'OVERLAY',
  selection: {
    options: teamOptions,          // List of teams
    actions: [                     // Actions to perform
      { label: 'Create new team', onClick: () => {} }
    ]
  },
  threshold: 8,                    // Show modal if options > threshold
  actionPlacement: 'TOP',          // 'TOP' or 'BOTTOM'
}
```

#### 6. Tabs

```typescript
{
  tabs: [
    { label: 'Tab 1', active: true, onClick: () => {} },
    { label: 'Tab 2', onClick: () => {} },
    { label: 'Tab 3', onClick: () => {} },
  ],
  location: 'LEFT',
}
```

#### 7. Text/HTML Content

```typescript
{
  text: '<div>Custom HTML</div>',
  location: 'CENTER',
  onClick: (e: Event) => {},       // Optional click handler
}
```

#### 8. Input with Validation

```typescript
{
  placeholder: 'Enter email',
  location: 'LEFT',
  validator: (value: string) => {
    return isValid(value) ? null : 'Error message';
  },
  onKeyUp: (e: KeyboardEvent) => {},
  onChange: (e: Event) => {},
}
```

#### 9. Header Click Handler

```typescript
{
  location: 'HEADER',
  headerClick: () => {
    // Called when header is clicked
  },
}
```

## Locations

Items are positioned in distinct areas:

```
┌─────────────────────────────────────────┐
│  HEADER (click-enabled)                 │
├─────────────────────────────────────────┤
│  OVERLAY (shown on selection)           │
├─────────────────────────────────────────┤
│ LEFT    CENTER           RIGHT          │
└─────────────────────────────────────────┘
```

### OVERLAY

- Shows only when table rows are selected
- Typically contains bulk actions (delete, sign in, etc.)
- Automatically hidden when selection is cleared

### LEFT

- Search inputs
- Filter dropdowns
- Used for narrowing down data

### CENTER

- Rarely used
- Available for special cases

### RIGHT

- Primary actions (Add, Create, etc.)
- View selectors
- Action menus

### HEADER

- Clickable header area above the control bar
- Typically shows count: "Participants (42)"

## Integration with Tabulator

The control bar automatically integrates with Tabulator tables:

```typescript
const table = new Tabulator(element, {
  /* config */
});

controlBar({
  table,
  target,
  items,
  onSelection: (rows) => {
    console.log(`${rows.length} rows selected`);
    // Overlay items automatically show/hide
  },
});
```

The control bar listens to Tabulator's `rowSelectionChanged` event and manages overlay visibility automatically.

## Dynamic Updates

Access elements and inputs to update the UI dynamically:

```typescript
const { elements, inputs } = controlBar({ table, target, items });

// Show/hide elements
elements.myButton.style.display = 'none';

// Update text
elements.myButton.innerText = 'New Text';

// Toggle classes
elements.myButton.classList.toggle('is-primary');

// Get input values
const searchValue = inputs.searchInput.value;

// Set input values
inputs.searchInput.value = 'new value';
```

## Common Patterns

### Search with Clear

```typescript
{
  placeholder: 'Search...',
  location: 'LEFT',
  search: true,
  clearSearch: () => {
    table.clearFilter();
  },
  onKeyUp: (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      table.clearFilter();
    } else {
      const value = e.target.value;
      if (value) {
        table.setFilter('name', 'like', value);
      } else {
        table.clearFilter();
      }
    }
  },
}
```

### Filter with "All" Option

```typescript
{
  label: 'All Events',
  location: 'LEFT',
  modifyLabel: true,
  selection: true,
  options: [
    {
      label: '<span style="font-weight: bold">All Events</span>',
      onClick: () => table.clearFilter(),
      close: true
    },
    { divider: true },
    ...eventOptions.map(event => ({
      label: event.name,
      onClick: () => table.setFilter('eventId', '=', event.id),
      close: true
    }))
  ],
}
```

### Overlay Actions

```typescript
{
  label: 'Delete Selected',
  location: 'OVERLAY',
  intent: 'is-danger',
  stateChange: true,
  onClick: () => {
    const selected = table.getSelectedData();
    if (confirm(`Delete ${selected.length} items?`)) {
      selected.forEach(row => table.deleteRow(row.id));
    }
  },
}
```

### Toggle Button

```typescript
{
  label: 'Publish',
  location: 'RIGHT',
  id: 'publishButton',
  onClick: () => {
    const button = document.getElementById('publishButton');
    const isPublished = button.classList.contains('is-primary');

    // Toggle state
    togglePublishState(!isPublished);

    // Update UI
    button.classList.toggle('is-primary');
    button.innerText = isPublished ? 'Publish' : 'Unpublish';
  },
}
```

## Examples in Codebase

Real-world usage examples:

- **Participants Page**: `src/pages/tournament/tabs/participantTab/renderIndividuals.ts`
  - Search, event filter, gender filter, team filter
  - Overlay: sign in, delete, add to event/team/group
  - Right: view selector, actions menu

- **Events Page**: `src/pages/tournament/tabs/eventsTab/eventsView.ts`
  - Search
  - Overlay: delete selected
  - Right: publish/unpublish OOP, add event

- **MatchUps Page**: `src/pages/tournament/tabs/matchUpsTab/matchUpsTab.ts`
  - Search, event filter, flight filter, team filter, status filter, type filter
  - Overlay: schedule selected
  - Right: statistics buttons

- **Venues Page**: `src/pages/tournament/tabs/venuesTab/venueControl.ts`
  - Overlay: delete selected
  - Right: add venue

## Best Practices

1. **Consistent Positioning**
   - Search: LEFT
   - Filters: LEFT (after search)
   - Primary action: RIGHT
   - Bulk actions: OVERLAY

2. **Filter Labels**
   - Always include "All" option with bold styling
   - Use `modifyLabel: true` for filters
   - Use `selection: true` to enable selection behavior

3. **Action Feedback**
   - Use appropriate intent classes
   - Show loading states when needed
   - Update labels after state changes

4. **Search Best Practices**
   - Always include clear button
   - Support Escape key to clear
   - Handle backspace on last character

5. **Accessibility**
   - Use semantic HTML
   - Provide meaningful labels
   - Ensure keyboard navigation
   - Use ARIA attributes where appropriate

## Storybook

View interactive examples and documentation in Storybook:

```bash
pnpm run storybook
```

Navigate to: **Components > ControlBar**

## Dependencies

- Bulma CSS for styling
- Tabulator (optional, for table integration)
- Font Awesome icons (for search icon)

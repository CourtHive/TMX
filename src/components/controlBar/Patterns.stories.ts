/**
 * Control Bar Patterns Documentation
 * 
 * This file provides comprehensive documentation for using the ControlBar component
 * throughout the TMX application.
 */
import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/ControlBar/Patterns & Best Practices',
  parameters: {
    docs: {
      description: {
        component: `
# Control Bar Patterns in TMX

The Control Bar is a versatile component used consistently across TMX for table management and filtering.

## Common Pattern: Header + ControlBar + Table

The most common pattern in TMX combines three elements:

1. **Header**: Displays count and context (e.g., "Participants (42)")
2. **Control Bar**: Provides search, filters, and actions  
3. **Tabulator Table**: Displays the actual data

### Example Structure

\`\`\`typescript
// 1. Create the table
const { table, replaceTableData } = createParticipantsTable({ view });

// 2. Set up control bar items
const items = [
  {
    placeholder: 'Search participants',
    location: 'LEFT',
    search: true,
    clearSearch: () => setSearchFilter(''),
    onKeyUp: (e) => setSearchFilter(e.target.value),
  },
  // ... more items
];

// 3. Initialize control bar
const target = document.getElementById('control-container');
controlBar({ table, target, items });

// 4. Update header on data changes
table.on('dataFiltered', (_filters, rows) => {
  headerElement.innerHTML = \`Participants (\${rows.length})\`;
});
\`\`\`

## Item Configuration

### Location Options

Items can be positioned in different locations:

- **OVERLAY**: Shown only when table rows are selected (for bulk actions)
- **LEFT**: Left side of control bar (typically search and filters)
- **CENTER**: Center of control bar (less commonly used)
- **RIGHT**: Right side of control bar (typically main actions)
- **HEADER**: In the header section above the control bar

### Item Types

#### 1. Search Input
\`\`\`typescript
{
  placeholder: 'Search...',
  location: 'LEFT',
  search: true,
  clearSearch: () => clearFilters(),
  onKeyUp: (e) => handleSearch(e.target.value),
  onKeyDown: (e) => handleKeyDown(e),
}
\`\`\`

#### 2. Button
\`\`\`typescript
{
  label: 'Add Item',
  location: 'RIGHT',
  intent: 'is-primary', // Bulma CSS class
  onClick: () => handleClick(),
}
\`\`\`

#### 3. Dropdown Button
\`\`\`typescript
{
  label: 'Actions',
  location: 'RIGHT',
  options: [
    { label: 'Option 1', onClick: () => {}, close: true },
    { divider: true },
    { heading: 'Section' },
    { label: 'Option 2', onClick: () => {}, close: true },
  ],
}
\`\`\`

#### 4. Filter Dropdown
\`\`\`typescript
{
  label: 'All Events',
  location: 'LEFT',
  modifyLabel: true,  // Label changes to selected option
  selection: true,
  options: [
    { label: '<span style="font-weight: bold">All Events</span>', onClick: () => {}, close: true },
    { divider: true },
    { label: 'Event A', onClick: () => {}, close: true },
  ],
}
\`\`\`

## Common Patterns by Page

### Participants Page
**Pattern**: Search + Event Filter + Gender Filter + View Selector + Actions

- **Overlay**: Bulk actions (sign in, delete, add to event)
- **Left**: Search, event filter, team filter, gender filter
- **Right**: View selector (Individuals/Teams/Groups), Actions menu

### Events Page
**Pattern**: Search + Publish Button + Add Event

- **Overlay**: Delete selected
- **Left**: Search
- **Right**: Publish/Unpublish OOP, Add event

### MatchUps Page
**Pattern**: Search + Multiple Filters + Statistics

- **Overlay**: Schedule selected
- **Left**: Search, event filter, flight filter, team filter, status filter, type filter
- **Right**: Statistics buttons (optional)

### Venues Page
**Pattern**: Delete + Add

- **Overlay**: Delete selected
- **Right**: Add venue

## Best Practices

### 1. Consistent Positioning
- **Search**: Always on the left
- **Primary Action**: Always on the right
- **Filters**: Left side, between search and actions
- **Bulk Actions**: Overlay location

### 2. Filter Patterns
Always include an "All" option with bold styling:

\`\`\`typescript
{
  label: '<span style="font-weight: bold">All Events</span>',
  onClick: () => table.clearFilter(),
  close: true
}
\`\`\`

### 3. Dropdown Options
Organize dropdown menus with:
- Headings for sections
- Dividers between groups
- Bold formatting for actions vs selections

### 4. Action Feedback
Provide clear feedback for all actions:
- Use appropriate intent classes
- Show loading states when needed
- Update labels after state changes (e.g., "Publish" → "Unpublish")

### 5. Search Functionality
Always include:
- Clear button (X icon)
- Escape key to clear
- Backspace on last character to clear

### 6. Accessibility
- Use semantic HTML
- Provide meaningful labels
- Ensure keyboard navigation works
- Use ARIA attributes where appropriate

## Examples in Codebase

- **Participants**: \`src/pages/tournament/tabs/participantTab/renderIndividuals.ts\`
- **Events**: \`src/pages/tournament/tabs/eventsTab/eventsView.ts\`
- **MatchUps**: \`src/pages/tournament/tabs/matchUpsTab/matchUpsTab.ts\`
- **Venues**: \`src/pages/tournament/tabs/venuesTab/venueControl.ts\`
- **Schedule**: \`src/pages/tournament/tabs/scheduleTab/scheduleGridControl.ts\`
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// This story just displays the documentation
export const Documentation: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    container.innerHTML = `
      <div class="content">
        <p><strong>See the full documentation in the "Docs" tab above.</strong></p>
        <p>This page contains comprehensive patterns and best practices for using the Control Bar component.</p>
        <ul>
          <li>Common patterns across different pages</li>
          <li>Item type specifications</li>
          <li>Location options</li>
          <li>Best practices guide</li>
          <li>Real-world examples from the codebase</li>
        </ul>
      </div>
    `;
    return container;
  },
};

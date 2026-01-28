/**
 * Control Bar Component Stories
 * 
 * The Control Bar is a versatile component used throughout TMX for table controls.
 * It provides search fields, buttons, dropdown menus, and action overlays.
 * 
 * ## Common Usage Pattern
 * The Control Bar is typically used with:
 * - A header showing count (e.g., "Participants (42)")
 * - The control bar with filters and actions
 * - A Tabulator table
 * 
 * ## Locations
 * Items can be positioned in different locations:
 * - OVERLAY: Shown only when rows are selected
 * - LEFT: Left side of the control bar
 * - CENTER: Center of the control bar
 * - RIGHT: Right side of the control bar
 * - HEADER: In the header section above the control bar
 */
import type { Meta, StoryObj } from '@storybook/html';
import { controlBar } from './controlBar';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

interface ControlBarArgs {
  withTable?: boolean;
  withSearch?: boolean;
  withFilters?: boolean;
  withActions?: boolean;
  withOverlay?: boolean;
}

const meta: Meta<ControlBarArgs> = {
  title: 'Components/ControlBar',
  tags: ['autodocs'],
  argTypes: {
    withTable: {
      control: 'boolean',
      description: 'Include a sample table',
      defaultValue: false,
    },
    withSearch: {
      control: 'boolean',
      description: 'Include search input',
      defaultValue: true,
    },
    withFilters: {
      control: 'boolean',
      description: 'Include filter dropdowns',
      defaultValue: true,
    },
    withActions: {
      control: 'boolean',
      description: 'Include action buttons',
      defaultValue: true,
    },
    withOverlay: {
      control: 'boolean',
      description: 'Include overlay actions (shown on selection)',
      defaultValue: true,
    },
  },
};

export default meta;
type Story = StoryObj<ControlBarArgs>;

// Helper to create sample table data
function createSampleData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    email: `person${i + 1}@example.com`,
    status: i % 2 === 0 ? 'Active' : 'Inactive',
  }));
}

// Helper to create a sample Tabulator table
function createSampleTable(element: HTMLElement) {
  const data = createSampleData(10);
  return new Tabulator(element, {
    data,
    height: '300px',
    layout: 'fitColumns',
    columns: [
      { title: 'Name', field: 'name', width: 200 },
      { title: 'Email', field: 'email', width: 250 },
      { title: 'Status', field: 'status', width: 100 },
    ],
    selectableRows: true,
  });
}

// Basic control bar with minimal configuration
export const Basic: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    
    const target = document.createElement('div');
    target.id = 'control-bar-basic';
    container.appendChild(target);

    const items = [
      {
        placeholder: 'Search...',
        location: 'left',
        search: true,
        clearSearch: () => console.log('Clear search'),
        onKeyUp: (e: KeyboardEvent) => console.log('Search:', (e.target as HTMLInputElement).value),
      },
      {
        label: 'Add Item',
        location: 'right',
        intent: 'is-primary',
        onClick: () => alert('Add item clicked'),
      },
    ];

    // Initialize control bar after DOM is attached
    requestAnimationFrame(() => {
      controlBar({ target, items });
    });

    return container;
  },
};

// Participants Page Configuration
export const ParticipantsPage: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    container.innerHTML = `
      <div class="tabHeader" style="padding: 1rem; font-size: 1.2rem; font-weight: bold;">
        Participants (10)
      </div>
    `;
    
    const target = document.createElement('div');
    target.id = 'control-bar-participants';
    container.appendChild(target);

    const tableContainer = document.createElement('div');
    tableContainer.id = 'sample-table';
    container.appendChild(tableContainer);

    requestAnimationFrame(() => {
      const table = createSampleTable(tableContainer);

      const items = [
        // Overlay items (shown when rows are selected)
        {
          placeholder: 'Search participants',
          location: 'overlay',
          search: true,
          clearSearch: () => console.log('Clear search'),
          onKeyUp: (e: KeyboardEvent) => console.log('Search:', (e.target as HTMLInputElement).value),
        },
        {
          label: 'Add to event',
          location: 'overlay',
          intent: 'is-none',
          options: [
            { label: 'Event A', onClick: () => alert('Added to Event A'), close: true },
            { label: 'Event B', onClick: () => alert('Added to Event B'), close: true },
            { divider: true },
            { label: '<p style="font-weight: bold">Create new event</p>', onClick: () => alert('Create event'), close: true },
          ],
        },
        {
          label: 'Sign in',
          location: 'overlay',
          intent: 'is-primary',
          onClick: () => alert('Sign in selected'),
        },
        {
          label: 'Delete selected',
          location: 'overlay',
          intent: 'is-danger',
          onClick: () => alert('Delete selected'),
        },
        // Left side filters
        {
          placeholder: 'Search participants',
          location: 'left',
          search: true,
          clearSearch: () => table?.clearFilter(),
          onKeyUp: (e: KeyboardEvent) => {
            const value = (e.target as HTMLInputElement).value;
            if (value) {
              table?.setFilter('name', 'like', value);
            } else {
              table?.clearFilter();
            }
          },
        },
        {
          label: 'All Events',
          location: 'left',
          modifyLabel: true,
          selection: true,
          options: [
            { label: '<span style="font-weight: bold">All Events</span>', onClick: () => table?.clearFilter(), close: true },
            { divider: true },
            { label: 'Event A', onClick: () => console.log('Filter Event A'), close: true },
            { label: 'Event B', onClick: () => console.log('Filter Event B'), close: true },
          ],
        },
        {
          label: 'All Genders',
          location: 'left',
          modifyLabel: true,
          selection: true,
          options: [
            { label: '<span style="font-weight: bold">All Genders</span>', onClick: () => table?.clearFilter(), close: true },
            { divider: true },
            { label: 'Male', onClick: () => console.log('Filter Male'), close: true },
            { label: 'Female', onClick: () => console.log('Filter Female'), close: true },
          ],
        },
        // Right side actions
        {
          label: 'Individuals',
          location: 'right',
          intent: 'is-info',
          modifyLabel: true,
          selection: true,
          options: [
            { label: 'Individuals', onClick: () => console.log('View Individuals'), close: true },
            { label: 'Teams', onClick: () => console.log('View Teams'), close: true },
            { label: 'Groups', onClick: () => console.log('View Groups'), close: true },
          ],
        },
        {
          label: 'Actions',
          location: 'right',
          options: [
            { heading: 'Bulk Actions' },
            { label: 'Edit ratings', onClick: () => alert('Edit ratings'), close: true },
            { divider: true },
            { heading: 'Add participants' },
            { label: 'Generate mock participants', onClick: () => alert('Generate mock'), close: true },
            { label: 'Import from Google sheet', onClick: () => alert('Import sheet'), close: true },
            { label: 'New participant', onClick: () => alert('New participant'), close: true },
          ],
        },
      ];

      controlBar({ table, target, items, onSelection: (rows) => {
        console.log('Selected rows:', rows.length);
      }});
    });

    return container;
  },
};

// Events Page Configuration
export const EventsPage: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    
    const target = document.createElement('div');
    target.id = 'control-bar-events';
    container.appendChild(target);

    const tableContainer = document.createElement('div');
    tableContainer.id = 'sample-table-events';
    container.appendChild(tableContainer);

    requestAnimationFrame(() => {
      const table = createSampleTable(tableContainer);

      const items = [
        // Overlay (selection) actions
        {
          label: 'Delete selected',
          location: 'overlay',
          intent: 'is-danger',
          stateChange: true,
          onClick: () => alert('Delete selected events'),
        },
        // Left side search
        {
          placeholder: 'Search events',
          location: 'left',
          search: true,
          clearSearch: () => table?.clearFilter(),
          onKeyUp: (e: KeyboardEvent) => {
            const value = (e.target as HTMLInputElement).value;
            if (value) {
              table?.setFilter('name', 'like', value);
            } else {
              table?.clearFilter();
            }
          },
        },
        // Right side actions
        {
          label: 'Publish OOP',
          location: 'right',
          id: 'oopButton',
          onClick: () => {
            const button = document.getElementById('oopButton');
            const isPublished = button?.classList.contains('is-primary');
            button?.classList.toggle('is-primary');
            button!.innerText = isPublished ? 'Publish OOP' : 'Unpublish OOP';
            alert(isPublished ? 'Unpublished' : 'Published');
          },
        },
        {
          label: 'Add event',
          location: 'right',
          intent: 'is-primary',
          onClick: () => alert('Add event'),
        },
      ];

      controlBar({ table, target, items });
    });

    return container;
  },
};

// MatchUps Page Configuration
export const MatchUpsPage: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    
    const target = document.createElement('div');
    target.id = 'control-bar-matchups';
    container.appendChild(target);

    const tableContainer = document.createElement('div');
    tableContainer.id = 'sample-table-matchups';
    container.appendChild(tableContainer);

    requestAnimationFrame(() => {
      const table = createSampleTable(tableContainer);

      const items = [
        // Overlay
        {
          label: 'Schedule',
          location: 'overlay',
          stateChange: true,
          onClick: () => alert('Schedule selected'),
        },
        // Left side search and filters
        {
          placeholder: 'Search matches',
          location: 'left',
          search: true,
          clearSearch: () => table?.clearFilter(),
          onKeyUp: (e: KeyboardEvent) => {
            const value = (e.target as HTMLInputElement).value;
            if (value) {
              table?.setFilter('name', 'like', value);
            } else {
              table?.clearFilter();
            }
          },
        },
        {
          label: 'All Events',
          location: 'left',
          modifyLabel: true,
          selection: true,
          options: [
            { label: '<span style="font-weight: bold">All Events</span>', onClick: () => table?.clearFilter(), close: true },
            { divider: true },
            { label: 'Event A', onClick: () => console.log('Filter Event A'), close: true },
            { label: 'Event B', onClick: () => console.log('Filter Event B'), close: true },
          ],
        },
        {
          label: 'All Statuses',
          location: 'left',
          modifyLabel: true,
          selection: true,
          options: [
            { label: '<span style="font-weight: bold">All Statuses</span>', onClick: () => table?.clearFilter(), close: true },
            { divider: true },
            { label: 'Ready to score', onClick: () => console.log('Filter ready'), close: true },
            { label: 'Complete', onClick: () => console.log('Filter complete'), close: true },
          ],
        },
        {
          label: 'All Types',
          location: 'left',
          modifyLabel: true,
          selection: true,
          options: [
            { label: '<span style="font-weight: bold">All Types</span>', onClick: () => table?.clearFilter(), close: true },
            { divider: true },
            { label: 'Singles', onClick: () => console.log('Filter singles'), close: true },
            { label: 'Doubles', onClick: () => console.log('Filter doubles'), close: true },
            { label: 'Team', onClick: () => console.log('Filter team'), close: true },
          ],
        },
      ];

      controlBar({ table, target, items });
    });

    return container;
  },
};

// Venues Page Configuration
export const VenuesPage: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    
    const target = document.createElement('div');
    target.id = 'control-bar-venues';
    container.appendChild(target);

    const tableContainer = document.createElement('div');
    tableContainer.id = 'sample-table-venues';
    container.appendChild(tableContainer);

    requestAnimationFrame(() => {
      const table = createSampleTable(tableContainer);

      const items = [
        {
          label: 'Delete selected',
          location: 'overlay',
          intent: 'is-danger',
          stateChange: true,
          onClick: () => alert('Delete selected venues'),
        },
        {
          label: 'Add venue',
          location: 'right',
          onClick: () => alert('Add venue'),
        },
      ];

      controlBar({ table, target, items });
    });

    return container;
  },
};

// Custom Configuration with Tabs
export const WithTabs: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    
    const target = document.createElement('div');
    target.id = 'control-bar-tabs';
    container.appendChild(target);

    requestAnimationFrame(() => {
      const items = [
        {
          tabs: [
            {
              label: 'View 1',
              active: true,
              onClick: () => alert('View 1 selected'),
            },
            {
              label: 'View 2',
              onClick: () => alert('View 2 selected'),
            },
            {
              label: 'View 3',
              onClick: () => alert('View 3 selected'),
            },
          ],
          location: 'left',
        },
        {
          label: 'Action',
          location: 'right',
          intent: 'is-primary',
          onClick: () => alert('Action clicked'),
        },
      ];

      controlBar({ target, items });
    });

    return container;
  },
};

// Configuration with Input Validation
export const WithValidation: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    
    const target = document.createElement('div');
    target.id = 'control-bar-validation';
    container.appendChild(target);

    requestAnimationFrame(() => {
      const items = [
        {
          placeholder: 'Enter email',
          location: 'left',
          validator: (value: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(value) ? null : 'Invalid email format';
          },
          onKeyUp: (e: KeyboardEvent) => {
            console.log('Email input:', (e.target as HTMLInputElement).value);
          },
        },
        {
          placeholder: 'Enter number',
          location: 'left',
          validator: (value: string) => {
            return isNaN(Number(value)) ? 'Must be a number' : null;
          },
        },
        {
          label: 'Submit',
          location: 'right',
          intent: 'is-primary',
          onClick: () => alert('Submit clicked'),
        },
      ];

      controlBar({ target, items });
    });

    return container;
  },
};

// All Locations Demo
export const AllLocations: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'panelHeader';
    headerDiv.style.padding = '1rem';
    headerDiv.style.fontWeight = 'bold';
    headerDiv.innerHTML = 'Header Location (click me)';
    container.appendChild(headerDiv);
    
    const target = document.createElement('div');
    target.id = 'control-bar-locations';
    container.appendChild(target);

    requestAnimationFrame(() => {
      const items = [
        {
          location: 'header',
          headerClick: () => alert('Header clicked!'),
        },
        {
          text: 'Overlay Item (select table rows)',
          location: 'overlay',
          onClick: () => alert('Overlay item clicked'),
        },
        {
          label: 'Left Button',
          location: 'left',
          onClick: () => alert('Left button'),
        },
        {
          label: 'Center Button',
          location: 'center',
          onClick: () => alert('Center button'),
        },
        {
          label: 'Right Button',
          location: 'right',
          intent: 'is-primary',
          onClick: () => alert('Right button'),
        },
      ];

      controlBar({ target, items });
    });

    return container;
  },
};

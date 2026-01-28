/**
 * Composite Table Pattern Stories
 * 
 * Demonstrates the common pattern of Header + ControlBar + Table
 * used throughout TMX for data management pages.
 */
import type { Meta, StoryObj } from '@storybook/html';
import { controlBar } from './controlBar';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

const meta: Meta = {
  title: 'Components/ControlBar/Composite Pattern',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

// Sample data generators
function generateParticipants(count: number) {
  const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
  const genders = ['M', 'F'];
  const statuses = ['Active', 'Inactive', 'Pending'];
  const teams = ['Team A', 'Team B', 'Team C', 'Team D'];

  return Array.from({ length: count }, (_, i) => ({
    participantId: `p${i + 1}`,
    name: `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`,
    email: `participant${i + 1}@example.com`,
    sex: genders[i % 2],
    status: statuses[i % 3],
    team: teams[i % 4],
    rating: (Math.random() * 10 + 5).toFixed(1),
    signedIn: i % 3 === 0,
  }));
}

/**
 * Full Participants Page Example
 * 
 * This story demonstrates the complete pattern used on the Participants page:
 * - Header with count
 * - Control bar with search, filters, and actions
 * - Tabulator table with selectable rows
 * - Overlay actions shown on selection
 */
export const FullParticipantsExample: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';
    container.style.maxWidth = '1400px';
    container.style.margin = '0 auto';

    // Create header
    const header = document.createElement('div');
    header.className = 'tabHeader';
    header.style.cssText = 'padding: 1rem; font-size: 1.2rem; font-weight: bold; background: #f5f5f5;';
    header.innerHTML = 'Participants (0)';
    container.appendChild(header);

    // Create control bar container
    const controlContainer = document.createElement('div');
    controlContainer.id = 'participant-control';
    container.appendChild(controlContainer);

    // Create table container
    const tableContainer = document.createElement('div');
    tableContainer.id = 'participants-table';
    tableContainer.style.marginTop = '1rem';
    container.appendChild(tableContainer);

    // Information panel
    const infoPanel = document.createElement('div');
    infoPanel.className = 'notification is-info is-light';
    infoPanel.style.marginTop = '1rem';
    infoPanel.innerHTML = `
      <p><strong>Try these interactions:</strong></p>
      <ul>
        <li>Search for participants by name</li>
        <li>Filter by gender or team</li>
        <li>Select rows to see overlay actions</li>
        <li>Click actions to see simulated behavior</li>
      </ul>
    `;
    container.appendChild(infoPanel);

    requestAnimationFrame(() => {
      const data = generateParticipants(25);

      // Create table
      const table = new Tabulator(tableContainer, {
        data,
        height: '500px',
        layout: 'fitColumns',
        selectableRows: true,
        index: 'participantId',
        columns: [
          {
            title: 'Name',
            field: 'name',
            width: 200,
            sorter: 'string',
          },
          {
            title: 'Email',
            field: 'email',
            width: 250,
          },
          {
            title: 'Gender',
            field: 'sex',
            width: 100,
            sorter: 'string',
          },
          {
            title: 'Team',
            field: 'team',
            width: 150,
            sorter: 'string',
          },
          {
            title: 'Rating',
            field: 'rating',
            width: 100,
            sorter: 'number',
            hozAlign: 'right',
          },
          {
            title: 'Status',
            field: 'status',
            width: 120,
            formatter: (cell: any) => {
              const value = cell.getValue();
              const colors: any = {
                'Active': 'is-success',
                'Inactive': 'is-danger',
                'Pending': 'is-warning'
              };
              return `<span class="tag ${colors[value]}">${value}</span>`;
            },
          },
          {
            title: 'Signed In',
            field: 'signedIn',
            width: 100,
            hozAlign: 'center',
            formatter: (cell: any) => {
              return cell.getValue() 
                ? '<i class="fa-solid fa-check" style="color: green;"></i>'
                : '<i class="fa-solid fa-xmark" style="color: red;"></i>';
            },
          },
        ],
      });

      // Update header on data changes
      const updateHeader = (rows: any[]) => {
        header.innerHTML = `Participants (${rows.length})`;
      };

      table.on('dataFiltered', (_filters: any, rows: any[]) => {
        updateHeader(rows);
      });

      table.on('tableBuilt', () => {
        updateHeader(table.getData());
      });

      // Track active filters
      let currentSearch = '';
      let currentGender = '';
      let currentTeam = '';

      // Combined filter function
      const applyFilters = () => {
        table.clearFilter();
        
        const filters: any[] = [];
        
        // Search filter
        if (currentSearch) {
          filters.push({
            field: 'name',
            type: 'like',
            value: currentSearch,
          });
        }
        
        // Gender filter
        if (currentGender) {
          filters.push({
            field: 'sex',
            type: '=',
            value: currentGender,
          });
        }
        
        // Team filter
        if (currentTeam) {
          filters.push({
            field: 'team',
            type: '=',
            value: currentTeam,
          });
        }
        
        if (filters.length > 0) {
          table.setFilter(filters);
        }
      };

      const setSearchFilter = (value: string) => {
        currentSearch = value;
        applyFilters();
      };

      const setGenderFilter = (value: string) => {
        currentGender = value;
        applyFilters();
      };

      const setTeamFilter = (value: string) => {
        currentTeam = value;
        applyFilters();
      };

      // Control bar items
      const items = [
        // Overlay items (shown when rows are selected)
        {
          placeholder: 'Search participants',
          location: 'overlay',
          search: true,
          clearSearch: () => setSearchFilter(''),
          onKeyUp: (e: KeyboardEvent) => setSearchFilter((e.target as HTMLInputElement).value),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              (e.target as HTMLInputElement).value = '';
              setSearchFilter('');
            }
          },
        },
        {
          label: 'Sign In Selected',
          location: 'overlay',
          intent: 'is-primary',
          onClick: () => {
            const selected = table.getSelectedData();
            alert(`Signing in ${selected.length} participants`);
            // Simulate sign in
            selected.forEach((row: any) => {
              table.updateData([{ participantId: row.participantId, signedIn: true }]);
            });
            table.deselectRow();
          },
        },
        {
          label: 'Add to Event',
          location: 'overlay',
          intent: 'is-info',
          options: [
            {
              label: 'Event A - Singles',
              close: true,
              onClick: () => {
                const selected = table.getSelectedData();
                alert(`Adding ${selected.length} participants to Event A`);
                table.deselectRow();
              },
            },
            {
              label: 'Event B - Doubles',
              close: true,
              onClick: () => {
                const selected = table.getSelectedData();
                alert(`Adding ${selected.length} participants to Event B`);
                table.deselectRow();
              },
            },
            { divider: true },
            {
              label: '<p style="font-weight: bold">Create New Event</p>',
              close: true,
              onClick: () => {
                alert('Opening event creation dialog...');
                table.deselectRow();
              },
            },
          ],
        },
        {
          label: 'Delete Selected',
          location: 'overlay',
          intent: 'is-danger',
          onClick: () => {
            const selected = table.getSelectedData();
            if (confirm(`Delete ${selected.length} participants?`)) {
              selected.forEach((row: any) => {
                table.deleteRow(row.participantId);
              });
            }
          },
        },
        // Left side filters and search
        {
          placeholder: 'Search participants',
          location: 'left',
          search: true,
          clearSearch: () => setSearchFilter(''),
          onKeyUp: (e: KeyboardEvent) => setSearchFilter((e.target as HTMLInputElement).value),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              (e.target as HTMLInputElement).value = '';
              setSearchFilter('');
            }
          },
        },
        {
          label: 'All Genders',
          location: 'left',
          modifyLabel: true,
          selection: true,
          options: [
            {
              label: '<span style="font-weight: bold">All Genders</span>',
              close: true,
              onClick: (e: Event) => {
                setGenderFilter('');
                const button = (e.target as HTMLElement).closest('button');
                if (button) button.innerHTML = '<span>All Genders</span>';
              },
            },
            { divider: true },
            {
              label: 'Male',
              close: true,
              onClick: (e: Event) => {
                setGenderFilter('M');
                const button = (e.target as HTMLElement).closest('button');
                if (button) button.innerHTML = '<span>Male</span>';
              },
            },
            {
              label: 'Female',
              close: true,
              onClick: (e: Event) => {
                setGenderFilter('F');
                const button = (e.target as HTMLElement).closest('button');
                if (button) button.innerHTML = '<span>Female</span>';
              },
            },
          ],
        },
        {
          label: 'All Teams',
          location: 'left',
          modifyLabel: true,
          selection: true,
          options: [
            {
              label: '<span style="font-weight: bold">All Teams</span>',
              close: true,
              onClick: (e: Event) => {
                setTeamFilter('');
                const button = (e.target as HTMLElement).closest('button');
                if (button) button.innerHTML = '<span>All Teams</span>';
              },
            },
            { divider: true },
            {
              label: 'Team A',
              close: true,
              onClick: (e: Event) => {
                setTeamFilter('Team A');
                const button = (e.target as HTMLElement).closest('button');
                if (button) button.innerHTML = '<span>Team A</span>';
              },
            },
            {
              label: 'Team B',
              close: true,
              onClick: (e: Event) => {
                setTeamFilter('Team B');
                const button = (e.target as HTMLElement).closest('button');
                if (button) button.innerHTML = '<span>Team B</span>';
              },
            },
            {
              label: 'Team C',
              close: true,
              onClick: (e: Event) => {
                setTeamFilter('Team C');
                const button = (e.target as HTMLElement).closest('button');
                if (button) button.innerHTML = '<span>Team C</span>';
              },
            },
            {
              label: 'Team D',
              close: true,
              onClick: (e: Event) => {
                setTeamFilter('Team D');
                const button = (e.target as HTMLElement).closest('button');
                if (button) button.innerHTML = '<span>Team D</span>';
              },
            },
          ],
        },
        // Right side actions
        {
          label: 'View',
          location: 'right',
          intent: 'is-info',
          modifyLabel: true,
          selection: true,
          options: [
            {
              label: 'Individuals',
              close: true,
              onClick: () => alert('Switch to Individuals view'),
            },
            {
              label: 'Teams',
              close: true,
              onClick: () => alert('Switch to Teams view'),
            },
            {
              label: 'Groups',
              close: true,
              onClick: () => alert('Switch to Groups view'),
            },
          ],
        },
        {
          label: 'Actions',
          location: 'right',
          options: [
            { heading: 'Bulk Actions' },
            {
              label: 'Edit Ratings',
              close: true,
              onClick: () => alert('Enable rating editing mode'),
            },
            {
              label: 'Export Data',
              close: true,
              onClick: () => alert('Exporting participant data...'),
            },
            { divider: true },
            { heading: 'Add Participants' },
            {
              label: 'Generate Mock Data',
              close: true,
              onClick: () => {
                const newData = generateParticipants(10);
                table.addData(newData);
                alert('Added 10 mock participants');
              },
            },
            {
              label: 'Import from Sheet',
              close: true,
              onClick: () => alert('Opening Google Sheets import...'),
            },
            {
              label: 'New Participant',
              close: true,
              onClick: () => alert('Opening new participant form...'),
            },
          ],
        },
      ];

      controlBar({
        table,
        target: controlContainer,
        items,
        onSelection: (rows: any[]) => {
          console.log(`${rows.length} rows selected`);
        },
      });
    });

    return container;
  },
};

/**
 * Minimal Example
 * 
 * Shows the absolute minimum needed for the composite pattern
 */
export const MinimalExample: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'section';

    // Header
    const header = document.createElement('div');
    header.className = 'tabHeader';
    header.style.cssText = 'padding: 1rem; font-size: 1.2rem; font-weight: bold;';
    header.innerHTML = 'Items (0)';
    container.appendChild(header);

    // Control bar
    const controlContainer = document.createElement('div');
    controlContainer.id = 'minimal-control';
    container.appendChild(controlContainer);

    // Table
    const tableContainer = document.createElement('div');
    tableContainer.id = 'minimal-table';
    container.appendChild(tableContainer);

    requestAnimationFrame(() => {
      const data = [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 },
        { id: 3, name: 'Item 3', value: 300 },
      ];

      const table = new Tabulator(tableContainer, {
        data,
        height: '200px',
        layout: 'fitColumns',
        columns: [
          { title: 'Name', field: 'name' },
          { title: 'Value', field: 'value' },
        ],
      });

      const items = [
        {
          placeholder: 'Search...',
          location: 'left',
          search: true,
          clearSearch: () => table.clearFilter(),
          onKeyUp: (e: KeyboardEvent) => {
            const value = (e.target as HTMLInputElement).value;
            if (value) {
              table.setFilter('name', 'like', value);
            } else {
              table.clearFilter();
            }
          },
        },
        {
          label: 'Add Item',
          location: 'right',
          onClick: () => alert('Add new item'),
        },
      ];

      controlBar({ table, target: controlContainer, items });

      table.on('dataFiltered', (_: any, rows: any[]) => {
        header.innerHTML = `Items (${rows.length})`;
      });

      table.on('tableBuilt', () => {
        header.innerHTML = `Items (${table.getData().length})`;
      });
    });

    return container;
  },
};

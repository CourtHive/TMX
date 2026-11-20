import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('i18n', () => ({ t: (key: string, options?: any) => `${key}:${options?.count}` }));
vi.mock('./tabHeaderTitle.css', () => ({}));

import { createTabHeaderTitle, trackSelectedRows } from './tabHeaderTitle';

// The unit project runs in node: a minimal element is enough for a helper that only creates, appends and labels.
function fakeElement(): any {
  const classes = new Set<string>();
  const element: any = {
    children: [] as any[],
    parentNode: null,
    dataset: {},
    textContent: '',
    className: '',
    classList: {
      toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      contains: (name: string) => classes.has(name),
    },
    appendChild(child: any) {
      if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child), 1);
      element.children.push(child);
      child.parentNode = element;
      return child;
    },
  };
  return element;
}

beforeEach(() => vi.stubGlobal('document', { createElement: () => fakeElement() }));
afterEach(() => vi.unstubAllGlobals());

describe('createTabHeaderTitle', () => {
  it('renders the label with its count, and a muted selected count at zero', () => {
    const title = createTabHeaderTitle({ label: 'Participants', count: 12, selected: 0 });
    const [heading, selected]: any[] = [...(title.element.children as any)];
    expect(heading.textContent).toBe('Participants (12)');
    expect(selected.textContent).toBe('ui.selectedCount:0');
    expect(selected.dataset.selected).toBe('0');
    expect(selected.classList.contains('is-active')).toBe(false);
  });

  it('marks the selected count active once rows are selected, and updates in place', () => {
    const title = createTabHeaderTitle({ label: 'Participants', count: 12, selected: 0 });
    title.setSelected(3);
    title.setSelected(5);
    expect(title.element.children).toHaveLength(2);
    expect(title.element.children[1].textContent).toBe('ui.selectedCount:5');
    expect(title.element.children[1].classList.contains('is-active')).toBe(true);
    title.setCount(7);
    expect(title.element.children[0].textContent).toBe('Participants (7)');
  });

  it('renders no selected count for a view without row selection', () => {
    const title = createTabHeaderTitle({ label: 'Events', count: 4 });
    expect(title.element.children).toHaveLength(1);
  });
});

describe('trackSelectedRows', () => {
  it('starts from the current selection and follows rowSelectionChanged', () => {
    const handlers: Record<string, (data: any[]) => void> = {};
    const table = {
      getSelectedData: () => [{}, {}],
      on: (event: string, handler: (data: any[]) => void) => (handlers[event] = handler),
    };
    const title = createTabHeaderTitle({ label: 'MatchUps', count: 30, selected: 0 });
    trackSelectedRows(table, title);
    expect(title.element.children[1].textContent).toBe('ui.selectedCount:2');
    handlers.rowSelectionChanged([{}, {}, {}, {}]);
    expect(title.element.children[1].textContent).toBe('ui.selectedCount:4');
    handlers.rowSelectionChanged([]);
    expect(title.element.children[1].classList.contains('is-active')).toBe(false);
  });
});

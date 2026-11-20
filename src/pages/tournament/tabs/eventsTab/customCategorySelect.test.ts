import { CUSTOM_CATEGORY, categoryOption, watchCustomCategory } from './customCategorySelect';
import { describe, expect, it } from 'vitest';

// The unit suite runs in node: a select is modelled by its value, its options and its change listener.
function fakeSelect(values: string[], value: string) {
  const listeners: Array<() => void> = [];
  const options: any = values.map((v) => ({ value: v, label: v }));
  options.add = (option: any, index: number) => options.splice(index, 0, option);
  const select: any = {
    value,
    options,
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
  };
  const choose = (next: string) => {
    select.value = next;
    listeners.forEach((listener) => listener());
  };
  return { select, choose };
}

function fakeEditor() {
  const calls: Array<{ onChosen: (category: any) => void; onClose: () => void }> = [];
  // OK runs the callback and then closes, as the modal does; Cancel only closes
  const ok = (category: any) => {
    const { onChosen, onClose } = calls.at(-1)!;
    onChosen(category);
    onClose();
  };
  const cancel = () => calls.at(-1)!.onClose();
  return { open: (handlers: any) => calls.push(handlers), calls, ok, cancel };
}

const createOption = (label: string, value: string) => ({ label, value });
const U21 = { ageCategoryCode: 'U21', categoryName: 'Under 21' };

describe('watchCustomCategory', () => {
  it('opens the category editor as soon as Custom is selected', () => {
    const { select, choose } = fakeSelect(['U12', 'U14', CUSTOM_CATEGORY], 'U12');
    const editor = fakeEditor();
    watchCustomCategory({ select, openEditor: editor.open, createOption });

    choose('U14');
    expect(editor.calls).toHaveLength(0);
    choose(CUSTOM_CATEGORY);
    expect(editor.calls).toHaveLength(1);
  });

  it('selects the new category, inserted before Custom, and holds it for Save without persisting it', () => {
    const { select, choose } = fakeSelect(['U12', CUSTOM_CATEGORY], 'U12');
    const editor = fakeEditor();
    const watch = watchCustomCategory({ select, openEditor: editor.open, createOption });

    choose(CUSTOM_CATEGORY);
    editor.ok(U21);

    expect(select.value).toBe('U21');
    expect(select.options.map((o: any) => o.value)).toEqual(['U12', 'U21', CUSTOM_CATEGORY]);
    expect(watch.pendingFor('U21')).toBe(U21);
    expect(watch.pendingFor('U12')).toBeUndefined();
  });

  it('restores the previous choice when the editor is cancelled', () => {
    const { select, choose } = fakeSelect(['U12', 'U14', CUSTOM_CATEGORY], 'U12');
    const editor = fakeEditor();
    const watch = watchCustomCategory({ select, openEditor: editor.open, createOption });

    choose('U14');
    choose(CUSTOM_CATEGORY);
    editor.cancel();

    expect(select.value).toBe('U14');
    expect(select.options).toHaveLength(3);
    expect(watch.pendingFor('U14')).toBeUndefined();
  });

  it('does not add a second option for a category already listed', () => {
    const { select, choose } = fakeSelect(['U12', 'U21', CUSTOM_CATEGORY], 'U12');
    const editor = fakeEditor();
    watchCustomCategory({ select, openEditor: editor.open, createOption });

    choose(CUSTOM_CATEGORY);
    editor.ok(U21);

    expect(select.value).toBe('U21');
    expect(select.options).toHaveLength(3);
  });
});

describe('categoryOption', () => {
  it('labels a category by name and code, and values it by its code', () => {
    expect(categoryOption(U21)).toEqual({ label: 'Under 21 (U21)', value: 'U21' });
  });

  it('falls back to the name when the code is a stray placeholder', () => {
    expect(categoryOption({ ageCategoryCode: '------------', categoryName: 'Open' })).toEqual({
      label: 'Open',
      value: 'Open',
    });
  });
});

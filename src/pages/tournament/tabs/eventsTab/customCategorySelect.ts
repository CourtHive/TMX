/**
 * The event drawer's age-category select and its "Custom" choice.
 *
 * Choosing Custom opens the category editor at once (CA, 2026-11-18: "I think open on select"); it used to
 * wait for Save, so the select sat on "Custom" with nothing to say what it would become. The chosen category
 * is added to the select and held until Save, which is when the drawer persists it as a tournament category:
 * a drawer cancelled after choosing leaves no orphan category behind.
 */

export const CUSTOM_CATEGORY = 'custom';

// Some tournaments have a stray "------------" ageCategoryCode persisted
// from an old form-rendering bug (renderField treated value: '' as falsy
// and the select fell back to the dashed label as its value). Strip them
// at read time so we don't keep rendering the placeholder in dropdowns
// and event detail. Root-cause fix landed in courthive-components.
export function cleanAgeCode(value: any): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^[-—–_]+$/.test(trimmed)) return undefined;
  return trimmed;
}

/** How a category appears in the select. */
export function categoryOption(category: any): { label: string; value: string } {
  const cleanCode = cleanAgeCode(category?.ageCategoryCode);
  const label = cleanCode ? `${category.categoryName} (${cleanCode})` : category?.categoryName;
  return { label, value: cleanCode || category?.categoryName };
}

/** Opens the category editor. `onChosen` runs on OK; `onClose` runs on every close, after `onChosen`. */
export type CategoryEditorOpener = (handlers: { onChosen: (category: any) => void; onClose: () => void }) => void;

type CategorySelect = Pick<HTMLSelectElement, 'value' | 'options' | 'addEventListener'>;

export function watchCustomCategory({
  select,
  openEditor,
  createOption = (label, value) => new Option(label, value),
}: {
  select: CategorySelect;
  openEditor: CategoryEditorOpener;
  createOption?: (label: string, value: string) => any;
}): { pendingFor: (value: string) => any } {
  let previous = select.value;
  let pending: any;

  select.addEventListener('change', () => {
    if (select.value !== CUSTOM_CATEGORY) {
      previous = select.value;
      return;
    }
    let chosen = false;
    openEditor({
      onChosen: (category) => {
        if (!category?.ageCategoryCode) return;
        chosen = true;
        const { label, value } = categoryOption(category);
        // Custom stays last, so a new category goes in just before it
        const listed = Array.from(select.options).some((option: any) => option.value === value);
        if (!listed) select.options.add(createOption(label, value), select.options.length - 1);
        select.value = value;
        previous = value;
        pending = category;
      },
      // a cancelled editor leaves the choice as it was, never on Custom
      onClose: () => {
        if (!chosen) select.value = previous;
      },
    });
  });

  return { pendingFor: (value) => (pending && categoryOption(pending).value === value ? pending : undefined) };
}

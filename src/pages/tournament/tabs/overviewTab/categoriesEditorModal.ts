/**
 * Tournament Categories manager — list view with Add / Edit / Delete, each category with the rule it
 * applies (categoryDefinition.ts), and the categories events use that the tournament does not define.
 *
 * Reuses courthive-components.getCategoryModal for the per-row editor.
 * Persists via mutationRequest against SET_TOURNAMENT_CATEGORIES.
 *
 * Delete is blocked outright when the target category is referenced by
 * an event's category field (matched on ageCategoryCode or categoryName).
 * The factory's setTournamentCategories enforces the same invariant as
 * a backstop — see Mentat/planning/POLICY_DELIVERY.md attached-policy
 * invariant for the broader pattern.
 */
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import {
  undefinedEventCategories,
  editorCategoryType,
  referencingEvents,
  describeCategory,
  cleanCode,
  type TournamentCategory,
} from './categoryDefinition';
import { getCategoryModal } from 'courthive-components';
import { eventGovernor } from 'tods-competition-factory';
import { t } from 'i18n';

import { SET_TOURNAMENT_CATEGORIES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

const TOAST_WARNING = 'is-warning';

function getCategories(): TournamentCategory[] {
  const { tournamentRecord } = tournamentEngine.getTournament() ?? {};
  return (tournamentRecord?.tournamentCategories ?? []) as TournamentCategory[];
}

function getEvents(): any[] {
  const { tournamentRecord } = tournamentEngine.getTournament() ?? {};
  return tournamentRecord?.events ?? [];
}

function categoryRowLabel(cat: TournamentCategory): string {
  const name = cat.categoryName ?? '(unnamed)';
  const code = cleanCode(cat.ageCategoryCode);
  if (code) return `${name} (${code})`;
  return name;
}

/** The tournament's start date: the day age rules are stated for, as eligibility checks them. */
function consideredDate(): string | undefined {
  return tournamentEngine.getTournament()?.tournamentRecord?.startDate;
}

function categoryRowDetail(cat: TournamentCategory): string {
  const rule = describeCategory(cat, {
    getAgeDetails: (args) => eventGovernor.getCategoryAgeDetails(args),
    consideredDate: consideredDate(),
    t: (key, values) => String(t(key, values ?? {})),
  });
  return [...rule, cat.notes].filter(Boolean).join(' · ');
}

function persistCategories(updated: TournamentCategory[], onSuccess?: () => void): void {
  // setTournamentCategories keeps only categories with a `type` (the editor's AGE / RATING / BOTH), so one made
  // anywhere else (an event's, a generated one) is given the type its rule implies rather than silently dropped
  const categories = updated.map((category) => ({ ...category, type: editorCategoryType(category) }));
  mutationRequest({
    methods: [{ method: SET_TOURNAMENT_CATEGORIES, params: { categories } }],
    callback: (resp: any) => {
      if (resp?.success) {
        onSuccess?.();
        return;
      }
      const referenced = Array.isArray(resp?.referenced) ? resp.referenced.join(', ') : null;
      tmxToast({
        message: referenced
          ? t('modals.editCategories.deleteBlocked', { categories: referenced })
          : t('pages.events.editEvent.categorySaveWarning'),
        intent: TOAST_WARNING,
        duration: 4500,
      });
    },
  });
}

export function openCategoriesEditorModal({ onSave }: { onSave?: () => void } = {}): void {
  let listContainer: HTMLElement | null = null;

  const renderList = () => {
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const categories = getCategories();
    renderUndefined(categories);
    if (!categories.length) {
      const empty = document.createElement('div');
      empty.style.cssText =
        'color: var(--tmx-text-secondary); padding: 1rem; text-align: center; border: 1px dashed var(--tmx-border-secondary); border-radius: 6px;';
      empty.textContent = t('modals.editCategories.empty');
      listContainer.appendChild(empty);
      return;
    }

    for (const [index, cat] of categories.entries()) {
      listContainer.appendChild(buildRow(cat, index));
    }
  };

  const buildRow = (cat: TournamentCategory, index: number): HTMLElement => {
    const row = document.createElement('div');
    row.style.cssText =
      'display: flex; align-items: center; gap: .75rem; padding: .5rem .75rem; border: 1px solid var(--tmx-border-primary); border-radius: 6px; background: var(--tmx-bg-elevated);';

    const meta = document.createElement('div');
    meta.style.cssText = 'flex: 1; min-width: 0;';

    const label = document.createElement('div');
    label.style.cssText = 'font-weight: 500; color: var(--tmx-text-primary); word-break: break-word;';
    label.textContent = categoryRowLabel(cat);
    meta.appendChild(label);

    const detail = categoryRowDetail(cat);
    if (detail) {
      const detailEl = document.createElement('div');
      detailEl.style.cssText = 'font-size: .8rem; color: var(--tmx-text-secondary);';
      detailEl.textContent = detail;
      meta.appendChild(detailEl);
    }

    row.appendChild(meta);

    const refs = referencingEvents(cat, getEvents());
    const usagePill = buildUsagePill(cat, refs);
    row.appendChild(usagePill);

    // a category in use is not edited: its events would silently change who may enter (see the intro)
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'button is-small is-light';
    editBtn.textContent = t('common.edit');
    editBtn.disabled = refs.length > 0;
    if (refs.length === 0) {
      editBtn.addEventListener('click', () => editAt(index));
    } else {
      editBtn.title = t('modals.editCategories.deleteDisabledHint');
    }
    row.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'button is-small is-danger is-light';
    deleteBtn.textContent = t('common.delete');
    deleteBtn.disabled = refs.length > 0;
    if (refs.length === 0) {
      deleteBtn.addEventListener('click', () => deleteAt(index));
    } else {
      deleteBtn.title = t('modals.editCategories.deleteDisabledHint');
    }
    row.appendChild(deleteBtn);

    return row;
  };

  const buildUsagePill = (cat: TournamentCategory, refs: string[]): HTMLElement => {
    const pill = document.createElement('span');
    if (refs.length === 0) {
      pill.style.cssText =
        'font-size: .75rem; padding: 2px .5rem; border-radius: 999px; background: var(--tmx-bg-tertiary); color: var(--tmx-text-secondary); white-space: nowrap;';
      pill.textContent = t('modals.editCategories.unused');
      return pill;
    }
    pill.style.cssText =
      'font-size: .75rem; padding: 2px .5rem; border-radius: 999px; background: var(--tmx-panel-blue-bg); color: var(--tmx-accent-blue); border: 1px solid var(--tmx-panel-blue-border); white-space: nowrap; cursor: help;';
    pill.textContent = t('modals.editCategories.usageCount', { count: refs.length });
    pill.title = t('modals.editCategories.usageList', {
      name: cat.categoryName ?? '?',
      events: refs.join(', '),
    });
    return pill;
  };

  const deleteAt = (index: number) => {
    const categories = getCategories();
    const target = categories[index];
    if (!target) return;

    // Guard already enforced by the disabled button + factory backstop,
    // but re-check here in case state shifted between render and click.
    const refs = referencingEvents(target, getEvents());
    if (refs.length) {
      tmxToast({
        message: t('modals.editCategories.deleteBlocked', {
          name: target.categoryName ?? '?',
          count: refs.length,
          events: refs.join(', '),
        }),
        intent: TOAST_WARNING,
        duration: 5500,
      });
      return;
    }

    if (!confirm(t('modals.editCategories.confirmDelete', { name: target.categoryName ?? '?' }))) return;

    const next = categories.filter((_, i) => i !== index);
    persistCategories(next, () => {
      renderList();
      onSave?.();
    });
  };

  const isDuplicate = (candidate: TournamentCategory, exceptIndex?: number) =>
    getCategories().some(
      (c, i) =>
        i !== exceptIndex &&
        ((!!candidate.ageCategoryCode && c.ageCategoryCode === candidate.ageCategoryCode) ||
          (!!candidate.categoryName && c.categoryName === candidate.categoryName)),
    );

  /** The category editor, opened on the tournament's start date so its age details match this list. */
  const openEditor = (existingCategory: TournamentCategory, onChosen: (category: TournamentCategory) => void) => {
    getCategoryModal({
      existingCategory: { ...existingCategory, type: editorCategoryType(existingCategory) },
      editorConfig: { defaultConsideredDate: consideredDate() },
      callback: (chosen: any) => chosen && onChosen(chosen),
    });
  };

  const saveAndRefresh = (next: TournamentCategory[]) =>
    persistCategories(next, () => {
      renderList();
      onSave?.();
    });

  const addCategory = (created: TournamentCategory) => {
    if (isDuplicate(created)) {
      tmxToast({ message: t('modals.editCategories.duplicate'), intent: TOAST_WARNING });
      return;
    }
    saveAndRefresh([...getCategories(), created]);
  };

  const addNew = () => openEditor({}, addCategory);

  const editAt = (index: number) => {
    const target = getCategories()[index];
    if (!target) return;
    openEditor(target, (edited) => {
      if (isDuplicate(edited, index)) {
        tmxToast({ message: t('modals.editCategories.duplicate'), intent: TOAST_WARNING });
        return;
      }
      saveAndRefresh(getCategories().map((c, i) => (i === index ? edited : c)));
    });
  };

  let undefinedContainer: HTMLElement | null = null;

  /**
   * The categories events use that the tournament does not define: an event can name a category ("U18")
   * that appears nowhere in this list, which is how a mock event read as restricted while nothing said so.
   */
  const renderUndefined = (categories: TournamentCategory[]) => {
    if (!undefinedContainer) return;
    undefinedContainer.innerHTML = '';
    const missing = undefinedEventCategories(categories, getEvents());
    undefinedContainer.style.display = missing.length ? 'flex' : NONE;
    if (!missing.length) return;

    const heading = document.createElement('div');
    heading.style.cssText = 'font-weight: 500; color: var(--tmx-text-primary);';
    heading.textContent = t('modals.editCategories.undefinedTitle');
    undefinedContainer.appendChild(heading);

    for (const { category, usedBy } of missing) {
      const row = document.createElement('div');
      row.style.cssText =
        'display: flex; align-items: center; gap: .75rem; padding: .5rem .75rem; border: 1px dashed var(--tmx-border-secondary); border-radius: 6px;';
      const meta = document.createElement('div');
      meta.style.cssText = 'flex: 1; min-width: 0;';
      const label = document.createElement('div');
      label.style.cssText = 'font-weight: 500; color: var(--tmx-text-primary); word-break: break-word;';
      label.textContent = categoryRowLabel(category);
      meta.appendChild(label);
      const detail = document.createElement('div');
      detail.style.cssText = 'font-size: .8rem; color: var(--tmx-text-secondary);';
      detail.textContent = [
        categoryRowDetail(category),
        t('modals.editCategories.usageList', { name: category.categoryName ?? '?', events: usedBy.join(', ') }),
      ].join(' · ');
      meta.appendChild(detail);
      row.appendChild(meta);

      // a category with a rule is defined exactly as its events have it; one with only a name opens the editor,
      // so the rule it is missing can be given before anything relies on it
      const defineBtn = document.createElement('button');
      defineBtn.type = 'button';
      defineBtn.className = 'button is-small is-info is-light';
      defineBtn.textContent = t('modals.editCategories.define');
      defineBtn.addEventListener('click', () =>
        editorCategoryType(category) ? addCategory(category) : openEditor(category, addCategory),
      );
      row.appendChild(defineBtn);
      undefinedContainer.appendChild(row);
    }
  };

  const content = (elem: HTMLElement) => {
    // The chc-modal shell only pads its header/footer — the body wrapper
    // we get is edge-to-edge. Pad it so the intro text, list, and Add
    // button don't sit flush against the modal frame.
    elem.style.cssText =
      'display: flex; flex-direction: column; gap: .75rem; min-width: 28rem; max-width: 38rem; padding: 1rem;';

    const intro = document.createElement('div');
    intro.style.cssText = 'color: var(--tmx-text-secondary); font-size: .85rem;';
    intro.textContent = t('modals.editCategories.intro');
    elem.appendChild(intro);

    // Scroll the list so 40+ categories don't push the modal off-screen.
    // Cap at roughly half the viewport; the modal-shell handles overflow
    // above this if needed.
    undefinedContainer = document.createElement('div');
    undefinedContainer.style.cssText = 'flex-direction: column; gap: .4rem; padding-bottom: .5rem;';
    elem.appendChild(undefinedContainer);

    listContainer = document.createElement('div');
    listContainer.style.cssText =
      'display: flex; flex-direction: column; gap: .4rem; max-height: 50vh; overflow-y: auto; padding-right: .25rem;';
    elem.appendChild(listContainer);
    renderList();

    const addRow = document.createElement('div');
    addRow.style.cssText = 'display: flex; justify-content: flex-end; padding: .75rem 0 .25rem 0;';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'button is-small is-info';
    addBtn.textContent = t('modals.editCategories.add');
    addBtn.addEventListener('click', addNew);
    addRow.appendChild(addBtn);
    elem.appendChild(addRow);
  };

  openModal({
    title: t('modals.editCategories.title'),
    content,
    buttons: [{ label: t('common.close'), intent: NONE, close: true, onClick: () => closeModal() }],
  });
}

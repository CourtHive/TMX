/**
 * Tournament Categories manager — list view with Add / Edit / Delete.
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
import { getCategoryModal } from 'courthive-components';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

import { SET_TOURNAMENT_CATEGORIES } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

const TOAST_WARNING = 'is-warning';

interface TournamentCategory {
  categoryName?: string;
  type?: string;
  ageCategoryCode?: string;
  ratingType?: string;
  ratingMin?: number;
  ratingMax?: number;
  notes?: string;
}

function getCategories(): TournamentCategory[] {
  const { tournamentRecord } = tournamentEngine.getTournament() ?? {};
  return (tournamentRecord?.tournamentCategories ?? []) as TournamentCategory[];
}

function getEvents(): any[] {
  const { tournamentRecord } = tournamentEngine.getTournament() ?? {};
  return tournamentRecord?.events ?? [];
}

/**
 * Walk events looking for any whose category.ageCategoryCode or
 * categoryName matches this row. Returns the matching event names so
 * the blocked-delete toast can name them.
 */
function findReferencingEvents(category: TournamentCategory, events: any[]): string[] {
  const code = category.ageCategoryCode;
  const name = category.categoryName;
  const matches: string[] = [];
  for (const event of events) {
    const cat = event?.category;
    if (!cat) continue;
    const eCode = cat.ageCategoryCode;
    const eName = cat.categoryName;
    const referenced =
      (!!code && (eCode === code || eName === code)) || (!!name && (eCode === name || eName === name));
    if (referenced) matches.push(event.eventName ?? event.eventId ?? '?');
  }
  return matches;
}

function categoryRowLabel(cat: TournamentCategory): string {
  const name = cat.categoryName ?? '(unnamed)';
  const code = cat.ageCategoryCode && /^[-—–_]+$/.test(cat.ageCategoryCode) ? undefined : cat.ageCategoryCode;
  if (code) return `${name} (${code})`;
  return name;
}

function categoryRowDetail(cat: TournamentCategory): string {
  const fragments: string[] = [];
  if (cat.type) fragments.push(cat.type);
  if (cat.ratingType && (cat.ratingMin !== undefined || cat.ratingMax !== undefined)) {
    const range = [cat.ratingMin, cat.ratingMax].filter((v) => v !== undefined).join('–');
    fragments.push(`${cat.ratingType} ${range}`);
  } else if (cat.ratingType) {
    fragments.push(cat.ratingType);
  }
  return fragments.join(' · ');
}

function persistCategories(updated: TournamentCategory[], onSuccess?: () => void): void {
  mutationRequest({
    methods: [{ method: SET_TOURNAMENT_CATEGORIES, params: { categories: updated } }],
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

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'button is-small';
    editBtn.textContent = t('common.edit');
    editBtn.addEventListener('click', () => editAt(index));
    row.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'button is-small is-danger is-light';
    deleteBtn.textContent = t('common.delete');
    deleteBtn.addEventListener('click', () => deleteAt(index));
    row.appendChild(deleteBtn);

    return row;
  };

  const editAt = (index: number) => {
    const categories = getCategories();
    const current = categories[index];
    if (!current) return;

    getCategoryModal({
      existingCategory: current as any,
      editorConfig: {},
      callback: (updated: any) => {
        if (!updated) return;
        const next = categories.map((c, i) => (i === index ? { ...current, ...updated } : c));
        persistCategories(next, () => {
          renderList();
          onSave?.();
        });
      },
    });
  };

  const deleteAt = (index: number) => {
    const categories = getCategories();
    const target = categories[index];
    if (!target) return;

    const refs = findReferencingEvents(target, getEvents());
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

  const addNew = () => {
    getCategoryModal({
      existingCategory: {},
      editorConfig: {},
      callback: (created: any) => {
        if (!created) return;
        const existing = getCategories();
        const isDuplicate = existing.some(
          (c) =>
            (created.ageCategoryCode && c.ageCategoryCode === created.ageCategoryCode) ||
            (created.categoryName && c.categoryName === created.categoryName),
        );
        if (isDuplicate) {
          tmxToast({
            message: t('modals.editCategories.duplicate'),
            intent: TOAST_WARNING,
          });
          return;
        }
        persistCategories([...existing, created], () => {
          renderList();
          onSave?.();
        });
      },
    });
  };

  const content = (elem: HTMLElement) => {
    elem.style.cssText = 'display: flex; flex-direction: column; gap: .75rem; min-width: 28rem; max-width: 38rem;';

    const intro = document.createElement('div');
    intro.style.cssText = 'color: var(--tmx-text-secondary); font-size: .85rem;';
    intro.textContent = t('modals.editCategories.intro');
    elem.appendChild(intro);

    listContainer = document.createElement('div');
    listContainer.style.cssText = 'display: flex; flex-direction: column; gap: .4rem;';
    elem.appendChild(listContainer);
    renderList();

    const addRow = document.createElement('div');
    addRow.style.cssText = 'display: flex; justify-content: flex-end;';
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

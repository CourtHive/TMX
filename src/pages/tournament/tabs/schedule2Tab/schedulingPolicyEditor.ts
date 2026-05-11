/**
 * Scheduling Policy Editor — manage user-defined scheduling policies stored
 * in localStorage under `tmx:scheduling-policies`. Two screens:
 *
 *   1. Manager: list of saved policies with edit / delete / add actions.
 *   2. Editor:  form for one policy (name + default times + daily limits).
 *
 * Per-format averageTimes / recoveryTimes overrides are deferred to a
 * future iteration — the MVP covers the policy attributes that matter
 * most for the Garman scheduler when no specific format match is found.
 *
 * Persistence shape (the value stored at SAVED_POLICIES_KEY):
 *   Array<{ name: string, definition: { scheduling: {...} } }>
 *
 * The `definition` shape mirrors what `attachPolicies({ policyDefinitions })`
 * accepts, so a saved policy can be attached verbatim.
 */
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { tmxToast } from 'services/notifications/tmxToast';

export const SAVED_POLICIES_KEY = 'tmx:scheduling-policies';

const POLICY_TYPE_SCHEDULING = 'scheduling';
const DOUBLES = 'DOUBLES';
const SINGLES = 'SINGLES';
const BORDER_PRIMARY = 'border: 1px solid var(--tmx-border-primary)';

export interface SavedSchedulingPolicy {
  name: string;
  definition: Record<string, any>;
}

export function readSavedPolicies(): SavedSchedulingPolicy[] {
  try {
    const raw = localStorage.getItem(SAVED_POLICIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SavedSchedulingPolicy =>
        p && typeof p.name === 'string' && p.definition && typeof p.definition === 'object',
    );
  } catch {
    return [];
  }
}

function writeSavedPolicies(policies: SavedSchedulingPolicy[]): void {
  try {
    localStorage.setItem(SAVED_POLICIES_KEY, JSON.stringify(policies));
  } catch (err) {
    console.error('Failed to persist scheduling policies', err);
    tmxToast({ message: 'Failed to save policy to local storage.', intent: 'is-danger' });
  }
}

export interface OpenManagerParams {
  /** Called when the manager closes — caller can refresh dependent UI (e.g. Apply Times selector). */
  onClose?: () => void;
}

export function openSchedulingPolicyManager(params: OpenManagerParams = {}): void {
  const renderListContent = (root: HTMLElement) => {
    root.innerHTML = '';
    root.style.cssText = 'display: flex; flex-direction: column; gap: 10px; padding: 16px; font-size: 13px;';

    const policies = readSavedPolicies();

    if (!policies.length) {
      const empty = document.createElement('div');
      empty.style.cssText =
        'padding: 16px; text-align: center; color: var(--tmx-text-muted); font-style: italic; border: 1px dashed var(--tmx-border-primary); border-radius: 6px;';
      empty.textContent = 'No saved policies yet. Click "+ Add policy" to create one.';
      root.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
      for (const policy of policies) {
        list.appendChild(buildPolicyRow(policy, () => reopenManager()));
      }
      root.appendChild(list);
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.style.cssText = [
      'align-self: flex-start',
      'padding: 6px 12px',
      'border-radius: 6px',
      'border: 1px solid var(--tmx-accent-blue, #3b82f6)',
      'background: transparent',
      'color: var(--tmx-accent-blue, #3b82f6)',
      'cursor: pointer',
      'font-size: 12px',
    ].join('; ');
    addBtn.innerHTML = '<i class="fa-solid fa-plus" style="margin-right: 4px;"></i>Add policy';
    addBtn.addEventListener('click', () => {
      openSchedulingPolicyEditor({
        initial: null,
        onSaved: () => reopenManager(),
        onCancel: () => reopenManager(),
      });
    });
    root.appendChild(addBtn);
  };

  const reopenManager = () => {
    closeModal();
    // Defer one tick so the previous modal fully unmounts before opening the next.
    setTimeout(() => openSchedulingPolicyManager(params), 0);
  };

  openModal({
    title: 'Manage Scheduling Policies',
    content: renderListContent,
    buttons: [
      {
        label: 'Close',
        intent: 'none',
        close: true,
        onClick: () => params.onClose?.(),
      },
    ],
  });
}

function buildPolicyRow(policy: SavedSchedulingPolicy, onChange: () => void): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = [
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'gap: 8px',
    'padding: 8px 10px',
    BORDER_PRIMARY,
    'border-radius: 6px',
  ].join('; ');

  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-weight: 600;';
  nameEl.textContent = policy.name;

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 6px;';

  const editBtn = iconButton('fa-pen-to-square', 'Edit', () => {
    openSchedulingPolicyEditor({
      initial: policy,
      onSaved: onChange,
      onCancel: onChange,
    });
  });

  const deleteBtn = iconButton('fa-trash', 'Delete', () => {
    const policies = readSavedPolicies().filter((p) => p.name !== policy.name);
    writeSavedPolicies(policies);
    tmxToast({ message: `Deleted policy "${policy.name}"`, intent: 'is-warning' });
    onChange();
  });
  deleteBtn.style.color = 'var(--tmx-accent-red, #ef4444)';
  deleteBtn.style.borderColor = 'var(--tmx-accent-red, #ef4444)';

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  row.appendChild(nameEl);
  row.appendChild(actions);
  return row;
}

function iconButton(icon: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = title;
  btn.style.cssText = [
    'padding: 4px 8px',
    'border-radius: 4px',
    BORDER_PRIMARY,
    'background: transparent',
    'color: var(--tmx-color-primary)',
    'cursor: pointer',
    'font-size: 12px',
  ].join('; ');
  btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
  btn.addEventListener('click', onClick);
  return btn;
}

export interface OpenEditorParams {
  /** null = create new; SavedSchedulingPolicy = edit existing (matched by name). */
  initial: SavedSchedulingPolicy | null;
  onSaved?: (policy: SavedSchedulingPolicy) => void;
  onCancel?: () => void;
}

interface EditorFormState {
  name: string;
  averageMinutes: number;
  recoveryMinutes: number;
  recoveryDoublesMinutes: number | '';
  dailyLimitSingles: number | '';
  dailyLimitDoubles: number | '';
  dailyLimitTotal: number | '';
}

function defaultFormState(): EditorFormState {
  return {
    name: '',
    averageMinutes: 90,
    recoveryMinutes: 0,
    recoveryDoublesMinutes: '',
    dailyLimitSingles: '',
    dailyLimitDoubles: '',
    dailyLimitTotal: '',
  };
}

function formStateFromDefinition(name: string, def: Record<string, any>): EditorFormState {
  const scheduling = def?.[POLICY_TYPE_SCHEDULING] ?? {};
  const avgEntry = scheduling.defaultTimes?.averageTimes?.[0]?.minutes ?? {};
  const recEntry = scheduling.defaultTimes?.recoveryTimes?.[0]?.minutes ?? {};
  const limits = scheduling.defaultDailyLimits ?? {};
  return {
    name,
    averageMinutes: typeof avgEntry.default === 'number' ? avgEntry.default : 90,
    recoveryMinutes: typeof recEntry.default === 'number' ? recEntry.default : 0,
    recoveryDoublesMinutes: typeof recEntry[DOUBLES] === 'number' ? recEntry[DOUBLES] : '',
    dailyLimitSingles: typeof limits[SINGLES] === 'number' ? limits[SINGLES] : '',
    dailyLimitDoubles: typeof limits[DOUBLES] === 'number' ? limits[DOUBLES] : '',
    dailyLimitTotal: typeof limits.total === 'number' ? limits.total : '',
  };
}

function buildDefinitionFromForm(form: EditorFormState): Record<string, any> {
  const recoveryMinutes: Record<string, number> = { default: form.recoveryMinutes };
  if (typeof form.recoveryDoublesMinutes === 'number') {
    recoveryMinutes[DOUBLES] = form.recoveryDoublesMinutes;
  }

  const defaultDailyLimits: Record<string, number> = {};
  if (typeof form.dailyLimitSingles === 'number') defaultDailyLimits[SINGLES] = form.dailyLimitSingles;
  if (typeof form.dailyLimitDoubles === 'number') defaultDailyLimits[DOUBLES] = form.dailyLimitDoubles;
  if (typeof form.dailyLimitTotal === 'number') defaultDailyLimits.total = form.dailyLimitTotal;

  const scheduling: Record<string, any> = {
    defaultTimes: {
      averageTimes: [{ minutes: { default: form.averageMinutes } }],
      recoveryTimes: [{ minutes: recoveryMinutes }],
    },
  };
  if (Object.keys(defaultDailyLimits).length) {
    scheduling.defaultDailyLimits = defaultDailyLimits;
  }

  return { [POLICY_TYPE_SCHEDULING]: scheduling };
}

export function openSchedulingPolicyEditor(params: OpenEditorParams): void {
  const isEdit = !!params.initial;
  const initial = isEdit
    ? formStateFromDefinition(params.initial!.name, params.initial!.definition)
    : defaultFormState();
  const form: EditorFormState = { ...initial };
  // Track the original name to identify the row for update/delete.
  const originalName = params.initial?.name ?? null;

  const renderContent = (root: HTMLElement) => {
    root.innerHTML = '';
    root.style.cssText = 'display: flex; flex-direction: column; gap: 12px; padding: 16px; font-size: 13px;';

    root.appendChild(stringField('Name', 'e.g. Junior tournament', form.name, (v) => (form.name = v)));

    root.appendChild(section('Default times (minutes per match)'));
    root.appendChild(numberField('Average', form.averageMinutes, (v) => (form.averageMinutes = v ?? 0)));
    root.appendChild(numberField('Recovery (default)', form.recoveryMinutes, (v) => (form.recoveryMinutes = v ?? 0)));
    root.appendChild(
      optionalNumberField(
        'Recovery (doubles override)',
        form.recoveryDoublesMinutes,
        (v) => (form.recoveryDoublesMinutes = v),
      ),
    );

    root.appendChild(section('Daily limits (optional — matches per participant per day)'));
    root.appendChild(
      optionalNumberField('Singles', form.dailyLimitSingles, (v) => (form.dailyLimitSingles = v)),
    );
    root.appendChild(
      optionalNumberField('Doubles', form.dailyLimitDoubles, (v) => (form.dailyLimitDoubles = v)),
    );
    root.appendChild(optionalNumberField('Total', form.dailyLimitTotal, (v) => (form.dailyLimitTotal = v)));
  };

  openModal({
    title: isEdit ? `Edit Policy: ${params.initial!.name}` : 'New Scheduling Policy',
    content: renderContent,
    buttons: [
      {
        label: 'Cancel',
        intent: 'none',
        close: true,
        onClick: () => params.onCancel?.(),
      },
      {
        label: 'Save',
        intent: 'is-primary',
        close: false,
        onClick: () => {
          const name = form.name.trim();
          if (!name) {
            tmxToast({ message: 'Policy name is required.', intent: 'is-danger' });
            return;
          }

          const existing = readSavedPolicies();
          const nameTaken = existing.some((p) => p.name === name && p.name !== originalName);
          if (nameTaken) {
            tmxToast({ message: `A policy named "${name}" already exists.`, intent: 'is-danger' });
            return;
          }

          const definition = buildDefinitionFromForm(form);
          const saved: SavedSchedulingPolicy = { name, definition };

          const next = originalName
            ? existing.map((p) => (p.name === originalName ? saved : p))
            : [...existing, saved];
          writeSavedPolicies(next);

          tmxToast({ message: `Saved policy "${name}"`, intent: 'is-success' });
          closeModal();
          params.onSaved?.(saved);
        },
      },
    ],
  });
}

// ── Field builders ──

function section(label: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText =
    'font-weight: 700; font-size: 11px; text-transform: uppercase; color: var(--tmx-text-muted); letter-spacing: 0.04em; margin-top: 4px;';
  el.textContent = label;
  return el;
}

const FIELD_ROW_STYLE = 'display: flex; align-items: center; gap: 10px;';
const LABEL_STYLE = 'flex: 0 0 200px; font-size: 12px;';
const INPUT_STYLE = [
  'flex: 1',
  'padding: 4px 8px',
  'font-size: 13px',
  'border-radius: 4px',
  'border: 1px solid var(--tmx-border-primary)',
  'background: var(--tmx-bg-primary)',
  'color: var(--tmx-color-primary)',
].join('; ');

function stringField(label: string, placeholder: string, value: string, onChange: (v: string) => void): HTMLElement {
  const row = document.createElement('label');
  row.style.cssText = FIELD_ROW_STYLE;
  const labelEl = document.createElement('span');
  labelEl.style.cssText = LABEL_STYLE;
  labelEl.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.value = value;
  input.style.cssText = INPUT_STYLE;
  input.addEventListener('input', () => onChange(input.value));
  row.appendChild(labelEl);
  row.appendChild(input);
  return row;
}

function numberField(label: string, value: number, onChange: (v: number | null) => void): HTMLElement {
  const row = document.createElement('label');
  row.style.cssText = FIELD_ROW_STYLE;
  const labelEl = document.createElement('span');
  labelEl.style.cssText = LABEL_STYLE;
  labelEl.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.value = String(value);
  input.style.cssText = INPUT_STYLE;
  input.addEventListener('input', () => {
    const n = Number.parseInt(input.value, 10);
    onChange(Number.isFinite(n) ? n : null);
  });
  row.appendChild(labelEl);
  row.appendChild(input);
  return row;
}

function optionalNumberField(
  label: string,
  value: number | '',
  onChange: (v: number | '') => void,
): HTMLElement {
  const row = document.createElement('label');
  row.style.cssText = FIELD_ROW_STYLE;
  const labelEl = document.createElement('span');
  labelEl.style.cssText = LABEL_STYLE;
  labelEl.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.placeholder = '— not set —';
  input.value = value === '' ? '' : String(value);
  input.style.cssText = INPUT_STYLE;
  input.addEventListener('input', () => {
    if (input.value === '') {
      onChange('');
      return;
    }
    const n = Number.parseInt(input.value, 10);
    onChange(Number.isFinite(n) ? n : '');
  });
  row.appendChild(labelEl);
  row.appendChild(input);
  return row;
}

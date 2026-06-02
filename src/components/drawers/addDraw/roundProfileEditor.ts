/**
 * Bespoke round-profile editor surfaced for LUCKY_DRAW in the addDraw drawer.
 *
 * Chained per-round number inputs separated by "+N LL" badges. The default
 * profile is the ceil-halving cascade derived from drawSize (matches what
 * LUCKY_DRAW would produce). On each cell edit, downstream cells re-default
 * to ceil-halving from the edited value, so changing R2 from 10 → 12 produces
 * a cascade like 20 → 12 → 6 → 3 → 2 → 1. The final cell is locked at 1.
 *
 * Constraints per cell (enforced via clamp on change + inline error):
 *   - `next * 2 >= current`   — no winner-drop (mirrors factory validation)
 *   - `next <= current`       — can't have more participants than previous round
 *   - last cell === 1
 *   - `roundProfile[0] * 2 === drawSize`
 *
 * The editor is mounted as a sibling of the form's content area and is
 * shown/hidden externally via the controller. The explicit-profile mode of
 * LUCKY_DRAW requires an even drawSize; odd sizes show an inline message and
 * `getProfile()` returns null (the factory then falls back to its default
 * ceil-halving cascade for that drawSize).
 */

export type RoundProfileEditorOptions = {
  drawSize: number;
  initialProfile?: number[];
  onChange?: (profile: number[] | null) => void;
};

export type RoundProfileEditorController = {
  /** Show or hide the entire editor. */
  setVisible(visible: boolean): void;
  /** Update the drawSize and reset to the ceil-halving default. */
  setDrawSize(drawSize: number): void;
  /** Returns the current profile if valid, otherwise null. */
  getProfile(): number[] | null;
  /** Whether the current state passes all constraints. */
  isValid(): boolean;
  /** Remove the editor from the DOM and clean up listeners. */
  destroy(): void;
};

const CLASS_ROOT = 'rpe';
const CLASS_STRIP = 'rpe__strip';
const CLASS_CELL = 'rpe__cell';
const CLASS_CELL_LOCKED = 'rpe__cell--locked';
const CLASS_ARROW = 'rpe__arrow';
const CLASS_LL = 'rpe__ll';
const CLASS_LABEL = 'rpe__label';
const CLASS_ERROR = 'rpe__error';
const CLASS_RESET = 'rpe__reset';
const CLASS_DISABLED = 'rpe--disabled';

export function mountRoundProfileEditor(
  parentEl: HTMLElement,
  options: RoundProfileEditorOptions,
): RoundProfileEditorController {
  const root = document.createElement('div');
  root.className = CLASS_ROOT;

  const labelEl = document.createElement('div');
  labelEl.className = CLASS_LABEL;
  const labelTitle = document.createElement('div');
  labelTitle.textContent = 'Round profile';
  const labelSub = document.createElement('em');
  labelSub.className = `${CLASS_LABEL}-sub`;
  labelSub.textContent = 'matchUps per round';
  labelEl.append(labelTitle, labelSub);
  root.appendChild(labelEl);

  const strip = document.createElement('div');
  strip.className = CLASS_STRIP;
  root.appendChild(strip);

  const errorEl = document.createElement('div');
  errorEl.className = CLASS_ERROR;
  root.appendChild(errorEl);

  const resetBtn = document.createElement('button');
  resetBtn.className = CLASS_RESET;
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset to defaults';
  root.appendChild(resetBtn);

  parentEl.appendChild(root);

  let drawSize = options.drawSize;
  let profile: number[] = options.initialProfile?.length
    ? sanitizeProfile(options.initialProfile, drawSize)
    : defaultProfile(drawSize);

  function render() {
    while (strip.firstChild) strip.removeChild(strip.firstChild);
    root.classList.remove(CLASS_DISABLED);

    if (drawSize < 2 || drawSize % 2 !== 0) {
      const msg = document.createElement('div');
      msg.textContent = 'An explicit round profile requires an even draw size of 2 or more.';
      strip.appendChild(msg);
      root.classList.add(CLASS_DISABLED);
      hideError();
      return;
    }

    for (let i = 0; i < profile.length; i++) {
      const isLast = i === profile.length - 1;
      const cell = document.createElement('input');
      cell.type = 'number';
      cell.className = CLASS_CELL;
      cell.value = String(profile[i]);
      cell.setAttribute('aria-label', `Round ${i + 1} matchUps`);
      cell.dataset.roundIndex = String(i);

      // R1 is derived from drawSize, last cell is the locked final — both are read-only.
      if (i === 0 || isLast) {
        cell.disabled = true;
        cell.classList.add(CLASS_CELL_LOCKED);
      } else {
        cell.min = String(Math.ceil(profile[i - 1] / 2));
        cell.max = String(profile[i - 1]);
        cell.addEventListener('change', () => {
          const parsed = Number.parseInt(cell.value);
          if (Number.isFinite(parsed)) handleCellChange(i, parsed);
        });
      }
      strip.appendChild(cell);

      if (!isLast) {
        const arrow = document.createElement('span');
        arrow.className = CLASS_ARROW;
        const llCount = 2 * profile[i + 1] - profile[i];
        const arrowText = document.createElement('span');
        arrowText.textContent = '→';
        arrow.appendChild(arrowText);
        if (llCount > 0) {
          const llBadge = document.createElement('span');
          llBadge.className = CLASS_LL;
          llBadge.textContent = `+${llCount} LL`;
          arrow.appendChild(llBadge);
        }
        strip.appendChild(arrow);
      }
    }

    validate();
  }

  function handleCellChange(idx: number, newValue: number) {
    if (idx <= 0 || idx >= profile.length - 1) return;
    const minValue = Math.ceil(profile[idx - 1] / 2);
    const maxValue = profile[idx - 1];
    const clamped = Math.max(minValue, Math.min(maxValue, newValue));
    profile[idx] = clamped;

    // Cascade downstream: re-default to ceil-halving from this point until 1.
    const cascaded: number[] = profile.slice(0, idx + 1);
    while (cascaded[cascaded.length - 1] > 1) {
      cascaded.push(Math.max(1, Math.ceil(cascaded[cascaded.length - 1] / 2)));
    }
    profile = cascaded;

    render();
    fireChange();
  }

  function validate(): boolean {
    if (drawSize < 2 || drawSize % 2 !== 0) {
      hideError();
      return false;
    }
    if (!profile.length || profile[profile.length - 1] !== 1) {
      showError('Profile must end at 1.');
      return false;
    }
    if (profile[0] * 2 !== drawSize) {
      showError(`First round × 2 (${profile[0] * 2}) must equal drawSize (${drawSize}).`);
      return false;
    }
    for (let i = 0; i < profile.length - 1; i++) {
      if (2 * profile[i + 1] < profile[i]) {
        showError(
          `Round ${i + 2} has only ${profile[i + 1] * 2} slots but round ${i + 1} produces ${profile[i]} winners.`,
        );
        return false;
      }
    }
    hideError();
    return true;
  }

  function showError(msg: string) {
    errorEl.textContent = msg;
    errorEl.style.display = '';
  }

  function hideError() {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  function fireChange() {
    options.onChange?.(validate() ? [...profile] : null);
  }

  resetBtn.addEventListener('click', () => {
    profile = defaultProfile(drawSize);
    render();
    fireChange();
  });

  render();

  return {
    setVisible(visible) {
      root.style.display = visible ? '' : 'none';
    },
    setDrawSize(newSize) {
      if (newSize === drawSize) return;
      drawSize = newSize;
      profile = defaultProfile(drawSize);
      render();
      fireChange();
    },
    getProfile() {
      return validate() ? [...profile] : null;
    },
    isValid() {
      return validate();
    },
    destroy() {
      root.remove();
    },
  };
}

/**
 * Ceil-halving cascade from drawSize/2 down to 1. For drawSize 40 this returns
 * [20, 10, 5, 3, 2, 1]; for 32 it returns [16, 8, 4, 2, 1]. Returns [] for
 * odd or sub-2 drawSizes — the caller renders a "requires even drawSize"
 * notice instead.
 */
export function defaultProfile(drawSize: number): number[] {
  if (drawSize < 2 || drawSize % 2 !== 0) return [];
  const result: number[] = [];
  let current = drawSize / 2;
  result.push(current);
  while (current > 1) {
    current = Math.max(1, Math.ceil(current / 2));
    result.push(current);
  }
  return result;
}

/**
 * Clamp a user-supplied profile into the valid range relative to drawSize.
 * Trims trailing values past the first 1; extends with ceil-halving if it
 * doesn't reach 1; rejects (returns default) if the head doesn't match.
 */
function sanitizeProfile(profile: number[], drawSize: number): number[] {
  if (drawSize < 2 || drawSize % 2 !== 0) return [];
  if (!profile.length || profile[0] !== drawSize / 2) return defaultProfile(drawSize);
  const result: number[] = [profile[0]];
  for (let i = 1; i < profile.length; i++) {
    const prev = result[result.length - 1];
    if (prev === 1) break;
    const minNext = Math.ceil(prev / 2);
    const value = Math.max(minNext, Math.min(prev, profile[i]));
    result.push(value);
  }
  while (result[result.length - 1] > 1) {
    result.push(Math.max(1, Math.ceil(result[result.length - 1] / 2)));
  }
  return result;
}

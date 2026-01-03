/**
 * Dial Pad score entry approach
 * Builds score string incrementally using matchUpFormat rules
 */
import { renderMatchUp } from 'courthive-components';
import { matchUpFormatCode } from 'tods-competition-factory';
import { formatScoreString } from './dialPadLogic';
import { validateScore } from '../utils/scoreValidator';
import { env } from 'settings/env';
import type { RenderScoreEntryParams, ScoreOutcome } from '../types';

type EntryState = {
  digits: string; // Raw digits: "36366" becomes "3-6 3-6 6"
  setTo: number;
  tiebreakAt: number;
};

export function renderDialPadScoreEntry(params: RenderScoreEntryParams): void {
  const { matchUp, container, onScoreChange } = params;

  try {
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '1em';

    // Parse match format
    const parsedFormat = matchUpFormatCode.parse(matchUp.matchUpFormat || 'SET3-S:6/TB7');
    const setTo = parsedFormat?.setFormat?.setTo || 6;
    const tiebreakAt = parsedFormat?.setFormat?.tiebreakAt || setTo;

    // Get scale attributes for participant ratings display
    const scaleAttributes = env.scales[env.activeScale];

    // State: just raw digits
    const state: EntryState = {
      digits: '',
      setTo,
      tiebreakAt,
    };

    // MatchUp display container
    const matchUpContainer = document.createElement('div');
    matchUpContainer.style.marginBottom = '0.5em';
    container.appendChild(matchUpContainer);

    // Match format selector
    if (matchUp.matchUpFormat) {
      const formatDisplay = document.createElement('div');
      formatDisplay.style.fontSize = '0.9em';
      formatDisplay.style.marginBottom = '0.5em';
      formatDisplay.style.display = 'flex';
      formatDisplay.style.alignItems = 'center';
      formatDisplay.style.gap = '0.5em';

      const formatLabel = document.createElement('span');
      formatLabel.textContent = 'Format:';
      formatLabel.style.color = '#666';
      formatDisplay.appendChild(formatLabel);

      const formatButton = document.createElement('button');
      formatButton.textContent = matchUp.matchUpFormat;
      formatButton.className = 'button';
      formatButton.style.fontSize = '0.75em';
      formatButton.style.padding = '0.2em 0.5em';
      formatButton.style.cursor = 'pointer';
      formatButton.title = 'Click to edit format';
      formatButton.addEventListener('click', async () => {
        try {
          const { getMatchUpFormatModal } = await import('courthive-components');

          getMatchUpFormatModal({
            existingMatchUpFormat: matchUp.matchUpFormat,
            callback: (newFormat: string) => {
              if (newFormat && newFormat !== matchUp.matchUpFormat) {
                matchUp.matchUpFormat = newFormat;
                formatButton.textContent = newFormat;

                // Clear state
                state.digits = '';

                container.innerHTML = '';
                renderDialPadScoreEntry({ matchUp, container, onScoreChange });
              }
            },
            modalConfig: {
              style: {
                fontSize: '12px', // Smaller base font size for TMX
                border: '3px solid #0066cc',
              },
            },
          } as any);
        } catch (error) {
          console.error('Error opening format selector:', error);
        }
      });
      formatDisplay.appendChild(formatButton);
      container.appendChild(formatDisplay);
    }

    // Score display (light blue)
    const scoreDisplay = document.createElement('div');
    scoreDisplay.style.fontSize = '1.2em';
    scoreDisplay.style.color = '#64B5F6';
    scoreDisplay.style.textAlign = 'center';
    scoreDisplay.style.padding = '0.25em 0.5em';
    scoreDisplay.style.fontWeight = 'bold';
    scoreDisplay.style.minHeight = '1.5em';
    scoreDisplay.style.maxWidth = '300px';
    scoreDisplay.style.margin = '0 auto';
    scoreDisplay.textContent = '-';
    container.appendChild(scoreDisplay);

    // Irregular ending section
    let selectedOutcome: 'COMPLETED' | 'RETIRED' | 'WALKOVER' | 'DEFAULTED' = 'COMPLETED';
    let selectedWinner: number | undefined = undefined;

    const irregularEndingContainer = document.createElement('div');
    irregularEndingContainer.style.display = 'none'; // Hidden by default
    irregularEndingContainer.style.marginBottom = '0.8em';
    irregularEndingContainer.style.padding = '0.6em';
    irregularEndingContainer.style.backgroundColor = '#fff3cd';
    irregularEndingContainer.style.border = '2px solid #ffc107';
    irregularEndingContainer.style.borderRadius = '4px';

    const irregularLabel = document.createElement('div');
    irregularLabel.textContent = 'Irregular Ending:';
    irregularLabel.style.fontSize = '0.8em';
    irregularLabel.style.fontWeight = '600';
    irregularLabel.style.marginBottom = '0.3em';
    irregularLabel.style.color = '#856404';
    irregularEndingContainer.appendChild(irregularLabel);

    // Winner selection for irregular endings
    const winnerSelectionContainer = document.createElement('div');
    winnerSelectionContainer.style.marginTop = '0.3em';

    const winnerLabel = document.createElement('div');
    winnerLabel.textContent = 'Winner:';
    winnerLabel.style.fontSize = '0.75em';
    winnerLabel.style.fontWeight = '500';
    winnerLabel.style.marginBottom = '0.2em';
    winnerLabel.style.color = '#856404';
    winnerSelectionContainer.appendChild(winnerLabel);

    const winnerOptions = document.createElement('div');
    winnerOptions.style.display = 'flex';
    winnerOptions.style.gap = '0.5em';
    winnerOptions.style.flexWrap = 'wrap';

    // Get participant info
    const side1 = matchUp.sides?.[0];
    const side2 = matchUp.sides?.[1];

    [1, 2].forEach((sideNum) => {
      const winnerRadioLabel = document.createElement('label');
      winnerRadioLabel.style.display = 'flex';
      winnerRadioLabel.style.alignItems = 'center';
      winnerRadioLabel.style.gap = '0.3em';
      winnerRadioLabel.style.cursor = 'pointer';

      const winnerRadio = document.createElement('input');
      winnerRadio.type = 'radio';
      winnerRadio.name = 'irregularWinner';
      winnerRadio.value = sideNum.toString();
      winnerRadio.addEventListener('change', () => {
        if (winnerRadio.checked) {
          selectedWinner = sideNum;
          updateDisplay();
        }
      });

      const winnerText = document.createElement('span');
      const side = sideNum === 1 ? side1 : side2;
      winnerText.textContent = side?.participant?.participantName || `Side ${sideNum}`;
      winnerText.style.fontSize = '0.75em';
      winnerText.style.color = '#856404';

      winnerRadioLabel.appendChild(winnerRadio);
      winnerRadioLabel.appendChild(winnerText);
      winnerOptions.appendChild(winnerRadioLabel);
    });

    winnerSelectionContainer.appendChild(winnerOptions);
    irregularEndingContainer.appendChild(winnerSelectionContainer);
    container.appendChild(irregularEndingContainer);

    // Dial pad
    const dialPadContainer = document.createElement('div');
    dialPadContainer.style.display = 'grid';
    dialPadContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
    dialPadContainer.style.gap = '8px';
    dialPadContainer.style.width = '100%';
    dialPadContainer.style.maxWidth = '320px';
    dialPadContainer.style.margin = '0 auto';
    container.appendChild(dialPadContainer);

    // Format score string using shared logic
    const formatScore = (digits: string): string => {
      return formatScoreString(digits, { matchUpFormat: matchUp.matchUpFormat || 'SET3-S:6/TB7' });
    };

    // Update matchUp display with current outcome
    const updateMatchUpDisplay = (outcome: ScoreOutcome | null) => {
      matchUpContainer.innerHTML = '';

      const displayMatchUp = {
        ...matchUp,
        score: outcome?.scoreObject || matchUp.score,
        winningSide: outcome?.winningSide,
        matchUpStatus: outcome?.matchUpStatus || matchUp.matchUpStatus,
      };

      const matchUpElement = renderMatchUp({
        matchUp: displayMatchUp,
        isLucky: true,
        composition: {
          configuration: {
            participantDetail: 'TEAM',
            genderColor: true,
            scaleAttributes,
            flag: false,
          },
        },
      });

      if (matchUpElement) {
        matchUpContainer.appendChild(matchUpElement);
      }
    };

    // Update display
    const updateDisplay = () => {
      const scoreString = formatScore(state.digits);

      // Show/hide irregular ending section vs score display
      if (selectedOutcome !== 'COMPLETED') {
        scoreDisplay.style.display = 'none';
        irregularEndingContainer.style.display = 'block';
      } else {
        scoreDisplay.style.display = 'block';
        scoreDisplay.textContent = scoreString || '-';
        irregularEndingContainer.style.display = 'none';
      }

      // Use validateScore for proper validation
      let validation = validateScore(scoreString, matchUp.matchUpFormat);

      // Add irregular ending info if selected
      if (selectedOutcome !== 'COMPLETED') {
        validation.matchUpStatus = selectedOutcome;
        if (selectedWinner) {
          validation.winningSide = selectedWinner;
          validation.isValid = true;
        } else {
          // Need winner selection for irregular ending
          validation.isValid = false;
        }
      }

      // Update matchUp display with validation result
      updateMatchUpDisplay(validation);

      onScoreChange(validation);

      // Update button states
      const clearBtn = document.getElementById('clearScoreV2') as HTMLButtonElement;
      if (clearBtn) clearBtn.disabled = state.digits.length === 0 && selectedOutcome === 'COMPLETED';

      // Enable/disable RET and DEF buttons based on score presence
      updateIrregularButtonStates();
    };

    // Handle digit press
    const handleDigitPress = (digit: number | string) => {
      const currentScoreString = formatScore(state.digits);

      // Check if we're in an incomplete tiebreak (regular set tiebreak) OR
      // if we're still building a tiebreak-only set score
      const hasOpenTiebreak = currentScoreString.includes('(') && !currentScoreString.includes(')');

      // For tiebreak-only sets: check if we're still building the second score
      // After user enters minus in a tiebreak-only set, allow unlimited digits for side2
      // Check if there's a single minus in the raw digits (one set only) and we're in a tiebreak format
      const hasMinus = state.digits.includes('-');
      const minusCount = (state.digits.match(/-/g) || []).length;
      const buildingTiebreakSet = currentScoreString.includes('[') && hasMinus && minusCount === 1;

      // Also check if we're about to ENTER a tiebreak-only set (all previous sets complete, next is tiebreak-only)
      const currentValidation = currentScoreString ? validateScore(currentScoreString, matchUp.matchUpFormat) : null;
      const completedSets = currentValidation?.sets?.length || 0;
      const parsedFormat = matchUpFormatCode.parse(matchUp.matchUpFormat);
      const bestOf = parsedFormat?.setFormat?.bestOf || 3;

      // Helper to check if a specific set is tiebreak-only
      const isSetTiebreakOnly = (setNumber: number) => {
        const isDecidingSet = setNumber === bestOf;
        const setFormat =
          isDecidingSet && parsedFormat?.finalSetFormat ? parsedFormat.finalSetFormat : parsedFormat?.setFormat;
        const tiebreakSetTo = setFormat?.tiebreakSet?.tiebreakTo;
        const regularSetTo = setFormat?.setTo;
        return !!tiebreakSetTo && !regularSetTo;
      };

      const enteringTiebreakOnlySet = completedSets < bestOf && isSetTiebreakOnly(completedSets + 1);
      
      // Also check if we're currently in a tiebreak-only set (last set being edited)
      const inTiebreakOnlySet = completedSets > 0 && isSetTiebreakOnly(completedSets);

      const inTiebreak = hasOpenTiebreak || buildingTiebreakSet || enteringTiebreakOnlySet || inTiebreakOnlySet;

      // For minus, we'll add a minus character
      const testDigits = digit === '-' ? state.digits + '-' : state.digits + digit.toString();

      const testScoreString = formatScore(testDigits);

      if (currentScoreString) {
        const currentValidation = validateScore(currentScoreString, matchUp.matchUpFormat);

        // Check if we're in the middle of entering a tiebreak
        // The factory's parseScoreString auto-completes tiebreaks for winningSide inference,
        // so we can't rely on checking if tiebreak scores are undefined.
        // Instead, check if the testScore is different from currentScore and if it looks like
        // we're continuing to enter digits within a tiebreak
        const lastSet = currentValidation.sets?.[currentValidation.sets.length - 1];

        // Check if the testScore shows progression within a tiebreak
        // e.g., current="6-7(1)" test="6-7(12)" means we're continuing tiebreak entry
        const currentHasTiebreak = currentScoreString.includes('(');
        const testHasTiebreak = testScoreString.includes('(');
        const tiebreakInProgress =
          currentHasTiebreak &&
          testHasTiebreak &&
          testScoreString !== currentScoreString &&
          testScoreString.startsWith(currentScoreString.substring(0, currentScoreString.lastIndexOf(')')));

        const lastSetNeedsTiebreak =
          lastSet &&
          ((lastSet.side1TiebreakScore === undefined && lastSet.side2TiebreakScore === undefined) ||
            (lastSet.side1TiebreakScore == null && lastSet.side2TiebreakScore == null) ||
            tiebreakInProgress) &&
          lastSet.side1Score !== undefined &&
          lastSet.side2Score !== undefined &&
          (lastSet.side1Score === lastSet.side2Score || Math.abs(lastSet.side1Score - lastSet.side2Score) === 1);

        // Match is complete if validation shows a winningSide and is valid
        // BUT allow continuing if:
        // 1. We're in the middle of entering a tiebreak score (inTiebreak)
        // 2. The last set needs tiebreak scores (lastSetNeedsTiebreak)
        if (currentValidation.isValid && currentValidation.winningSide && !inTiebreak && !lastSetNeedsTiebreak) {
          return;
        }

        // Block input if formatter didn't accept the digit (incomplete set)
        // Exception: allow if we're in a tiebreak or the test score is different (was accepted)
        if (!inTiebreak && digit !== '-' && testScoreString === currentScoreString) {
          return;
        }
      }

      // For minus, add separator
      // Minus is used to: 1) close tiebreaks, 2) separate side1 from side2 in TB sets, 3) separate sets
      // BUT ignore if last character is already a minus (prevent double minus)
      if (digit === '-') {
        if (!state.digits.endsWith('-')) {
          state.digits += '-';
        }
      } else {
        state.digits += digit.toString();
      }

      updateDisplay();
    };

    // Handle delete
    const handleDelete = () => {
      if (state.digits.length > 0) {
        state.digits = state.digits.slice(0, -1);
        updateDisplay();
      }
    };

    // Reset function for Clear button
    const resetDialPad = () => {
      state.digits = '';
      selectedOutcome = 'COMPLETED';
      selectedWinner = undefined;
      // Clear winner radio selections
      const winnerRadios = irregularEndingContainer.querySelectorAll(
        'input[name="irregularWinner"]',
      );
      winnerRadios.forEach((r) => ((r as HTMLInputElement).checked = false));
      updateDisplay();
    };

    // Expose reset function for Clear button
    (globalThis as any).resetDialPad = resetDialPad;

    // Function to update RET/DEF button states
    const updateIrregularButtonStates = () => {
      const retButton = dialPadContainer.querySelector('[data-button="retired"]') as HTMLButtonElement;
      const defButton = dialPadContainer.querySelector('[data-button="defaulted"]') as HTMLButtonElement;

      // Check if the formatted score string has both sides (contains a minus separating them)
      const scoreString = formatScore(state.digits);

      // A renderable score must have at least one complete set with both sides
      // This means the scoreString should contain a '-' (separator between sides)
      // Examples: '3-6', '11-13', '6-3 4-2' all have '-'
      // But '3', '11', '6' do not
      const hasRenderableScore = scoreString.includes('-') && scoreString.length > 2; // At least 'X-Y'

      if (retButton) retButton.disabled = !hasRenderableScore;
      if (defButton) defButton.disabled = !hasRenderableScore;
    };

    // Create dial pad buttons (4x3 grid)
    const buttons = [
      { label: '1', value: 1 },
      { label: '2', value: 2 },
      { label: '3', value: 3 },
      { label: 'RET', value: 'retired', isSpecial: true, requiresScore: true },
      { label: '4', value: 4 },
      { label: '5', value: 5 },
      { label: '6', value: 6 },
      { label: 'WO', value: 'walkover', isSpecial: true },
      { label: '7', value: 7 },
      { label: '8', value: 8 },
      { label: '9', value: 9 },
      { label: 'DEF', value: 'defaulted', isSpecial: true, requiresScore: true },
      { label: '⌫', value: 'delete', isSpecial: true },
      { label: '0', value: 0 },
      { label: '-', value: 'minus', isSpecial: true },
      { label: '', value: 'empty', isSpecial: true, disabled: true },
    ];

    buttons.forEach((btn) => {
      const button = document.createElement('button');
      button.className = 'button';
      button.textContent = btn.label;
      button.style.cssText = `
        height: 55px !important;
        width: 100% !important;
        padding: 0.5em !important;
      `;

      // Adjust font size for longer labels
      if (btn.label.length > 1 && !btn.isSpecial) {
        button.style.fontSize = '1.3em';
      } else if (btn.isSpecial && ['RET', 'WO', 'DEF'].includes(btn.label)) {
        button.style.fontSize = '0.95em';
        button.style.backgroundColor = '#ffe0b2'; // Orange-ish for irregular endings
      } else if (btn.isSpecial) {
        button.style.fontSize = '1.3em';
        button.style.backgroundColor = '#f0f0f0';
      } else {
        button.style.fontSize = '1.3em';
      }

      // Add data attribute for button type (for state management)
      if (btn.value === 'retired' || btn.value === 'defaulted') {
        button.dataset.button = btn.value;
      }

      // Disable and hide empty button
      if (btn.disabled) {
        button.disabled = true;
        button.style.visibility = 'hidden';
      }

      // Initially disable RET/DEF buttons (no score yet)
      if (btn.requiresScore) {
        button.disabled = true;
      }

      button.onclick = () => {
        if (btn.value === 'delete') {
          handleDelete();
        } else if (btn.value === 'minus') {
          handleDigitPress('-');
        } else if (btn.value === 'retired') {
          selectedOutcome = 'RETIRED';
          selectedWinner = undefined;
          // Clear winner radio selections
          const winnerRadios = irregularEndingContainer.querySelectorAll(
            'input[name="irregularWinner"]',
          );
          winnerRadios.forEach((r) => ((r as HTMLInputElement).checked = false));
          updateDisplay();
        } else if (btn.value === 'walkover') {
          selectedOutcome = 'WALKOVER';
          selectedWinner = undefined;
          // Clear score for walkover
          state.digits = '';
          // Clear winner radio selections
          const winnerRadios = irregularEndingContainer.querySelectorAll(
            'input[name="irregularWinner"]',
          );
          winnerRadios.forEach((r) => ((r as HTMLInputElement).checked = false));
          updateDisplay();
        } else if (btn.value === 'defaulted') {
          selectedOutcome = 'DEFAULTED';
          selectedWinner = undefined;
          // Clear winner radio selections
          const winnerRadios = irregularEndingContainer.querySelectorAll(
            'input[name="irregularWinner"]',
          );
          winnerRadios.forEach((r) => ((r as HTMLInputElement).checked = false));
          updateDisplay();
        } else if (btn.value === 'empty') {
          // Empty placeholder - do nothing
        } else {
          handleDigitPress(btn.value as number);
        }
      };

      dialPadContainer.appendChild(button);
    });

    // Keyboard support - attach to container, not window
    // This prevents interference with other scoring modals
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(Number.parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === '-' || e.key === ' ' || e.key === '/') {
        // Treat minus, space, and slash as separators
        e.preventDefault();
        handleDigitPress('-');
      } else if (e.key === ')') {
        // Accept ')' to close tiebreak and move to next set
        e.preventDefault();
        const currentScore = formatScore(state.digits);
        const inTiebreak = currentScore.includes('(') && !currentScore.includes(')');
        if (inTiebreak) {
          // Add minus to close tiebreak (will add ')' in formatting)
          state.digits += '-';
          updateDisplay();
        }
      }
    };

    // Attach listener to container with focus management
    container.setAttribute('tabindex', '-1'); // -1 means focusable but not in tab order
    container.style.outline = 'none'; // Remove blue focus outline
    container.addEventListener('keydown', handleKeyDown);

    // Auto-focus container so keyboard works immediately
    setTimeout(() => container.focus(), 100);

    // Cleanup
    const cleanup = () => {
      container.removeEventListener('keydown', handleKeyDown);
    };

    (globalThis as any).cleanupDialPad = cleanup;

    // Initial display
    updateMatchUpDisplay(null);
    updateDisplay();
  } catch (error) {
    console.error('Error rendering dial pad:', error);
    container.innerHTML = `<p style="color: red;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>`;
  }
}

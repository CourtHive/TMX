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
      formatButton.style.fontSize = '0.9em';
      formatButton.style.padding = '0.2em 0.5em';
      formatButton.style.cursor = 'pointer';
      formatButton.title = 'Click to edit format';
      formatButton.addEventListener('click', async () => {
        try {
          const useExternal = import.meta.env.VITE_USE_EXTERNAL_MATCHUP_FORMAT === 'true';
          console.log('[DialPad] Format button clicked, useExternal:', useExternal);
          
          let getMatchUpFormat;
          if (useExternal) {
            const module = await import('courthive-components');
            getMatchUpFormat = module.getMatchUpFormatModal;
          } else {
            const module = await import('components/modals/matchUpFormat/matchUpFormat');
            getMatchUpFormat = module.getMatchUpFormat;
          }
          
          console.log('[DialPad] getMatchUpFormat loaded:', typeof getMatchUpFormat);
          getMatchUpFormat({
          existingMatchUpFormat: matchUp.matchUpFormat,
          callback: (newFormat: string) => {
            console.log('[DialPad] Format selector callback - old:', matchUp.matchUpFormat, 'new:', newFormat);
            if (newFormat && newFormat !== matchUp.matchUpFormat) {
              console.log('[DialPad] Format changed - re-rendering');
              matchUp.matchUpFormat = newFormat;
              formatButton.textContent = newFormat;

              // Clear state
              state.digits = '';

              container.innerHTML = '';
              renderDialPadScoreEntry({ matchUp, container, onScoreChange });
            } else {
              console.log('[DialPad] Format unchanged or invalid');
            }
          },
          config: {
            style: {
              border: '3px solid #0066cc',
              borderRadius: '8px',
            },
          },
        } as any);
        } catch (error) {
          console.error('[DialPad] Error opening format selector:', error);
        }
      });
      formatDisplay.appendChild(formatButton);
      container.appendChild(formatDisplay);
    }

    // Score display (light blue)
    const scoreDisplay = document.createElement('div');
    scoreDisplay.style.fontSize = '2em';
    scoreDisplay.style.color = '#64B5F6';
    scoreDisplay.style.textAlign = 'center';
    scoreDisplay.style.padding = '0.25em 0.5em';
    scoreDisplay.style.fontWeight = 'bold';
    scoreDisplay.style.minHeight = '1.5em';
    scoreDisplay.style.maxWidth = '300px';
    scoreDisplay.style.margin = '0 auto';
    scoreDisplay.textContent = '-';
    container.appendChild(scoreDisplay);

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
      console.log('[DialPad] updateMatchUpDisplay called with outcome:', outcome);
      matchUpContainer.innerHTML = '';

      const displayMatchUp = {
        ...matchUp,
        score: outcome?.scoreObject || matchUp.score,
        winningSide: outcome?.winningSide,
        matchUpStatus: outcome?.matchUpStatus || matchUp.matchUpStatus,
      };

      console.log('[DialPad] Rendering matchUp with:', {
        score: displayMatchUp.score,
        winningSide: displayMatchUp.winningSide,
        matchUpStatus: displayMatchUp.matchUpStatus,
      });

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
        console.log('[DialPad] MatchUp element appended');
      } else {
        console.log('[DialPad] No matchUp element returned from renderMatchUp');
      }
    };

    // Update display
    const updateDisplay = () => {
      const scoreString = formatScore(state.digits);
      scoreDisplay.textContent = scoreString || '-';

      // Use validateScore for proper validation (like freeText does)
      const validation = validateScore(scoreString, matchUp.matchUpFormat);
      console.log('[DialPad] Validation result:', validation);

      // Update matchUp display with validation result
      updateMatchUpDisplay(validation);

      onScoreChange(validation);

      const clearBtn = document.getElementById('clearScoreV2') as HTMLButtonElement;
      if (clearBtn) clearBtn.disabled = state.digits.length === 0;
    };

    // Handle digit press
    const handleDigitPress = (digit: number | string) => {
      console.log('[DialPad] Key pressed:', digit, 'Current digits:', JSON.stringify(state.digits));

      const currentScoreString = formatScore(state.digits);
      console.log('[DialPad] Current score:', JSON.stringify(currentScoreString));

      // Check if we're in an incomplete tiebreak
      // A tiebreak is incomplete if:
      // 1. The formatted score has '(' but no ')', OR
      // 2. The raw digits contain a tiebreak sequence (6-7 followed by more digits) without a space separator
      // Since we can have unlimited tiebreak digits (e.g., 7(18-16)), we stay in tiebreak until minus/space is pressed
      const hasOpenTiebreak = currentScoreString.includes('(') && !currentScoreString.includes(')');
      const inTiebreak = hasOpenTiebreak;
      console.log('[DialPad] In tiebreak?', inTiebreak, 'hasOpenTiebreak:', hasOpenTiebreak);

      // For minus, we'll add a minus character
      const testDigits = digit === '-' ? state.digits + '-' : state.digits + digit.toString();
      console.log('[DialPad] Test digits:', JSON.stringify(testDigits));

      const testScoreString = formatScore(testDigits);
      console.log('[DialPad] Test score:', JSON.stringify(testScoreString));

      if (currentScoreString) {
        const currentValidation = validateScore(currentScoreString, matchUp.matchUpFormat);

        // Match is complete if validation shows a winningSide and is valid
        // BUT allow continuing if we're in the middle of entering a tiebreak score
        if (currentValidation.isValid && currentValidation.winningSide && !inTiebreak) {
          console.log('[DialPad] Match complete - blocking input');
          return;
        }

        // Block input if formatter didn't accept the digit (incomplete set)
        // Exception: allow if we're in a tiebreak or the test score is different (was accepted)
        if (!inTiebreak && digit !== '-' && testScoreString === currentScoreString) {
          console.log('[DialPad] Formatter rejected - blocking input');
          return;
        }
      }

      // For minus, add separator
      // Minus is used to: 1) close tiebreaks, 2) separate side1 from side2 in TB sets, 3) separate sets
      if (digit === '-') {
        console.log('[DialPad] Minus pressed - adding minus to digits');
        state.digits += '-';
      } else {
        state.digits += digit.toString();
      }

      console.log('[DialPad] After adding - digits:', JSON.stringify(state.digits));
      updateDisplay();
    };

    // Handle delete
    const handleDelete = () => {
      if (state.digits.length > 0) {
        state.digits = state.digits.slice(0, -1);
        updateDisplay();
      }
    };

    // Create dial pad buttons (4x3 grid)
    const buttons = [
      { label: '1', value: 1 },
      { label: '2', value: 2 },
      { label: '3', value: 3 },
      { label: 'RET', value: 'retired', isSpecial: true },
      { label: '4', value: 4 },
      { label: '5', value: 5 },
      { label: '6', value: 6 },
      { label: 'WO', value: 'walkover', isSpecial: true },
      { label: '7', value: 7 },
      { label: '8', value: 8 },
      { label: '9', value: 9 },
      { label: 'DEF', value: 'defaulted', isSpecial: true },
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

      // Disable and hide empty button
      if (btn.disabled) {
        button.disabled = true;
        button.style.visibility = 'hidden';
      }

      button.onclick = () => {
        if (btn.value === 'delete') {
          handleDelete();
        } else if (btn.value === 'minus') {
          handleDigitPress('-');
        } else if (btn.value === 'retired' || btn.value === 'walkover' || btn.value === 'defaulted') {
          // TODO: Handle irregular endings
          console.log('[DialPad] Irregular ending:', btn.value);
        } else if (btn.value === 'empty') {
          // Empty placeholder - do nothing
        } else {
          handleDigitPress(btn.value as number);
        }
      };

      dialPadContainer.appendChild(button);
    });

    // Keyboard support
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(Number.parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === '-') {
        e.preventDefault();
        handleDigitPress('-');
      } else if (e.key === ')' || e.key === ' ') {
        // Accept ')' or space to close tiebreak and move to next set
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

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    const cleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
    };

    (window as any).cleanupDialPad = cleanup;

    // Initial display
    updateMatchUpDisplay(null);
    updateDisplay();
  } catch (error) {
    console.error('Error rendering dial pad:', error);
    container.innerHTML = `<p style="color: red;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>`;
  }
}

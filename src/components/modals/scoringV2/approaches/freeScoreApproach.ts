/**
 * FreeScore approach - interactive parsing with known format
 * Single input field with real-time validation using freeScore parser
 */
import { renderMatchUp } from 'courthive-components';
import { parseScore } from '../../../../tools/freeScore/freeScore';
import { validateScore } from '../utils/scoreValidator';
import { formatExistingScore } from '../utils/scoreFormatters';
import type { RenderScoreEntryParams } from '../types';
import { env } from 'settings/env';
import { matchUpStatusConstants } from 'tods-competition-factory';

const { RETIRED, WALKOVER, DEFAULTED, SUSPENDED, CANCELLED, INCOMPLETE, DEAD_RUBBER, IN_PROGRESS, AWAITING_RESULT } =
  matchUpStatusConstants;

export function renderFreeScoreEntry(params: RenderScoreEntryParams): void {
  const { matchUp, container, onScoreChange } = params;

  // Clear container
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '1em';

  const scaleAttributes = env.scales[env.activeScale];
  const side1 = matchUp?.sides?.find((s: any) => s.sideNumber === 1);
  const side2 = matchUp?.sides?.find((s: any) => s.sideNumber === 2);

  // MatchUp display container (will be updated dynamically)
  const matchUpContainer = document.createElement('div');
  matchUpContainer.style.marginBottom = '0.25em'; // Reduced from 0.5em
  container.appendChild(matchUpContainer);

  // Radio buttons container (for irregular endings)
  const radioContainer = document.createElement('div');
  radioContainer.style.display = 'none'; // Hidden by default
  radioContainer.style.marginTop = '0.25em';
  radioContainer.style.padding = '0.35em 0.5em'; // Reduced vertical padding
  radioContainer.style.backgroundColor = '#f5f5f5';
  radioContainer.style.borderRadius = '4px';
  radioContainer.style.flexDirection = 'column';
  radioContainer.style.gap = '0.35em'; // Reduced from 0.5em

  const side1RadioLabel = document.createElement('label');
  side1RadioLabel.style.display = 'flex';
  side1RadioLabel.style.alignItems = 'center';
  side1RadioLabel.style.gap = '0.4em'; // Reduced from 0.5em
  side1RadioLabel.style.cursor = 'pointer';

  const side1Radio = document.createElement('input');
  side1Radio.type = 'radio';
  side1Radio.name = 'winnerSelection';
  side1Radio.value = '1';

  const side1RadioText = document.createElement('span');
  side1RadioText.textContent = side1?.participant?.participantName || 'Side 1';
  side1RadioText.style.fontSize = '0.75em'; // Reduced from 0.85em

  side1RadioLabel.appendChild(side1Radio);
  side1RadioLabel.appendChild(side1RadioText);

  const side2RadioLabel = document.createElement('label');
  side2RadioLabel.style.display = 'flex';
  side2RadioLabel.style.alignItems = 'center';
  side2RadioLabel.style.gap = '0.4em'; // Reduced from 0.5em
  side2RadioLabel.style.cursor = 'pointer';

  const side2Radio = document.createElement('input');
  side2Radio.type = 'radio';
  side2Radio.name = 'winnerSelection';
  side2Radio.value = '2';

  const side2RadioText = document.createElement('span');
  side2RadioText.textContent = side2?.participant?.participantName || 'Side 2';
  side2RadioText.style.fontSize = '0.75em'; // Reduced from 0.85em

  side2RadioLabel.appendChild(side2Radio);
  side2RadioLabel.appendChild(side2RadioText);

  radioContainer.appendChild(side1RadioLabel);
  radioContainer.appendChild(side2RadioLabel);
  container.appendChild(radioContainer);

  // Function to render/update the matchUp display
  const updateMatchUpDisplay = (currentScore?: {
    scoreObject?: any;
    winningSide?: number;
    matchUpStatus?: string;
    clearAll?: boolean;
  }) => {
    // For WALKOVER/CANCELLED/DEAD_RUBBER, score should be cleared
    const { WALKOVER, CANCELLED, DEAD_RUBBER } = matchUpStatusConstants;
    const scoresRemovedStatuses = [WALKOVER, CANCELLED, DEAD_RUBBER];
    const shouldClearScore = currentScore?.matchUpStatus && scoresRemovedStatuses.includes(currentScore.matchUpStatus);

    // Determine the score to display
    let displayScore: any;
    if (currentScore?.clearAll) {
      displayScore = undefined;
    } else if (shouldClearScore) {
      displayScore = undefined;
    } else {
      displayScore = currentScore?.scoreObject || matchUp.score;
    }

    // Create a copy of matchUp with current score
    const displayMatchUp = {
      ...matchUp,
      score: displayScore,
      winningSide: currentScore?.clearAll ? undefined : currentScore?.winningSide,
      matchUpStatus: currentScore?.clearAll ? undefined : currentScore?.matchUpStatus || matchUp.matchUpStatus,
    };

    // Clear and render
    matchUpContainer.innerHTML = '';
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
    matchUpContainer.appendChild(matchUpElement);
  };

  // Initial render
  updateMatchUpDisplay();

  // Match format info (clickable to edit)
  if (matchUp.matchUpFormat) {
    const formatInfo = document.createElement('div');
    formatInfo.style.fontSize = '0.9em';
    formatInfo.style.marginBottom = '0.5em';
    formatInfo.style.display = 'flex';
    formatInfo.style.alignItems = 'center';
    formatInfo.style.gap = '0.5em';

    const formatLabel = document.createElement('span');
    formatLabel.textContent = 'Format:';
    formatLabel.style.color = '#666';
    formatInfo.appendChild(formatLabel);

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
              // Format changed - update matchUp and clear score
              matchUp.matchUpFormat = newFormat;
              formatButton.textContent = newFormat;

              // Clear the score input
              const input = document.getElementById('scoreInputV2') as HTMLInputElement;
              if (input) {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
              }

              // Update validation message
              validationMessage.textContent = 'Score cleared - format changed';
              validationMessage.style.color = '#999';
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
        console.error('[FreeScore] Error opening format selector:', error);
      }
    });
    formatInfo.appendChild(formatButton);

    container.appendChild(formatInfo);
  }

  // Instructions
  const instructions = document.createElement('div');
  instructions.style.fontSize = '0.9em';
  instructions.style.color = '#666';
  instructions.style.marginBottom = '0.5em';
  instructions.innerHTML =
    '<small style="color: #999;">Tiebreaks auto-detected: "67 3" → "6-7(3)".<br> Match tiebreaks use dash: "10-7".<br> Irregular: r/w/s/c/a (ret/wo/def/susp/canc/await) or "in"/"inc"/"dr".</small>';
  container.appendChild(instructions);

  // Score input
  const inputWrapper = document.createElement('div');
  inputWrapper.style.display = 'flex';
  inputWrapper.style.alignItems = 'center';
  inputWrapper.style.gap = '0.5em';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input';
  input.placeholder = '6-3 3-6 6-4';
  input.style.flex = '1';
  input.id = 'scoreInputV2';

  // Initialize with existing score if available
  if (matchUp.score) {
    const existingScore = formatExistingScore(matchUp.score, matchUp.matchUpStatus);
    input.value = existingScore;
  }

  // Validation indicator
  const indicator = document.createElement('span');
  indicator.style.fontSize = '1.2em';
  indicator.style.minWidth = '1.5em';

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(indicator);
  container.appendChild(inputWrapper);

  // Formatted score display (non-editable)
  const formattedDisplay = document.createElement('div');
  formattedDisplay.style.fontSize = '0.9em';
  formattedDisplay.style.color = '#0066cc';
  formattedDisplay.style.fontFamily = 'monospace';
  formattedDisplay.style.minHeight = '1.5em';
  formattedDisplay.style.padding = '0.25em';
  container.appendChild(formattedDisplay);

  // Validation message
  const validationMessage = document.createElement('div');
  validationMessage.style.fontSize = '0.9em';
  validationMessage.style.minHeight = '1.5em';
  container.appendChild(validationMessage);

  // Track manual winner selection
  let manualWinningSide: number | undefined = matchUp.winningSide; // Initialize with existing winner

  const handleWinnerSelection = () => {
    if (side1Radio.checked) {
      manualWinningSide = 1;
      // Highlight selected
      side1RadioLabel.style.fontWeight = 'bold';
      side1RadioLabel.style.color = '#22c55e';
      side2RadioLabel.style.fontWeight = '';
      side2RadioLabel.style.color = '';
    } else if (side2Radio.checked) {
      manualWinningSide = 2;
      // Highlight selected
      side2RadioLabel.style.fontWeight = 'bold';
      side2RadioLabel.style.color = '#22c55e';
      side1RadioLabel.style.fontWeight = '';
      side1RadioLabel.style.color = '';
    }
    // Re-trigger validation with new winner
    handleInput();
  };

  side1Radio.addEventListener('change', handleWinnerSelection);
  side2Radio.addEventListener('change', handleWinnerSelection);

  // Validation handler
  const handleInput = () => {
    const scoreString = input.value.trim();

    if (!scoreString) {
      indicator.textContent = '';
      formattedDisplay.textContent = '';
      validationMessage.textContent = '';
      validationMessage.style.color = '';
      // Hide radio buttons
      radioContainer.style.display = 'none';
      side1Radio.checked = false;
      side2Radio.checked = false;
      side1RadioLabel.style.fontWeight = '';
      side1RadioLabel.style.color = '';
      side2RadioLabel.style.fontWeight = '';
      side2RadioLabel.style.color = '';
      manualWinningSide = undefined;
      // Reset matchUp display - clear score and winningSide
      updateMatchUpDisplay({ clearAll: true });
      onScoreChange({ isValid: false, sets: [] });
      return;
    }

    // Use freeScore parser - it returns ParseResult with all needed data
    const parseResult = parseScore(scoreString, matchUp.matchUpFormat);

    // Show formatted score if available
    if (parseResult.formattedScore) {
      formattedDisplay.textContent = parseResult.formattedScore;
    } else {
      formattedDisplay.textContent = '';
    }

    // Check if irregular ending from parser
    const isIrregularEnding =
      parseResult.matchUpStatus &&
      [
        RETIRED,
        WALKOVER,
        DEFAULTED,
        SUSPENDED,
        CANCELLED,
        INCOMPLETE,
        DEAD_RUBBER,
        IN_PROGRESS,
        AWAITING_RESULT,
      ].includes(parseResult.matchUpStatus);

    // CRITICAL: Validate the formatted score using factory validation
    // This ensures "6-5" is rejected for SET3-S:6/TB7 format
    const result = parseResult.formattedScore
      ? validateScore(parseResult.formattedScore, matchUp.matchUpFormat, parseResult.matchUpStatus)
      : { isValid: false, sets: [], error: 'No score to validate' };

    // Always update matchUp display if we have validated sets OR irregular ending
    const hasSets = result.sets && result.sets.length > 0;

    // PROGRESSIVE RENDERING: Update matchUp display immediately with validated scoreObject
    // Also update for irregular endings (like WALKOVER) even without sets
    // Use manualWinningSide if available (for irregular endings), otherwise use validated result
    const displayWinningSide = manualWinningSide || result.winningSide;

    if (hasSets && result.scoreObject) {
      updateMatchUpDisplay({
        scoreObject: result.scoreObject,
        winningSide: displayWinningSide,
        matchUpStatus: result.matchUpStatus || parseResult.matchUpStatus,
      });
    } else if (isIrregularEnding) {
      // For irregular endings without sets (WALKOVER, CANCELLED, DEAD_RUBBER), update with status
      updateMatchUpDisplay({
        scoreObject: result.scoreObject, // May be undefined for WALKOVER
        winningSide: displayWinningSide,
        matchUpStatus: result.matchUpStatus || parseResult.matchUpStatus,
      });
    }

    // Check if score is complete and valid
    const isComplete = result.isValid || isIrregularEnding;

    // For complete scores (or irregular endings), show green checkmark
    if (isComplete) {
      indicator.textContent = '✓';
      indicator.style.color = 'green';

      // Show match status
      let statusText = 'Valid score';
      if (result.matchUpStatus === RETIRED) {
        statusText = 'Valid score - RETIRED';
      } else if (result.matchUpStatus === WALKOVER) {
        statusText = 'Valid score - WALKOVER';
      } else if (result.matchUpStatus === DEFAULTED) {
        statusText = 'Valid score - DEFAULTED';
      } else if (result.matchUpStatus === SUSPENDED) {
        statusText = 'Valid score - SUSPENDED';
      } else if (result.matchUpStatus === CANCELLED) {
        statusText = 'Valid score - CANCELLED';
      } else if (result.matchUpStatus === INCOMPLETE) {
        statusText = 'Valid score - INCOMPLETE';
      } else if (result.matchUpStatus === DEAD_RUBBER) {
        statusText = 'Valid score - DEAD RUBBER';
      } else if (result.matchUpStatus === IN_PROGRESS) {
        statusText = 'Valid score - IN PROGRESS';
      } else if (result.matchUpStatus === AWAITING_RESULT) {
        statusText = 'Valid score - AWAITING RESULT';
      }
      validationMessage.textContent = statusText;
      validationMessage.style.color = 'green';

      // Determine winner
      let effectiveWinningSide: number | undefined;

      // Categorize irregular endings: some require winner selection, others don't
      const requiresWinnerSelection =
        isIrregularEnding && [RETIRED, WALKOVER, DEFAULTED].includes(result.matchUpStatus || parseResult.matchUpStatus);

      const noWinnerNeeded =
        isIrregularEnding &&
        [CANCELLED, DEAD_RUBBER, AWAITING_RESULT, INCOMPLETE, IN_PROGRESS, SUSPENDED].includes(
          result.matchUpStatus || parseResult.matchUpStatus,
        );

      if (requiresWinnerSelection) {
        // Show radio buttons for irregular endings that require winner
        radioContainer.style.display = 'flex';

        // Use manual selection
        effectiveWinningSide = manualWinningSide;

        if (!effectiveWinningSide) {
          // Invalid until winner selected (matchUp already rendered above)
          onScoreChange({
            ...result,
            isValid: false,
            error: 'Winner must be selected for irregular ending',
            matchUpStatus: result.matchUpStatus || parseResult.matchUpStatus,
            score: parseResult.formattedScore || scoreString,
          });
          return;
        }
      } else if (noWinnerNeeded) {
        // Hide radio buttons - no winner needed for these statuses
        radioContainer.style.display = 'none';
        side1Radio.checked = false;
        side2Radio.checked = false;
        side1RadioLabel.style.fontWeight = '';
        side1RadioLabel.style.color = '';
        side2RadioLabel.style.fontWeight = '';
        side2RadioLabel.style.color = '';
        manualWinningSide = undefined;

        // No winningSide for these statuses
        effectiveWinningSide = undefined;
      } else {
        // Hide radio buttons for normal completion
        radioContainer.style.display = 'none';
        side1Radio.checked = false;
        side2Radio.checked = false;
        side1RadioLabel.style.fontWeight = '';
        side1RadioLabel.style.color = '';
        side2RadioLabel.style.fontWeight = '';
        side2RadioLabel.style.color = '';
        manualWinningSide = undefined;

        // Use winner from validated result
        effectiveWinningSide = result.winningSide;
      }

      // MatchUp already rendered above, pass validated result with effective winner
      onScoreChange({
        ...result,
        isValid: true,
        winningSide: effectiveWinningSide,
        matchUpStatus: result.matchUpStatus || parseResult.matchUpStatus,
        score: parseResult.formattedScore || scoreString,
      });
    } else if (!result.isValid && hasSets) {
      // Has validated sets but incomplete - show orange indicator
      indicator.textContent = '⋯';
      indicator.style.color = 'orange';
      validationMessage.textContent = result.error || 'Score incomplete - continue typing';
      validationMessage.style.color = 'orange';

      // Hide radio buttons for incomplete scores
      radioContainer.style.display = 'none';
      side1Radio.checked = false;
      side2Radio.checked = false;
      side1RadioLabel.style.fontWeight = '';
      side1RadioLabel.style.color = '';
      side2RadioLabel.style.fontWeight = '';
      side2RadioLabel.style.color = '';
      manualWinningSide = undefined;

      // Not valid for submission yet
      onScoreChange(result);
    } else {
      // No valid sets at all - show error
      indicator.textContent = '✗';
      indicator.style.color = 'red';
      validationMessage.textContent = result.error || 'Invalid score';
      validationMessage.style.color = 'red';
      // Hide radio buttons
      radioContainer.style.display = 'none';
      side1Radio.checked = false;
      side2Radio.checked = false;
      side1RadioLabel.style.fontWeight = '';
      side1RadioLabel.style.color = '';
      side2RadioLabel.style.fontWeight = '';
      side2RadioLabel.style.color = '';
      manualWinningSide = undefined;
      // Reset matchUp display
      updateMatchUpDisplay();

      onScoreChange(result);
    }
  };

  // Attach listeners
  input.addEventListener('input', handleInput);
  input.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      const submitBtn = document.getElementById('submitScoreV2') as HTMLButtonElement;
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
      }
    }
  });

  // Initialize radio buttons with existing winner if present
  if (matchUp.winningSide === 1) {
    side1Radio.checked = true;
    side1RadioLabel.style.fontWeight = 'bold';
    side1RadioLabel.style.color = '#22c55e';
  } else if (matchUp.winningSide === 2) {
    side2Radio.checked = true;
    side2RadioLabel.style.fontWeight = 'bold';
    side2RadioLabel.style.color = '#22c55e';
  }

  // Focus input and trigger validation if there's an existing score
  setTimeout(() => {
    input.focus();
    if (input.value) {
      handleInput(); // Trigger validation for pre-populated score
    }
  }, 100);
}

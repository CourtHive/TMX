/**
 * Free text score entry approach
 * Single input field with real-time validation
 */
import { renderMatchUp } from 'courthive-components';
import { validateScore, tidyScore } from '../utils/scoreValidator';
import type { RenderScoreEntryParams } from '../types';
import { env } from 'settings/env';

export function renderFreeTextScoreEntry(params: RenderScoreEntryParams): void {
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
  matchUpContainer.style.marginBottom = '0.5em';
  container.appendChild(matchUpContainer);

  // Radio buttons container (for irregular endings)
  const radioContainer = document.createElement('div');
  radioContainer.style.display = 'none'; // Hidden by default
  radioContainer.style.marginTop = '0.25em';
  radioContainer.style.padding = '0.5em';
  radioContainer.style.backgroundColor = '#f5f5f5';
  radioContainer.style.borderRadius = '4px';
  radioContainer.style.flexDirection = 'row';
  radioContainer.style.gap = '1em';
  radioContainer.style.justifyContent = 'center';
  
  const side1RadioLabel = document.createElement('label');
  side1RadioLabel.style.display = 'flex';
  side1RadioLabel.style.alignItems = 'center';
  side1RadioLabel.style.gap = '0.5em';
  side1RadioLabel.style.cursor = 'pointer';
  
  const side1Radio = document.createElement('input');
  side1Radio.type = 'radio';
  side1Radio.name = 'winnerSelection';
  side1Radio.value = '1';
  
  const side1RadioText = document.createElement('span');
  side1RadioText.textContent = side1?.participant?.participantName || 'Side 1';
  
  side1RadioLabel.appendChild(side1Radio);
  side1RadioLabel.appendChild(side1RadioText);
  
  const side2RadioLabel = document.createElement('label');
  side2RadioLabel.style.display = 'flex';
  side2RadioLabel.style.alignItems = 'center';
  side2RadioLabel.style.gap = '0.5em';
  side2RadioLabel.style.cursor = 'pointer';
  
  const side2Radio = document.createElement('input');
  side2Radio.type = 'radio';
  side2Radio.name = 'winnerSelection';
  side2Radio.value = '2';
  
  const side2RadioText = document.createElement('span');
  side2RadioText.textContent = side2?.participant?.participantName || 'Side 2';
  
  side2RadioLabel.appendChild(side2Radio);
  side2RadioLabel.appendChild(side2RadioText);
  
  radioContainer.appendChild(side1RadioLabel);
  radioContainer.appendChild(side2RadioLabel);
  container.appendChild(radioContainer);

  // Function to render/update the matchUp display
  const updateMatchUpDisplay = (currentScore?: { scoreObject?: any; winningSide?: number; matchUpStatus?: string }) => {
    // Create a copy of matchUp with current score
    const displayMatchUp = {
      ...matchUp,
      score: currentScore?.scoreObject || matchUp.score,
      winningSide: currentScore?.winningSide,
      matchUpStatus: currentScore?.matchUpStatus || matchUp.matchUpStatus,
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
    formatButton.style.fontSize = '0.9em';
    formatButton.style.padding = '0.2em 0.5em';
    formatButton.style.cursor = 'pointer';
    formatButton.title = 'Click to edit format';
    formatButton.addEventListener('click', async () => {
      try {
        const useExternal = import.meta.env.VITE_USE_EXTERNAL_MATCHUP_FORMAT === 'true';
        
        let getMatchUpFormat;
        if (useExternal) {
          const module = await import('courthive-components');
          getMatchUpFormat = module.getMatchUpFormatModal;
        } else {
          const module = await import('components/modals/matchUpFormat/matchUpFormat');
          getMatchUpFormat = module.getMatchUpFormat;
        }
        
        getMatchUpFormat({
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
          }
        }
      } as any);
      } catch (error) {
        console.error('[FreeText] Error opening format selector:', error);
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
    'Enter score (e.g., 6-3 6-4)<br>' +
    '<small style="color: #999;">For irregular endings, add RET/WO/DEF at end, then select winner</small>';
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

  // Validation indicator
  const indicator = document.createElement('span');
  indicator.style.fontSize = '1.2em';
  indicator.style.minWidth = '1.5em';

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(indicator);
  container.appendChild(inputWrapper);

  // Tidy score display (non-editable)
  const tidyDisplay = document.createElement('div');
  tidyDisplay.style.fontSize = '0.9em';
  tidyDisplay.style.color = '#0066cc';
  tidyDisplay.style.fontFamily = 'monospace';
  tidyDisplay.style.minHeight = '1.5em';
  tidyDisplay.style.padding = '0.25em';
  container.appendChild(tidyDisplay);

  // Validation message
  const validationMessage = document.createElement('div');
  validationMessage.style.fontSize = '0.9em';
  validationMessage.style.minHeight = '1.5em';
  container.appendChild(validationMessage);

  // Winner display
  const winnerDisplay = document.createElement('div');
  winnerDisplay.style.fontSize = '0.95em';
  winnerDisplay.style.fontWeight = 'bold';
  winnerDisplay.style.minHeight = '1.5em';
  container.appendChild(winnerDisplay);

  // Track manual winner selection
  let manualWinningSide: number | undefined = undefined;

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
      tidyDisplay.textContent = '';
      validationMessage.textContent = '';
      validationMessage.style.color = '';
      winnerDisplay.textContent = '';
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
      onScoreChange({ isValid: false, sets: [] });
      return;
    }

    // Step 1: Tidy the score (clean up formatting)
    const tidyResult = tidyScore(scoreString);

    if (tidyResult.error) {
      indicator.textContent = '✗';
      indicator.style.color = 'red';
      tidyDisplay.textContent = '';
      validationMessage.textContent = tidyResult.error;
      validationMessage.style.color = 'red';
      winnerDisplay.textContent = '';
      // Hide radio buttons
      radioContainer.style.display = 'none';
      side1Radio.checked = false;
      side2Radio.checked = false;
      side1RadioLabel.style.fontWeight = '';
      side1RadioLabel.style.color = '';
      side2RadioLabel.style.fontWeight = '';
      side2RadioLabel.style.color = '';
      manualWinningSide = undefined;
      onScoreChange({ isValid: false, sets: [], error: tidyResult.error });
      return;
    }

    // Always show tidied score in blue
    if (tidyResult.tidyScore) {
      tidyDisplay.textContent = tidyResult.tidyScore;
    } else {
      tidyDisplay.textContent = '';
    }

    // Check if irregular ending from tidyScore
    const isIrregularEnding = ['RETIRED', 'WALKOVER', 'DEFAULTED'].includes(tidyResult.matchUpStatus || '');

    // Step 2: Validate the tidied score (pass matchUpStatus for irregular ending handling)
    const result = validateScore(
      tidyResult.tidyScore || scoreString,
      matchUp.matchUpFormat,
      tidyResult.matchUpStatus,
    );

    // For irregular endings, we accept partial scores
    if (isIrregularEnding || result.isValid) {
      indicator.textContent = '✓';
      indicator.style.color = 'green';

      // Show match status
      let statusText = 'Valid score';
      if (tidyResult.matchUpStatus === 'RETIRED') {
        statusText = 'Valid score - RETIRED';
      } else if (tidyResult.matchUpStatus === 'WALKOVER') {
        statusText = 'Valid score - WALKOVER';
      } else if (tidyResult.matchUpStatus === 'DEFAULTED') {
        statusText = 'Valid score - DEFAULTED';
      }
      validationMessage.textContent = statusText;
      validationMessage.style.color = 'green';

      // Determine winner
      let effectiveWinningSide: number | undefined;

      if (isIrregularEnding) {
        // Show radio buttons for irregular endings
        radioContainer.style.display = 'flex';

        // Use manual selection
        effectiveWinningSide = manualWinningSide;

        if (!effectiveWinningSide) {
          winnerDisplay.textContent = 'Select winner above';
          winnerDisplay.style.color = 'orange';
          // Update matchUp display with current score but no winner
          updateMatchUpDisplay({
            scoreObject: result.scoreObject,
            matchUpStatus: tidyResult.matchUpStatus,
          });
          // Invalid until winner selected
          onScoreChange({
            ...result,
            isValid: false,
            error: 'Winner must be selected for irregular ending',
            matchUpStatus: tidyResult.matchUpStatus,
            score: tidyResult.tidyScore || scoreString,
          });
          return;
        }
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

        // Use calculated winner from validateScore
        effectiveWinningSide = result.winningSide;
      }

      // Show winner
      if (effectiveWinningSide) {
        const winnerSide = matchUp.sides?.find((s: any) => s.sideNumber === effectiveWinningSide);
        const winnerName = winnerSide?.participant?.participantName || `Side ${effectiveWinningSide}`;
        winnerDisplay.textContent = `Winner: ${winnerName}`;
        winnerDisplay.style.color = 'green';
      } else {
        winnerDisplay.textContent = '';
      }

      // Update matchUp display with current score and winner
      updateMatchUpDisplay({
        scoreObject: result.scoreObject,
        winningSide: effectiveWinningSide,
        matchUpStatus: tidyResult.matchUpStatus || result.matchUpStatus,
      });

      // Pass the result with effective winner and matchUpStatus from tidyScore
      onScoreChange({
        ...result,
        isValid: true,
        winningSide: effectiveWinningSide,
        matchUpStatus: tidyResult.matchUpStatus || result.matchUpStatus,
        score: tidyResult.tidyScore || scoreString,
      });
    } else {
      indicator.textContent = '✗';
      indicator.style.color = 'red';
      validationMessage.textContent = result.error || 'Invalid score';
      validationMessage.style.color = 'red';
      winnerDisplay.textContent = '';
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

  // Focus input
  setTimeout(() => input.focus(), 100);

  // Pre-fill with existing score if available
  if (matchUp.score?.sets && matchUp.score.sets.length > 0) {
    const existingScore = matchUp.score.sets
      .map((set: any) => `${set.side1Score || 0}-${set.side2Score || 0}`)
      .join(' ');
    input.value = existingScore;
    handleInput();
  }
}

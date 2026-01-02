/**
 * Dynamic Sets score entry approach
 * Individual set inputs with hotkey navigation and real-time validation
 */
import { renderMatchUp } from 'courthive-components';
import { validateSetScores } from '../utils/scoreValidator';
import { parseMatchUpFormat, shouldExpandSets } from '../utils/setExpansionLogic';
import type { RenderScoreEntryParams, SetScore } from '../types';
import { env } from 'settings/env';
import { matchUpFormatCode } from 'tods-competition-factory';

export function renderDynamicSetsScoreEntry(params: RenderScoreEntryParams): void {
  const { matchUp, container, onScoreChange } = params;

  // Clear container
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '1em';

  const scaleAttributes = env.scales[env.activeScale];

  // Parse match format
  const formatInfo = parseMatchUpFormat(matchUp.matchUpFormat || 'SET3-S:6/TB7');
  const { bestOf } = formatInfo;
  const parsedFormat = matchUpFormatCode.parse(matchUp.matchUpFormat || 'SET3-S:6/TB7');
  
  // For tiebreak-only sets (SET1-S:TB10), setTo comes from tiebreakSet.tiebreakTo
  const tiebreakSetTo = parsedFormat?.setFormat?.tiebreakSet?.tiebreakTo;
  const regularSetTo = parsedFormat?.setFormat?.setTo;
  
  const setTo = tiebreakSetTo || regularSetTo || 6;
  const maxGameScore = setTo + 1; // e.g., 7 for standard sets, 11 for TB10

  // MatchUp display container
  const matchUpContainer = document.createElement('div');
  matchUpContainer.style.marginBottom = '0.5em';
  container.appendChild(matchUpContainer);

  // Match format info (clickable to edit)
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
            // Format changed - update matchUp and reset everything
            matchUp.matchUpFormat = newFormat;
            formatButton.textContent = newFormat;
            
            // Clear all sets and reset
            if ((window as any).resetDynamicSets) {
              (window as any).resetDynamicSets();
            }
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
        console.error('[DynamicSets] Error opening format selector:', error);
      }
    });
    formatDisplay.appendChild(formatButton);
    
    container.appendChild(formatDisplay);
  }
  
  // Irregular ending selector
  let selectedOutcome: 'COMPLETED' | 'RETIRED' | 'WALKOVER' | 'DEFAULTED' = 'COMPLETED';
  let selectedWinner: number | undefined = undefined; // For irregular endings
  
  const irregularEndingContainer = document.createElement('div');
  irregularEndingContainer.style.marginBottom = '0.8em';
  
  const irregularLabel = document.createElement('div');
  irregularLabel.textContent = 'Irregular Ending:';
  irregularLabel.style.fontSize = '0.75em';
  irregularLabel.style.fontWeight = '500';
  irregularLabel.style.marginBottom = '0.3em';
  irregularLabel.style.color = '#444';
  irregularEndingContainer.appendChild(irregularLabel);
  
  const outcomeOptions = document.createElement('div');
  outcomeOptions.style.display = 'flex';
  outcomeOptions.style.gap = '0.5em';
  outcomeOptions.style.flexWrap = 'wrap';
  
  // Only irregular endings - Completed is the default
  const outcomes = [
    { value: 'RETIRED', label: 'Retired' },
    { value: 'WALKOVER', label: 'Walkover' },
    { value: 'DEFAULTED', label: 'Defaulted' },
  ];
  
  outcomes.forEach(outcome => {
    const radioLabel = document.createElement('label');
    radioLabel.style.display = 'flex';
    radioLabel.style.alignItems = 'center';
    radioLabel.style.gap = '0.3em';
    radioLabel.style.cursor = 'pointer';
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'matchOutcome';
    radio.value = outcome.value;
    radio.checked = false; // None checked by default
    radio.addEventListener('change', (e) => {
      selectedOutcome = (e.target as HTMLInputElement).value as any;
      
      // Clear all set inputs when WALKOVER is selected
      if (selectedOutcome === 'WALKOVER') {
        // Clear all set inputs
        const allInputs = setsContainer.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
        allInputs.forEach(input => {
          input.value = '';
        });
        
        // Remove all set rows except the first one
        const allSetRows = setsContainer.querySelectorAll('.set-row');
        for (let i = allSetRows.length - 1; i > 0; i--) {
          allSetRows[i].remove();
        }
        
        // Reset currentSets
        currentSets = [];
      }
      
      // Show winner selection when irregular ending selected
      winnerSelectionContainer.style.display = 'block';
      
      // Will call updateScoreFromInputs when it's defined
      setTimeout(() => {
        if (typeof updateScoreFromInputs === 'function') {
          updateScoreFromInputs();
        }
      }, 0);
    });
    
    const labelText = document.createElement('span');
    labelText.textContent = outcome.label;
    labelText.style.fontSize = '0.75em';
    
    radioLabel.appendChild(radio);
    radioLabel.appendChild(labelText);
    outcomeOptions.appendChild(radioLabel);
  });
  
  // Add "Clear" button to reset to COMPLETED
  const clearOutcomeBtn = document.createElement('button');
  clearOutcomeBtn.textContent = 'Clear';
  clearOutcomeBtn.className = 'button';
  clearOutcomeBtn.style.fontSize = '0.7em';
  clearOutcomeBtn.style.padding = '0.2em 0.5em';
  clearOutcomeBtn.addEventListener('click', () => {
    // Uncheck all radio buttons
    const radios = irregularEndingContainer.querySelectorAll('input[name="matchOutcome"]') as NodeListOf<HTMLInputElement>;
    radios.forEach(r => r.checked = false);
    
    // Reset to COMPLETED
    selectedOutcome = 'COMPLETED';
    selectedWinner = undefined;
    winnerSelectionContainer.style.display = 'none';
    
    // Clear winner selection
    const winnerRadios = irregularEndingContainer.querySelectorAll('input[name="irregularWinner"]') as NodeListOf<HTMLInputElement>;
    winnerRadios.forEach(r => r.checked = false);
    
    // Update validation
    setTimeout(() => {
      if (typeof updateScoreFromInputs === 'function') {
        updateScoreFromInputs();
      }
    }, 0);
  });
  
  outcomeOptions.appendChild(clearOutcomeBtn);
  irregularEndingContainer.appendChild(outcomeOptions);
  
  // Winner selection for irregular endings
  const winnerSelectionContainer = document.createElement('div');
  winnerSelectionContainer.style.display = 'none'; // Hidden by default
  winnerSelectionContainer.style.marginTop = '0.3em';
  winnerSelectionContainer.style.paddingLeft = '1em';
  winnerSelectionContainer.style.borderLeft = '3px solid #ffeb3b';
  
  const winnerLabel = document.createElement('div');
  winnerLabel.textContent = 'Winner:';
  winnerLabel.style.fontSize = '0.75em';
  winnerLabel.style.fontWeight = '500';
  winnerLabel.style.marginBottom = '0.2em';
  winnerLabel.style.color = '#444';
  winnerSelectionContainer.appendChild(winnerLabel);
  
  const winnerOptions = document.createElement('div');
  winnerOptions.style.display = 'flex';
  winnerOptions.style.gap = '0.5em';
  
  const side1 = matchUp.sides?.[0];
  const side2 = matchUp.sides?.[1];
  
  [1, 2].forEach(sideNum => {
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
      selectedWinner = sideNum;
      setTimeout(() => {
        if (typeof updateScoreFromInputs === 'function') {
          updateScoreFromInputs();
        }
      }, 0);
    });
    
    const winnerText = document.createElement('span');
    const side = sideNum === 1 ? side1 : side2;
    winnerText.textContent = side?.participant?.participantName || `Side ${sideNum}`;
    winnerText.style.fontSize = '0.75em';
    
    winnerRadioLabel.appendChild(winnerRadio);
    winnerRadioLabel.appendChild(winnerText);
    winnerOptions.appendChild(winnerRadioLabel);
  });
  
  winnerSelectionContainer.appendChild(winnerOptions);
  irregularEndingContainer.appendChild(winnerSelectionContainer);
  
  container.appendChild(irregularEndingContainer);

  // Sets container
  const setsContainer = document.createElement('div');
  setsContainer.style.display = 'flex';
  setsContainer.style.flexDirection = 'column';
  setsContainer.style.gap = '0.5em';
  container.appendChild(setsContainer);

  // Score state
  let currentSets: SetScore[] = [];

  // Function to reset all sets (for Clear button)
  const resetAllSets = () => {
    // Clear the container
    setsContainer.innerHTML = '';
    
    // Reset state
    currentSets = [];
    
    // Reset irregular ending
    selectedOutcome = 'COMPLETED';
    selectedWinner = undefined;
    
    // Uncheck all irregular ending radios
    const outcomeRadios = irregularEndingContainer.querySelectorAll('input[name="matchOutcome"]') as NodeListOf<HTMLInputElement>;
    outcomeRadios.forEach(r => r.checked = false);
    
    // Clear winner selection
    const winnerRadios = irregularEndingContainer.querySelectorAll('input[name="irregularWinner"]') as NodeListOf<HTMLInputElement>;
    winnerRadios.forEach(r => r.checked = false);
    
    // Hide winner selection container
    winnerSelectionContainer.style.display = 'none';
    
    // Add first set row
    const firstSetRow = createSetRow(0);
    setsContainer.appendChild(firstSetRow);
    
    // Attach event listeners
    const inputs = firstSetRow.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', handleInput);
      input.addEventListener('keydown', handleKeydown);
    });
    
    // Update display and validation
    updateMatchUpDisplay();
    onScoreChange({ isValid: false, sets: [] });
    
    // Focus first input
    const firstInput = setsContainer.querySelector('input') as HTMLInputElement;
    if (firstInput) firstInput.focus();
  };

  // Expose reset function for Clear button
  (window as any).resetDynamicSets = resetAllSets;

  // Function to render/update the matchUp display
  const updateMatchUpDisplay = (validationResult?: any) => {
    matchUpContainer.innerHTML = '';
    
    // Create temporary matchUp with current sets
    const displayMatchUp = {
      ...matchUp,
      score: validationResult?.scoreObject || (currentSets.length > 0 ? { sets: currentSets } : matchUp.score),
      winningSide: validationResult?.winningSide,
      matchUpStatus: validationResult?.matchUpStatus,
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
    matchUpContainer.appendChild(matchUpElement);
  };

  // Function to create a set input row
  const createSetRow = (setIndex: number): HTMLElement => {
    const setRow = document.createElement('div');
    setRow.className = 'set-row';
    setRow.style.display = 'flex';
    setRow.style.alignItems = 'center';
    setRow.style.gap = '0.5em';
    setRow.style.marginBottom = '0.25em';

    // Set label
    const setLabel = document.createElement('div');
    setLabel.textContent = `Set ${setIndex + 1}:`;
    setLabel.style.width = '3.5em';
    setLabel.style.fontSize = '0.9em';
    setLabel.style.fontWeight = '500';
    setLabel.style.color = '#444';
    setRow.appendChild(setLabel);

    // Side 1 input
    const side1Input = document.createElement('input');
    side1Input.type = 'text';
    side1Input.className = 'input';
    side1Input.style.width = '3em';
    side1Input.style.textAlign = 'center';
    side1Input.placeholder = '0';
    side1Input.dataset.setIndex = setIndex.toString();
    side1Input.dataset.side = '1';

    // Side 2 input
    const side2Input = document.createElement('input');
    side2Input.type = 'text';
    side2Input.className = 'input';
    side2Input.style.width = '3em';
    side2Input.style.textAlign = 'center';
    side2Input.placeholder = '0';
    side2Input.dataset.setIndex = setIndex.toString();
    side2Input.dataset.side = '2';

    // Dash separator
    const dash = document.createElement('span');
    dash.textContent = '-';
    dash.style.fontWeight = 'bold';
    dash.style.color = '#666';

    setRow.appendChild(side1Input);
    setRow.appendChild(dash);
    setRow.appendChild(side2Input);

    // Tiebreak inputs container (hidden by default)
    const tiebreakContainer = document.createElement('span');
    tiebreakContainer.className = 'tiebreak-container';
    tiebreakContainer.style.display = 'none';
    tiebreakContainer.style.marginLeft = '0.5em';

    const tiebreakOpen = document.createElement('span');
    tiebreakOpen.textContent = '(';
    tiebreakOpen.style.color = '#666';

    const tiebreakInput = document.createElement('input');
    tiebreakInput.type = 'text';
    tiebreakInput.className = 'input tiebreak-input';
    tiebreakInput.style.width = '2.5em';
    tiebreakInput.style.textAlign = 'center';
    tiebreakInput.dataset.setIndex = setIndex.toString();
    tiebreakInput.dataset.type = 'tiebreak';

    const tiebreakClose = document.createElement('span');
    tiebreakClose.textContent = ')';
    tiebreakClose.style.color = '#666';

    tiebreakContainer.appendChild(tiebreakOpen);
    tiebreakContainer.appendChild(tiebreakInput);
    tiebreakContainer.appendChild(tiebreakClose);

    setRow.appendChild(tiebreakContainer);

    // Validation indicator
    const indicator = document.createElement('span');
    indicator.className = 'set-indicator';
    indicator.style.fontSize = '1.2em';
    indicator.style.minWidth = '1.5em';
    setRow.appendChild(indicator);

    return setRow;
  };

  // Function to check if a set is complete (both inputs have values and there's a winner)
  const isSetComplete = (setIndex: number): boolean => {
    const side1Input = setsContainer.querySelector(`input[data-set-index="${setIndex}"][data-side="1"]`) as HTMLInputElement;
    const side2Input = setsContainer.querySelector(`input[data-set-index="${setIndex}"][data-side="2"]`) as HTMLInputElement;
    
    if (!side1Input || !side2Input) return false;
    
    const side1Value = side1Input.value.trim();
    const side2Value = side2Input.value.trim();
    
    // Both sides must have values
    if (side1Value === '' || side2Value === '') return false;
    
    const side1Score = parseInt(side1Value) || 0;
    const side2Score = parseInt(side2Value) || 0;
    
    // Scores can't be equal (tie is not complete)
    // For user input purposes, we consider a set "complete" if both sides entered and not tied
    // The factory validation will determine if it's a VALID score, but for tab navigation
    // we just need to know if the user has finished entering this set
    return side1Score !== side2Score;
  };

  // Function to update score from inputs
  const updateScoreFromInputs = () => {
    const newSets: SetScore[] = [];

    // Parse all set inputs
    for (let i = 0; i < bestOf; i++) {
      const side1Input = setsContainer.querySelector(`input[data-set-index="${i}"][data-side="1"]`) as HTMLInputElement;
      const side2Input = setsContainer.querySelector(`input[data-set-index="${i}"][data-side="2"]`) as HTMLInputElement;
      const tiebreakInput = setsContainer.querySelector(`input[data-set-index="${i}"][data-type="tiebreak"]`) as HTMLInputElement;

      if (!side1Input || !side2Input) break;

      const side1Value = side1Input.value.trim();
      const side2Value = side2Input.value.trim();

      // If both are empty, stop here
      if (side1Value === '' && side2Value === '') break;

      const side1Score = parseInt(side1Value) || 0;
      const side2Score = parseInt(side2Value) || 0;
      const tiebreakScore = tiebreakInput?.value.trim() ? parseInt(tiebreakInput.value) : undefined;

      // Determine winner - ONLY if both sides have been entered AND it's a valid winning score
      // Don't assign winner to incomplete sets (e.g., 5-? where second side is empty)
      // For tiebreak-only sets (TB10), don't assign winner until score reaches valid threshold
      let winningSide: number | undefined;
      if (side1Value !== '' && side2Value !== '') {
        // Both sides entered - determine winner based on score difference
        // For TB10, we pass scores to validation even if incomplete
        // The factory/validateSetScore will determine validity
        if (tiebreakSetTo) {
          // For tiebreak-only sets, always assign winningSide based on who has more points
          // Let validation determine if it's a valid winning score
          // This allows 1-10, 3-6, 11-13, etc. to show in display and be validated
          if (side1Score > side2Score) winningSide = 1;
          else if (side2Score > side1Score) winningSide = 2;
        } else {
          // Regular set - simple comparison
          if (side1Score > side2Score) winningSide = 1;
          else if (side2Score > side1Score) winningSide = 2;
          // If equal scores, winningSide stays undefined (tie - invalid but we store it)
        }
      }

      const setData: SetScore = {
        side1Score,
        side2Score,
        winningSide,
      };

      // Add tiebreak scores if present
      if (tiebreakScore !== undefined) {
        const loserScore = tiebreakScore;
        const tiebreakFormat = parsedFormat?.setFormat?.tiebreakFormat;
        const isNoAd = tiebreakFormat?.tiebreakTo && tiebreakFormat.noAd;
        const winnerScore = isNoAd ? loserScore + 1 : loserScore + 2;
        
        if (side1Score > side2Score) {
          setData.side1TiebreakScore = winnerScore;
          setData.side2TiebreakScore = loserScore;
        } else {
          setData.side1TiebreakScore = loserScore;
          setData.side2TiebreakScore = winnerScore;
        }
      }

      newSets.push(setData);
    }

    currentSets = newSets;

    // Remove empty trailing set rows if a prior set was cleared
    const allSetRows = setsContainer.querySelectorAll('.set-row');
    const lastSetWithData = currentSets.length;
    
    // Keep at least one set row, and keep one extra empty row if last set is complete
    const rowsToKeep = Math.max(1, lastSetWithData + 1);
    
    for (let i = allSetRows.length - 1; i >= rowsToKeep; i--) {
      allSetRows[i].remove();
    }

    // Validate and update display
    if (currentSets.length > 0 || selectedOutcome !== 'COMPLETED') {
      // Build sets data with tiebreak scores for validation
      // CRITICAL: Only include COMPLETE sets (where winningSide is defined)
      // Don't pass incomplete sets like "5-0" where 0 means "no entry yet"
      const completeSets = currentSets.filter(s => s.winningSide !== undefined);
      const setsForValidation = completeSets.map(s => ({
        side1: s.side1Score,
        side2: s.side2Score,
        side1TiebreakScore: s.side1TiebreakScore,
        side2TiebreakScore: s.side2TiebreakScore,
      }));
      
      const validation = validateSetScores(
        setsForValidation,
        matchUp.matchUpFormat,
        selectedOutcome !== 'COMPLETED', // Allow incomplete if irregular ending
      );

      // CRITICAL: Check if match is complete based on VALIDATION result, not raw currentSets
      // The validation may have stripped winningSide from invalid sets
      // So we need to check the validated outcome, not the raw input
      // For tiebreak-only sets (TB10), the factory won't return winningSide until the score
      // reaches the required threshold (e.g., 10-12 or 11-13), so 3-6 is incomplete
      const matchComplete = validation.isValid && validation.winningSide !== undefined;

      // Hide/show irregular ending based on validated match completion
      // CRITICAL: Always show irregular ending if an irregular outcome is selected
      // Otherwise hide it when match is complete
      if (selectedOutcome !== 'COMPLETED') {
        // Always show irregular ending when an irregular outcome is selected
        irregularEndingContainer.style.display = 'block';
        winnerSelectionContainer.style.display = 'block'; // Always show winner selection
      } else if (matchComplete) {
        // Hide irregular ending only when match is complete AND no irregular outcome selected
        irregularEndingContainer.style.display = 'none';
      } else {
        // Show irregular ending when match incomplete
        irregularEndingContainer.style.display = 'block';
      }

      // Add matchUpStatus and winningSide if irregular ending
      if (selectedOutcome !== 'COMPLETED') {
        validation.matchUpStatus = selectedOutcome;
        // Override winningSide if manually selected
        if (selectedWinner) {
          validation.winningSide = selectedWinner;
          // For irregular endings, valid if winner is selected
          validation.isValid = true;
        } else {
          // Need winner selection for irregular ending
          validation.isValid = false;
        }
      }

      // Update matchUp display with validation results
      updateMatchUpDisplay(validation);

      // Pass to parent
      onScoreChange(validation);
    } else {
      // Show irregular ending when no sets
      irregularEndingContainer.style.display = 'block';
      
      updateMatchUpDisplay();
      onScoreChange({ isValid: false, sets: [] });
    }
  };

  // Function to update clear button state
  const updateClearButtonState = () => {
    const clearBtn = document.getElementById('clearScoreV2') as HTMLButtonElement;
    if (clearBtn) {
      const allSetRows = setsContainer.querySelectorAll('.set-row');
      // Enable if more than one set row exists, or if first set has any values
      const firstSide1 = setsContainer.querySelector('input[data-set-index="0"][data-side="1"]') as HTMLInputElement;
      const firstSide2 = setsContainer.querySelector('input[data-set-index="0"][data-side="2"]') as HTMLInputElement;
      const hasContent = allSetRows.length > 1 || 
                        (firstSide1?.value.trim() !== '') || 
                        (firstSide2?.value.trim() !== '');
      clearBtn.disabled = !hasContent;
    }
  };

  // Function to show/hide tiebreak input based on score
  const updateTiebreakVisibility = (setIndex: number) => {
    const side1Input = setsContainer.querySelector(`input[data-set-index="${setIndex}"][data-side="1"]`) as HTMLInputElement;
    const side2Input = setsContainer.querySelector(`input[data-set-index="${setIndex}"][data-side="2"]`) as HTMLInputElement;
    const tiebreakContainer = setsContainer.querySelector(`.set-row:nth-child(${setIndex + 1}) .tiebreak-container`) as HTMLElement;
    const tiebreakInput = setsContainer.querySelector(`input[data-set-index="${setIndex}"][data-type="tiebreak"]`) as HTMLInputElement;
    
    if (!side1Input || !side2Input || !tiebreakContainer) return;
    
    const side1Score = parseInt(side1Input.value) || 0;
    const side2Score = parseInt(side2Input.value) || 0;
    
    // Show tiebreak input if score is 7-6 or 6-7
    const showTiebreak = (side1Score === 7 && side2Score === 6) || (side1Score === 6 && side2Score === 7);
    
    if (showTiebreak) {
      tiebreakContainer.style.display = 'inline';
      if (tiebreakInput && !tiebreakInput.value.trim()) {
        setTimeout(() => tiebreakInput.focus(), 50);
      }
    } else {
      tiebreakContainer.style.display = 'none';
      if (tiebreakInput) tiebreakInput.value = '';
    }
  };

  // Calculate max allowed value for an input based on opposite side's value
  const getMaxAllowedScore = (setIndex: number, side: string): number => {
    const oppositeSide = side === '1' ? '2' : '1';
    const oppositeInput = setsContainer.querySelector(
      `input[data-set-index="${setIndex}"][data-side="${oppositeSide}"]`
    ) as HTMLInputElement;
    
    if (!oppositeInput || !oppositeInput.value.trim()) {
      // No opposite value yet - allow up to maxGameScore
      return maxGameScore;
    }
    
    const oppositeValue = parseInt(oppositeInput.value) || 0;
    
    // For tiebreak-only sets (NoAD format like TB10), it's win-by-2
    // If one side is at setTo or above, other side can go up to oppositeValue + 2
    if (tiebreakSetTo) {
      // Win by 2 rule for tiebreak sets
      // If opposite is 11, this can be up to 13 (11+2)
      // If opposite is 10, this can be up to 12 (10+2)
      if (oppositeValue >= setTo) {
        return oppositeValue + 2;
      }
      // If opposite is below setTo, allow up to maxGameScore
      return maxGameScore;
    }
    
    // Context-aware max calculation for regular sets
    // If opposite side < setTo-1, this side max = setTo (can't trigger tiebreak)
    if (oppositeValue < setTo - 1) {
      return setTo;
    }
    
    // If opposite side = setTo-1, this side max = setTo+1 (could win or lose tiebreak scenario)
    if (oppositeValue === setTo - 1) {
      return setTo + 1;
    }
    
    // If opposite side = setTo, this side max = setTo+1 (could win normally or go to tiebreak)
    if (oppositeValue === setTo) {
      return setTo + 1;
    }
    
    // If opposite side = setTo+1, this side must be exactly setTo (tiebreak only)
    if (oppositeValue === setTo + 1) {
      return setTo;
    }
    
    // Default to maxGameScore
    return maxGameScore;
  };

  // Handle input changes
  const handleInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const isTiebreak = input.dataset.type === 'tiebreak';

    // Only allow numeric input
    const value = input.value.replace(/[^0-9]/g, '');
    if (value !== input.value) {
      input.value = value;
    }

    // Limit based on type
    if (isTiebreak) {
      // Tiebreak can go higher (e.g., 18-20)
      if (input.value.length > 2) {
        input.value = input.value.slice(0, 2);
      }
    } else {
      // Game scores limited based on opposite side's value
      const setIndex = parseInt(input.dataset.setIndex || '0');
      const side = input.dataset.side || '1';
      
      // For tiebreak-only sets (TB10), allow continued input even after match shows complete
      // This lets users build the final score like 11-13
      const isBuildingTiebreakSet = tiebreakSetTo && setIndex === 0;
      
      if (!isBuildingTiebreakSet) {
        const maxAllowed = getMaxAllowedScore(setIndex, side);
        const numValue = parseInt(input.value) || 0;
        
        if (numValue > maxAllowed) {
          input.value = maxAllowed.toString();
        }
      } else {
        // For TB10, allow extended tiebreak scores (up to 3 digits)
        // Reasonable max is 999 (extremely long tiebreaks like 99-101 are possible)
        if (input.value.length > 3) {
          input.value = input.value.slice(0, 3);
        }
      }
    }

    // Update tiebreak visibility and opposite input max if this is a game score input
    if (!isTiebreak) {
      const setIndex = parseInt(input.dataset.setIndex || '0');
      const side = input.dataset.side || '1';
      updateTiebreakVisibility(setIndex);
      
      // For tiebreak-only sets (TB10), don't coerce the opposite input
      // Allow users to build scores like 33-35 without interference
      if (!tiebreakSetTo) {
        // Recalculate and potentially adjust opposite side's value (only for regular sets)
        const oppositeSide = side === '1' ? '2' : '1';
        const oppositeInput = setsContainer.querySelector(
          `input[data-set-index="${setIndex}"][data-side="${oppositeSide}"]`
        ) as HTMLInputElement;
        
        if (oppositeInput && oppositeInput.value.trim()) {
          const oppositeValue = parseInt(oppositeInput.value) || 0;
          const oppositeMaxAllowed = getMaxAllowedScore(setIndex, oppositeSide);
          
          if (oppositeValue > oppositeMaxAllowed) {
            // Adjust opposite value to new max
            oppositeInput.value = oppositeMaxAllowed.toString();
          }
        }
      }
    }

    updateScoreFromInputs();
    updateClearButtonState();

    // Auto-expand sets if needed: only when current set is complete and we need another set
    const setIndex = parseInt(input.dataset.setIndex || '0');
    const currentSetComplete = isSetComplete(setIndex);
    
    if (currentSetComplete) {
      // Check if match is already complete
      const setsNeeded = Math.ceil(bestOf / 2);
      const setsWon1 = currentSets.filter(s => s.winningSide === 1).length;
      const setsWon2 = currentSets.filter(s => s.winningSide === 2).length;
      const matchComplete = setsWon1 >= setsNeeded || setsWon2 >= setsNeeded;
      
      // Only expand if match not complete and we should expand
      if (!matchComplete && shouldExpandSets(currentSets, matchUp.matchUpFormat)) {
        // Check if next set row already exists
        const nextSetIndex = currentSets.length;
        const nextSetExists = setsContainer.querySelector(`input[data-set-index="${nextSetIndex}"]`);
        
        // Only add if we're within bestOf limit and row doesn't exist
        if (nextSetIndex < bestOf && !nextSetExists) {
          const newSetRow = createSetRow(nextSetIndex);
          setsContainer.appendChild(newSetRow);
          
          // Attach handlers to new inputs
          const newInputs = newSetRow.querySelectorAll('input');
          newInputs.forEach(inp => {
            inp.addEventListener('input', handleInput);
            inp.addEventListener('keydown', handleKeydown);
          });
          
          updateClearButtonState();
        }
      }
    }
  };

  // Handle keyboard navigation
  const handleKeydown = (event: KeyboardEvent) => {
    const input = event.target as HTMLInputElement;
    const setIndex = parseInt(input.dataset.setIndex || '0');
    const side = input.dataset.side || '1';
    const isTiebreak = input.dataset.type === 'tiebreak';

    // Tab: move to next input (with proper forward/backward handling)
    if (event.key === 'Tab') {
      event.preventDefault();
      
      if (event.shiftKey) {
        // Shift+Tab: Move backward
        if (isTiebreak) {
          // From tiebreak to side 2
          const side2Input = setsContainer.querySelector(
            `input[data-set-index="${setIndex}"][data-side="2"]`
          ) as HTMLInputElement;
          if (side2Input) side2Input.focus();
        } else if (side === '2') {
          // From side 2 to side 1
          const side1Input = setsContainer.querySelector(
            `input[data-set-index="${setIndex}"][data-side="1"]`
          ) as HTMLInputElement;
          if (side1Input) side1Input.focus();
        } else if (setIndex > 0) {
          // From side 1 to previous set's tiebreak (if exists) or side 2
          const prevTiebreakInput = setsContainer.querySelector(
            `input[data-set-index="${setIndex - 1}"][data-type="tiebreak"]`
          ) as HTMLInputElement;
          const prevSide2Input = setsContainer.querySelector(
            `input[data-set-index="${setIndex - 1}"][data-side="2"]`
          ) as HTMLInputElement;
          
          // Check if tiebreak is visible
          const prevTiebreakContainer = prevTiebreakInput?.closest('.tiebreak-container') as HTMLElement;
          if (prevTiebreakInput && prevTiebreakContainer && prevTiebreakContainer.style.display !== 'none') {
            prevTiebreakInput.focus();
          } else if (prevSide2Input) {
            prevSide2Input.focus();
          }
        }
      } else {
        // Forward Tab
        // Check isTiebreak FIRST before checking side (tiebreak doesn't have side attribute)
        if (isTiebreak) {
          // From tiebreak to next set's side 1
          const nextInput = setsContainer.querySelector(
            `input[data-set-index="${setIndex + 1}"][data-side="1"]`
          ) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
          } else if (setIndex + 1 < bestOf) {
            // Only create next set if current set is valid and match not complete
            const currentSetComplete = isSetComplete(setIndex);
            if (!currentSetComplete) {
              return;
            }
            
            // Check if match is already complete
            const setsNeeded = Math.ceil(bestOf / 2);
            const setsWon1 = currentSets.filter(s => s.winningSide === 1).length;
            const setsWon2 = currentSets.filter(s => s.winningSide === 2).length;
            const matchComplete = setsWon1 >= setsNeeded || setsWon2 >= setsNeeded;
            
            if (matchComplete) {
              return; // Don't create next set if match complete
            }
            
            // Create next set
            const newSetRow = createSetRow(setIndex + 1);
            setsContainer.appendChild(newSetRow);
            
            // Attach handlers
            const newInputs = newSetRow.querySelectorAll('input');
            newInputs.forEach(inp => {
              inp.addEventListener('input', handleInput);
              inp.addEventListener('keydown', handleKeydown);
            });
            
            // Focus first input of new set
            (newInputs[0] as HTMLInputElement).focus();
            updateClearButtonState();
          }
        } else if (side === '1') {
          // Move from side 1 to side 2 of same set
          const side2Input = setsContainer.querySelector(
            `input[data-set-index="${setIndex}"][data-side="2"]`
          ) as HTMLInputElement;
          if (side2Input) side2Input.focus();
        } else if (side === '2') {
          // First, update score to ensure currentSets reflects the latest input
          updateScoreFromInputs();
          
          // Check if tiebreak input is visible
          const tiebreakInput = setsContainer.querySelector(
            `input[data-set-index="${setIndex}"][data-type="tiebreak"]`
          ) as HTMLInputElement;
          const tiebreakContainer = tiebreakInput?.closest('.tiebreak-container') as HTMLElement;
          
          if (tiebreakInput && tiebreakContainer && tiebreakContainer.style.display !== 'none') {
            // Move to tiebreak if visible
            tiebreakInput.focus();
          } else {
            // Move to next set's side 1
            const nextInput = setsContainer.querySelector(
              `input[data-set-index="${setIndex + 1}"][data-side="1"]`
            ) as HTMLInputElement;
            if (nextInput) {
              nextInput.focus();
            } else if (setIndex + 1 < bestOf) {
              // Only create next set if current set is complete and match not complete
              const currentSetComplete = isSetComplete(setIndex);
              
              if (!currentSetComplete) {
                return;
              }
              
              // Check if match is already complete
              const setsNeeded = Math.ceil(bestOf / 2);
              const setsWon1 = currentSets.filter(s => s.winningSide === 1).length;
              const setsWon2 = currentSets.filter(s => s.winningSide === 2).length;
              const matchComplete = setsWon1 >= setsNeeded || setsWon2 >= setsNeeded;
              
              if (matchComplete) {
                return; // Don't create next set if match complete
              }
              
              // Create next set
              const newSetRow = createSetRow(setIndex + 1);
              setsContainer.appendChild(newSetRow);
              
              // Attach handlers
              const newInputs = newSetRow.querySelectorAll('input');
              newInputs.forEach(inp => {
                inp.addEventListener('input', handleInput);
                inp.addEventListener('keydown', handleKeydown);
              });
              
              // Focus first input of new set
              (newInputs[0] as HTMLInputElement).focus();
              updateClearButtonState();
            }
          }
        } else if (isTiebreak) {
          // From tiebreak to next set's side 1
          const nextInput = setsContainer.querySelector(
            `input[data-set-index="${setIndex + 1}"][data-side="1"]`
          ) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
          } else if (setIndex + 1 < bestOf) {
            // Only create next set if current set is valid and match not complete
            const currentSetComplete = isSetComplete(setIndex);
            if (!currentSetComplete) {
              return;
            }
            
            // Check if match is already complete
            const setsNeeded = Math.ceil(bestOf / 2);
            const setsWon1 = currentSets.filter(s => s.winningSide === 1).length;
            const setsWon2 = currentSets.filter(s => s.winningSide === 2).length;
            const matchComplete = setsWon1 >= setsNeeded || setsWon2 >= setsNeeded;
            
            if (matchComplete) {
              return; // Don't create next set if match complete
            }
            
            // Create next set
            const newSetRow = createSetRow(setIndex + 1);
            setsContainer.appendChild(newSetRow);
            
            // Attach handlers
            const newInputs = newSetRow.querySelectorAll('input');
            newInputs.forEach(inp => {
              inp.addEventListener('input', handleInput);
              inp.addEventListener('keydown', handleKeydown);
            });
            
            // Focus first input of new set
            (newInputs[0] as HTMLInputElement).focus();
            updateClearButtonState();
          }
        }
      }
    }

    // Enter: submit if valid
    if (event.key === 'Enter') {
      const submitBtn = document.getElementById('submitScoreV2') as HTMLButtonElement;
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
      }
    }

    // Backspace: clear and move back if empty
    if (event.key === 'Backspace' && input.value === '') {
      event.preventDefault();
      
      if (isTiebreak) {
        // From tiebreak to side 2
        const side2Input = setsContainer.querySelector(
          `input[data-set-index="${setIndex}"][data-side="2"]`
        ) as HTMLInputElement;
        if (side2Input) side2Input.focus();
      } else if (side === '2') {
        // Move back to side 1 of same set
        const side1Input = setsContainer.querySelector(
          `input[data-set-index="${setIndex}"][data-side="1"]`
        ) as HTMLInputElement;
        if (side1Input) side1Input.focus();
      } else if (setIndex > 0) {
        // Move back to previous set's tiebreak (if visible) or side 2
        const prevTiebreakInput = setsContainer.querySelector(
          `input[data-set-index="${setIndex - 1}"][data-type="tiebreak"]`
        ) as HTMLInputElement;
        const prevSide2Input = setsContainer.querySelector(
          `input[data-set-index="${setIndex - 1}"][data-side="2"]`
        ) as HTMLInputElement;
        
        // Check if tiebreak is visible
        const prevTiebreakContainer = prevTiebreakInput?.closest('.tiebreak-container') as HTMLElement;
        if (prevTiebreakInput && prevTiebreakContainer && prevTiebreakContainer.style.display !== 'none') {
          prevTiebreakInput.focus();
        } else if (prevSide2Input) {
          prevSide2Input.focus();
        }
      }
    }
  };

  // Initialize with first set
  const firstSetRow = createSetRow(0);
  setsContainer.appendChild(firstSetRow);

  // Attach event listeners
  const initialInputs = firstSetRow.querySelectorAll('input');
  initialInputs.forEach(input => {
    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeydown);
  });

  // Pre-fill with existing scores if available
  if (matchUp.score?.sets && matchUp.score.sets.length > 0) {
    matchUp.score.sets.forEach((set: any, index: number) => {
      if (index > 0) {
        const setRow = createSetRow(index);
        setsContainer.appendChild(setRow);
        
        const setInputs = setRow.querySelectorAll('input');
        setInputs.forEach(inp => {
          inp.addEventListener('input', handleInput);
          inp.addEventListener('keydown', handleKeydown);
        });
      }

      const side1Input = setsContainer.querySelector(
        `input[data-set-index="${index}"][data-side="1"]`
      ) as HTMLInputElement;
      const side2Input = setsContainer.querySelector(
        `input[data-set-index="${index}"][data-side="2"]`
      ) as HTMLInputElement;

      if (side1Input && side2Input) {
        side1Input.value = set.side1Score?.toString() || '';
        side2Input.value = set.side2Score?.toString() || '';
      }
    });
    
    updateScoreFromInputs();
  } else {
    updateMatchUpDisplay();
  }

  // Focus first input
  setTimeout(() => {
    const firstInput = setsContainer.querySelector('input') as HTMLInputElement;
    if (firstInput) firstInput.focus();
  }, 100);
}

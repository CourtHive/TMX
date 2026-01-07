/**
 * Dynamic Sets score entry approach
 * Individual set inputs with hotkey navigation and real-time validation
 */
import { renderMatchUp } from 'courthive-components';
import { validateSetScores } from '../utils/scoreValidator';
import { parseMatchUpFormat, shouldExpandSets } from '../utils/setExpansionLogic';
import type { RenderScoreEntryParams, SetScore } from '../types';
import { env } from 'settings/env';
import { matchUpFormatCode, matchUpStatusConstants } from 'tods-competition-factory';
import { loadSettings } from 'services/settings/settingsStorage';
import {
  isMatchComplete as isMatchCompleteLogic,
  isSetComplete as isSetCompleteLogic,
  getSetFormatForIndex,
  shouldShowTiebreak as shouldShowTiebreakLogic,
  getMaxAllowedScore as getMaxAllowedScoreLogic,
  shouldApplySmartComplement,
  buildSetScore,
  type MatchConfig,
} from '../logic/dynamicSetsLogic';

const { COMPLETED, RETIRED, WALKOVER, DEFAULTED } = matchUpStatusConstants;

export function renderDynamicSetsScoreEntry(params: RenderScoreEntryParams): void {
  const { matchUp, container, onScoreChange } = params;

  // Clear container
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '1em';

  const scaleAttributes = env.scales[env.activeScale];

  // Parse match format
  // NOTE: These are wrapped in a function to allow dynamic re-parsing when format changes
  let currentMatchUpFormat = matchUp.matchUpFormat || 'SET3-S:6/TB7';
  
  const getMatchConfig = (): MatchConfig => {
    const formatInfo = parseMatchUpFormat(currentMatchUpFormat);
    const parsedFormat = matchUpFormatCode.parse(currentMatchUpFormat);
    return {
      bestOf: formatInfo.bestOf,
      setFormat: parsedFormat?.setFormat,
      finalSetFormat: parsedFormat?.finalSetFormat,
    };
  };
  
  // Create matchConfig that always uses current format
  // This ensures format changes are immediately reflected
  let matchConfig = getMatchConfig();
  const getBestOf = () => matchConfig.bestOf;

  // Helper function to get format for a specific set index
  // NOTE: Keeping this closure for backward compatibility during migration
  // Eventually will be replaced by direct calls to getSetFormatForIndex()
  const getSetFormat = (setIndex: number) => {
    return getSetFormatForIndex(setIndex, matchConfig);
  };

  // Note: Set-specific format (including tiebreak-only detection) is now handled
  // dynamically in getSetFormat() for each set, not statically at the top

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
              // Format changed - update matchUp and regenerate config
              matchUp.matchUpFormat = newFormat;
              currentMatchUpFormat = newFormat;
              formatButton.textContent = newFormat;

              // Regenerate matchConfig with new format
              matchConfig = getMatchConfig();

              // Clear all sets and reset
              if ((globalThis as any).resetDynamicSets) {
                (globalThis as any).resetDynamicSets();
              }
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
        console.error('[DynamicSets] Error opening format selector:', error);
      }
    });
    formatDisplay.appendChild(formatButton);

    container.appendChild(formatDisplay);
  }

  // Irregular ending selector
  let selectedOutcome: typeof COMPLETED | typeof RETIRED | typeof WALKOVER | typeof DEFAULTED = COMPLETED;
  let selectedWinner: number | undefined = undefined; // For irregular endings
  
  // Track which sets have had smart complement applied (for efficiency feature)
  // REFACTORED: Changed from Map to Set for compatibility with pure logic
  const setsWithSmartComplement = new Set<number>();

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
    { value: RETIRED, label: 'Retired' },
    { value: WALKOVER, label: 'Walkover' },
    { value: DEFAULTED, label: 'Defaulted' },
  ];

  outcomes.forEach((outcome) => {
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
      if (selectedOutcome === WALKOVER) {
        // Clear all set inputs
        const allInputs = setsContainer.querySelectorAll('input');
        allInputs.forEach((input) => {
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
    const radios = irregularEndingContainer.querySelectorAll(
      'input[name="matchOutcome"]',
    ) as NodeListOf<HTMLInputElement>;
    radios.forEach((r) => (r.checked = false));

    // Reset to COMPLETED
    selectedOutcome = COMPLETED;
    selectedWinner = undefined;
    winnerSelectionContainer.style.display = 'none';

    // Clear winner selection
    const winnerRadios = irregularEndingContainer.querySelectorAll<HTMLInputElement>('input[name="irregularWinner"]');
    winnerRadios.forEach((r) => (r.checked = false));

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
    
    // Reset smart complement tracking
    setsWithSmartComplement.clear();

    // Reset irregular ending
    selectedOutcome = COMPLETED;
    selectedWinner = undefined;

    // Uncheck all irregular ending radios
    const outcomeRadios = irregularEndingContainer.querySelectorAll<HTMLInputElement>('input[name="matchOutcome"]');
    outcomeRadios.forEach((r) => (r.checked = false));

    // Clear winner selection
    const winnerRadios = irregularEndingContainer.querySelectorAll(
      'input[name="irregularWinner"]',
    ) as NodeListOf<HTMLInputElement>;
    winnerRadios.forEach((r) => (r.checked = false));

    // Hide winner selection container
    winnerSelectionContainer.style.display = 'none';

    // Add first set row
    const firstSetRow = createSetRow(0);
    setsContainer.appendChild(firstSetRow);

    // Attach event listeners
    const inputs = firstSetRow.querySelectorAll('input');
    inputs.forEach((input) => {
      input.addEventListener('input', handleInput);
      input.addEventListener('keydown', handleKeydown);
    });

    // Update display and validation - explicitly clear everything
    updateMatchUpDisplay({ clearAll: true });
    onScoreChange({ isValid: false, sets: [] });

    // Focus first input
    const firstInput = setsContainer.querySelector('input') as HTMLInputElement;
    if (firstInput) firstInput.focus();
  };

  // Expose reset function for Clear button
  (globalThis as any).resetDynamicSets = resetAllSets;

  // Function to render/update the matchUp display
  const updateMatchUpDisplay = (validationResult?: any) => {
    matchUpContainer.innerHTML = '';

    // Determine score for display
    let displayScore: any;
    if (validationResult?.clearAll) {
      displayScore = undefined;
    } else if (validationResult?.scoreObject) {
      displayScore = validationResult.scoreObject;
    } else if (currentSets.length > 0) {
      displayScore = { sets: currentSets };
    } else {
      displayScore = matchUp.score;
    }

    // Create temporary matchUp with current sets
    const displayMatchUp = {
      ...matchUp,
      score: displayScore,
      winningSide: validationResult?.clearAll ? undefined : validationResult?.winningSide,
      matchUpStatus: validationResult?.clearAll ? undefined : validationResult?.matchUpStatus,
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

  // Function to check if a set is complete (both inputs have values and it's a valid set)
  // REFACTORED: Now uses pure logic from dynamicSetsLogic.ts
  const isSetComplete = (setIndex: number): boolean => {
    const side1Input = setsContainer.querySelector(
      `input[data-set-index="${setIndex}"][data-side="1"]`,
    ) as HTMLInputElement;
    const side2Input = setsContainer.querySelector(
      `input[data-set-index="${setIndex}"][data-side="2"]`,
    ) as HTMLInputElement;
    const tiebreakInput = setsContainer.querySelector(
      `input[data-set-index="${setIndex}"][data-type="tiebreak"]`,
    ) as HTMLInputElement;

    if (!side1Input || !side2Input) return false;

    const side1Value = side1Input.value.trim();
    const side2Value = side2Input.value.trim();

    // Both sides must have values
    if (side1Value === '' || side2Value === '') return false;

    const side1Score = Number.parseInt(side1Value) || 0;
    const side2Score = Number.parseInt(side2Value) || 0;
    const tiebreakScore = tiebreakInput?.value.trim() ? Number.parseInt(tiebreakInput.value) : undefined;

    // Use pure logic function
    return isSetCompleteLogic(
      setIndex,
      { side1: side1Score, side2: side2Score, tiebreak: tiebreakScore },
      matchConfig,
    );
  };

  // Function to update score from inputs
  const updateScoreFromInputs = () => {
    // CRITICAL: Start by hiding winner selection unless irregular ending is selected
    // This prevents it from appearing when user types in score fields
    if (selectedOutcome === COMPLETED) {
      winnerSelectionContainer.style.display = 'none';
    }

    const newSets: SetScore[] = [];

    // Parse all set inputs
    for (let i = 0; i < getBestOf(); i++) {
      const side1Input = setsContainer.querySelector(`input[data-set-index="${i}"][data-side="1"]`) as HTMLInputElement;
      const side2Input = setsContainer.querySelector(`input[data-set-index="${i}"][data-side="2"]`) as HTMLInputElement;
      const tiebreakInput = setsContainer.querySelector(
        `input[data-set-index="${i}"][data-type="tiebreak"]`,
      ) as HTMLInputElement;

      if (!side1Input || !side2Input) break;

      const side1Value = side1Input.value.trim();
      const side2Value = side2Input.value.trim();

      // If both are empty, stop here
      if (side1Value === '' && side2Value === '') break;

      const tiebreakValue = tiebreakInput?.value.trim();

      // REFACTORED: Use pure logic function to build SetScore object
      // This handles all the complexity of:
      // - Tiebreak-only sets vs regular sets
      // - Winner determination based on completion rules
      // - Tiebreak score calculation and assignment
      const setData = buildSetScore(
        i,
        side1Value,
        side2Value,
        tiebreakValue,
        matchConfig,
      );

      newSets.push(setData);
    }

    currentSets = newSets;

    // CRITICAL: Remove unnecessary set rows
    // This handles both:
    // 1. Empty trailing rows when a set is cleared
    // 2. Extra rows when match becomes complete
    // 3. Extra rows when a set becomes incomplete (e.g., removing tiebreak score)
    const allSetRows = setsContainer.querySelectorAll('.set-row');
    
    // Determine how many rows we should have
    // If match is complete, only keep completed sets
    // If match is incomplete, keep one extra row for next set
    const matchComplete = isMatchCompleteLogic(currentSets, getBestOf());
    
    let rowsToKeep: number;
    if (matchComplete) {
      // Match complete: only keep rows with complete sets
      const completeSetsCount = currentSets.filter(s => s.winningSide !== undefined).length;
      rowsToKeep = Math.max(1, completeSetsCount);
    } else {
      // Match incomplete: keep current sets + 1 empty row (if not at bestOf limit)
      const lastSetIndex = currentSets.length - 1;
      const lastSetComplete = lastSetIndex >= 0 && currentSets[lastSetIndex].winningSide !== undefined;
      
      if (lastSetComplete && currentSets.length < getBestOf()) {
        // Last set complete and we can add more: keep +1 for next set
        rowsToKeep = currentSets.length + 1;
      } else {
        // Either last set incomplete or at bestOf limit: just keep current sets
        rowsToKeep = Math.max(1, currentSets.length);
      }
    }

    // Remove excess rows
    for (let i = allSetRows.length - 1; i >= rowsToKeep; i--) {
      allSetRows[i].remove();
    }

    // Validate and update display
    if (currentSets.length > 0 || selectedOutcome !== COMPLETED) {
      // Build sets data with tiebreak scores for validation
      // For in-progress matches, include all sets (even without winningSide)
      // A match is "in progress" if:
      // 1. selectedOutcome is not COMPLETED (irregular ending), OR
      // 2. Some sets don't have winningSide (incomplete/invalid regular sets)
      const hasIncompleteSets = currentSets.some((s) => s.winningSide === undefined);
      const matchInProgress = selectedOutcome !== COMPLETED || hasIncompleteSets;
      const setsToValidate = matchInProgress ? currentSets : currentSets.filter((s) => s.winningSide !== undefined);

      const setsForValidation = setsToValidate.map((s) => {
        // For tiebreak-only sets (where side1Score and side2Score are 0),
        // don't include side1/side2 in validation data - factory expects undefined for TB-only sets
        const isTiebreakOnlySet =
          s.side1Score === 0 &&
          s.side2Score === 0 &&
          (s.side1TiebreakScore !== undefined || s.side2TiebreakScore !== undefined);

        if (isTiebreakOnlySet) {
          // Tiebreak-only set: only include tiebreak scores and winningSide
          const result: any = {
            side1TiebreakScore: s.side1TiebreakScore,
            side2TiebreakScore: s.side2TiebreakScore,
          };
          if (s.winningSide !== undefined) result.winningSide = s.winningSide;
          return result;
        } else {
          // Regular set: include game scores, tiebreak scores (if any), and winningSide
          const result: any = {
            side1: s.side1Score,
            side2: s.side2Score,
          };
          if (s.side1TiebreakScore !== undefined) result.side1TiebreakScore = s.side1TiebreakScore;
          if (s.side2TiebreakScore !== undefined) result.side2TiebreakScore = s.side2TiebreakScore;
          if (s.winningSide !== undefined) result.winningSide = s.winningSide;
          return result;
        }
      });

      const validation = validateSetScores(
        setsForValidation,
        matchUp.matchUpFormat,
        selectedOutcome !== COMPLETED, // Allow incomplete if irregular ending
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
      if (selectedOutcome !== COMPLETED) {
        // Always show irregular ending when an irregular outcome is selected
        irregularEndingContainer.style.display = 'block';
        winnerSelectionContainer.style.display = 'block'; // Always show winner selection
      } else {
        // When COMPLETED (no irregular ending selected)
        // Hide winner selection always
        winnerSelectionContainer.style.display = 'none';

        if (matchComplete) {
          // Hide irregular ending only when match is complete AND no irregular outcome selected
          irregularEndingContainer.style.display = 'none';
        } else {
          // Show irregular ending when match incomplete
          irregularEndingContainer.style.display = 'block';
        }
      }

      // Add matchUpStatus and winningSide if irregular ending
      if (selectedOutcome !== COMPLETED) {
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
      const hasContent = allSetRows.length > 1 || firstSide1?.value.trim() !== '' || firstSide2?.value.trim() !== '';
      clearBtn.disabled = !hasContent;
    }
  };

  // Function to show/hide tiebreak input based on score
  // REFACTORED: Now uses pure logic from dynamicSetsLogic.ts
  const updateTiebreakVisibility = (setIndex: number) => {
    const side1Input = setsContainer.querySelector(
      `input[data-set-index="${setIndex}"][data-side="1"]`,
    ) as HTMLInputElement;
    const side2Input = setsContainer.querySelector(
      `input[data-set-index="${setIndex}"][data-side="2"]`,
    ) as HTMLInputElement;
    const tiebreakContainer = setsContainer.querySelector(
      `.set-row:nth-child(${setIndex + 1}) .tiebreak-container`,
    ) as HTMLElement;
    const tiebreakInput = setsContainer.querySelector(
      `input[data-set-index="${setIndex}"][data-type="tiebreak"]`,
    ) as HTMLInputElement;

    if (!side1Input || !side2Input || !tiebreakContainer) return;

    const side1Score = Number.parseInt(side1Input.value) || 0;
    const side2Score = Number.parseInt(side2Input.value) || 0;

    // Use pure logic function
    const showTiebreak = shouldShowTiebreakLogic(
      setIndex,
      { side1: side1Score, side2: side2Score },
      matchConfig,
    );

    if (showTiebreak) {
      tiebreakContainer.style.display = 'inline';
      // Don't auto-focus - let user tab to it naturally
    } else {
      tiebreakContainer.style.display = 'none';
      if (tiebreakInput) tiebreakInput.value = '';
    }
  };

  // Calculate max allowed value for an input based on opposite side's value
  // REFACTORED: Now uses pure logic from dynamicSetsLogic.ts
  const getMaxAllowedScore = (setIndex: number, side: string): number => {
    const oppositeSide = side === '1' ? '2' : '1';
    const oppositeInput = setsContainer.querySelector(
      `input[data-set-index="${setIndex}"][data-side="${oppositeSide}"]`,
    ) as HTMLInputElement;

    const ownInput = setsContainer.querySelector(
      `input[data-set-index="${setIndex}"][data-side="${side}"]`,
    ) as HTMLInputElement;

    const ownValue = Number.parseInt(ownInput?.value) || 0;
    const oppositeValue = Number.parseInt(oppositeInput?.value) || 0;

    // Use pure logic function
    return getMaxAllowedScoreLogic(
      setIndex,
      side === '1' ? 1 : 2,
      { side1: side === '1' ? ownValue : oppositeValue, side2: side === '2' ? ownValue : oppositeValue },
      matchConfig,
    );
  };

  // Handle input changes
  const handleInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const isTiebreak = input.dataset.type === 'tiebreak';

    // Only allow numeric input
    const value = input.value.replace(/\D/g, '');
    if (value !== input.value) {
      input.value = value;
    }

    // Get set-specific information (used in multiple places below)
    const setIndex = Number.parseInt(input.dataset.setIndex || '0');
    const side = input.dataset.side || '1';
    const setFormat = getSetFormat(setIndex);
    const setIsTiebreakOnly = setFormat?.tiebreakSet?.tiebreakTo !== undefined;

    // Limit based on type
    if (isTiebreak) {
      // Tiebreak can go higher (e.g., 18-20)
      if (input.value.length > 2) {
        input.value = input.value.slice(0, 2);
      }
    } else {
      // Game scores limited based on opposite side's value

      // For tiebreak-only sets (TB10), allow continued input even after match shows complete
      // This lets users build the final score like 11-13
      const isBuildingTiebreakSet = setIsTiebreakOnly;

      if (isBuildingTiebreakSet) {
        // For TB10, allow extended tiebreak scores (up to 3 digits)
        // Reasonable max is 999 (extremely long tiebreaks like 99-101 are possible)
        if (input.value.length > 3) {
          input.value = input.value.slice(0, 3);
        }
      } else {
        const maxAllowed = getMaxAllowedScore(setIndex, side);
        const numValue = Number.parseInt(input.value) || 0;

        if (numValue > maxAllowed) {
          input.value = maxAllowed.toString();
        }
      }
    }

    // Update tiebreak visibility and opposite input max if this is a game score input
    if (!isTiebreak) {
      updateTiebreakVisibility(setIndex);

      // For tiebreak-only sets (TB10), don't coerce the opposite input
      // Allow users to build scores like 33-35 without interference
      if (!setIsTiebreakOnly) {
        // Recalculate and potentially adjust opposite side's value (only for regular sets)
        const oppositeSide = side === '1' ? '2' : '1';
        const oppositeInput = setsContainer.querySelector(
          `input[data-set-index="${setIndex}"][data-side="${oppositeSide}"]`,
        ) as HTMLInputElement;

        if (oppositeInput?.value.trim()) {
          const oppositeValue = Number.parseInt(oppositeInput.value) || 0;
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
    const currentSetComplete = isSetComplete(setIndex);

    if (currentSetComplete) {
      // REFACTORED: Use pure logic function for match completion check
      const matchComplete = isMatchCompleteLogic(currentSets, getBestOf());

      // Only expand if match not complete and we should expand
      if (!matchComplete && shouldExpandSets(currentSets, matchUp.matchUpFormat)) {
        // Check if next set row already exists
        const nextSetIndex = currentSets.length;
        const nextSetExists = setsContainer.querySelector(`input[data-set-index="${nextSetIndex}"]`);

        // Only add if we're within bestOf limit and row doesn't exist
        if (nextSetIndex < getBestOf() && !nextSetExists) {
          const newSetRow = createSetRow(nextSetIndex);
          setsContainer.appendChild(newSetRow);

          // Attach handlers to new inputs
          const newInputs = newSetRow.querySelectorAll('input');
          newInputs.forEach((inp) => {
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
    const setIndex = Number.parseInt(input.dataset.setIndex || '0');
    const side = input.dataset.side || '1';
    const isTiebreak = input.dataset.type === 'tiebreak';

    // SMART COMPLEMENT ENTRY FEATURE
    // REFACTORED: Now uses pure logic from dynamicSetsLogic.ts
    // Only enabled if user has turned it on in settings
    const settings = loadSettings();
    const smartComplementsEnabled = settings?.smartComplements === true;
    
    // If in side1 field, handle smart complement using pure logic
    if (side === '1' && !isTiebreak) {
      // Handle number keys (0-9)
      // Use event.code to detect digit keys even when Shift is pressed (event.key would be @ for Shift+2)
      const digitMatch = event.code.match(/^Digit(\d)$/);
      if (digitMatch) {
        const digit = Number.parseInt(digitMatch[1]);
        const currentValue = input.value;
        
        // Only apply smart complement if field is empty (first entry for this set)
        if (currentValue === '') {
          const isShiftPressed = event.shiftKey;
          
          // Use pure logic function to determine if/how to apply complement
          const result = shouldApplySmartComplement(
            digit,
            isShiftPressed,
            setIndex,
            currentSets,
            matchConfig,
            setsWithSmartComplement,
            smartComplementsEnabled,
          );
          
          if (result.shouldApply) {
            event.preventDefault();
            
            // Apply the calculated complement values
            input.value = result.field1Value.toString();
            
            const side2Input = setsContainer.querySelector(
              `input[data-set-index="${setIndex}"][data-side="2"]`,
            ) as HTMLInputElement;
            if (side2Input) {
              side2Input.value = result.field2Value.toString();
            }
            
            // Mark this set as having smart complement applied
            setsWithSmartComplement.add(setIndex);
            
            // Trigger input events to update validation
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Move to next set's side1 field (if needed)
            // Need to wait for validation to complete to check if match is complete
            setTimeout(() => {
              // Force update to ensure currentSets is updated with the new values
              updateScoreFromInputs();
              
              // REFACTORED: Use pure logic function for match completion check
              const matchComplete = isMatchCompleteLogic(currentSets, getBestOf());
              
              if (matchComplete) {
                // Match is complete, don't create next set or move focus
                return;
              }
              
              // Match not complete, check if next set exists or needs to be created
              const nextSetSide1 = setsContainer.querySelector(
                `input[data-set-index="${setIndex + 1}"][data-side="1"]`,
              ) as HTMLInputElement;
              
              if (nextSetSide1) {
                nextSetSide1.focus();
              } else if (setIndex + 1 < getBestOf()) {
                // Create next set
                const newSetRow = createSetRow(setIndex + 1);
                setsContainer.appendChild(newSetRow);
                
                const newInputs = newSetRow.querySelectorAll('input');
                newInputs.forEach((inp) => {
                  inp.addEventListener('input', handleInput);
                  inp.addEventListener('keydown', handleKeydown);
                });
                
                const firstInput = newInputs[0];
                if (firstInput instanceof HTMLInputElement) {
                  firstInput.focus();
                }
                updateClearButtonState();
              }
            }, 10);
            
            return; // Don't process the key further
          }
        }
      }
    }

    // Tab: move to next input (with proper forward/backward handling)
    if (event.key === 'Tab') {
      event.preventDefault();

      if (event.shiftKey) {
        // Shift+Tab: Move backward
        if (isTiebreak) {
          // From tiebreak to side 2
          const side2Input = setsContainer.querySelector(
            `input[data-set-index="${setIndex}"][data-side="2"]`,
          ) as HTMLInputElement;
          if (side2Input) side2Input.focus();
        } else if (side === '2') {
          // From side 2 to side 1
          const side1Input = setsContainer.querySelector(
            `input[data-set-index="${setIndex}"][data-side="1"]`,
          ) as HTMLInputElement;
          if (side1Input) side1Input.focus();
        } else if (setIndex > 0) {
          // From side 1 to previous set's tiebreak (if exists) or side 2
          const prevTiebreakInput = setsContainer.querySelector(
            `input[data-set-index="${setIndex - 1}"][data-type="tiebreak"]`,
          ) as HTMLInputElement;
          const prevSide2Input = setsContainer.querySelector(
            `input[data-set-index="${setIndex - 1}"][data-side="2"]`,
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
            `input[data-set-index="${setIndex + 1}"][data-side="1"]`,
          ) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
          } else if (setIndex + 1 < getBestOf()) {
            // Only create next set if current set is valid and match not complete
            const currentSetComplete = isSetComplete(setIndex);
            if (!currentSetComplete) {
              return;
            }

            // Update score to ensure currentSets reflects the latest tiebreak input
            updateScoreFromInputs();

            // REFACTORED: Use pure logic function for match completion check
            const matchComplete = isMatchCompleteLogic(currentSets, getBestOf());

            if (matchComplete) {
              return; // Don't create next set if match complete
            }

            // Create next set
            const newSetRow = createSetRow(setIndex + 1);
            setsContainer.appendChild(newSetRow);

            // Attach handlers
            const newInputs = newSetRow.querySelectorAll('input');
            newInputs.forEach((inp) => {
              inp.addEventListener('input', handleInput);
              inp.addEventListener('keydown', handleKeydown);
            });

            // Focus first input of new set
            const firstInput = newInputs[0];
            if (firstInput instanceof HTMLInputElement) {
              firstInput.focus();
            }
            updateClearButtonState();
          }
        } else if (side === '1') {
          // Move from side 1 to side 2 of same set
          const side2Input = setsContainer.querySelector(
            `input[data-set-index="${setIndex}"][data-side="2"]`,
          ) as HTMLInputElement;
          if (side2Input) side2Input.focus();
        } else if (side === '2') {
          // First, update score to ensure currentSets reflects the latest input
          updateScoreFromInputs();

          // Check if tiebreak input is visible
          const tiebreakInput = setsContainer.querySelector(
            `input[data-set-index="${setIndex}"][data-type="tiebreak"]`,
          ) as HTMLInputElement;
          const tiebreakContainer = tiebreakInput?.closest('.tiebreak-container') as HTMLElement;

          if (tiebreakInput && tiebreakContainer && tiebreakContainer.style.display !== 'none') {
            // Move to tiebreak if visible
            tiebreakInput.focus();
          } else {
            // Move to next set's side 1
            const nextInput = setsContainer.querySelector(
              `input[data-set-index="${setIndex + 1}"][data-side="1"]`,
            ) as HTMLInputElement;
            if (nextInput) {
              nextInput.focus();
            } else if (setIndex + 1 < getBestOf()) {
              // Only create next set if current set is complete and match not complete
              const currentSetComplete = isSetComplete(setIndex);

              if (!currentSetComplete) {
                return;
              }

              // REFACTORED: Use pure logic function for match completion check
              const matchComplete = isMatchCompleteLogic(currentSets, getBestOf());

              if (matchComplete) {
                return; // Don't create next set if match complete
              }

              // Create next set
              const newSetRow = createSetRow(setIndex + 1);
              setsContainer.appendChild(newSetRow);

              // Attach handlers
              const newInputs = newSetRow.querySelectorAll('input');
              newInputs.forEach((inp) => {
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
          `input[data-set-index="${setIndex}"][data-side="2"]`,
        ) as HTMLInputElement;
        if (side2Input) side2Input.focus();
      } else if (side === '2') {
        // Move back to side 1 of same set
        const side1Input = setsContainer.querySelector(
          `input[data-set-index="${setIndex}"][data-side="1"]`,
        ) as HTMLInputElement;
        if (side1Input) side1Input.focus();
      } else if (setIndex > 0) {
        // Move back to previous set's tiebreak (if visible) or side 2
        const prevTiebreakInput = setsContainer.querySelector(
          `input[data-set-index="${setIndex - 1}"][data-type="tiebreak"]`,
        ) as HTMLInputElement;
        const prevSide2Input = setsContainer.querySelector(
          `input[data-set-index="${setIndex - 1}"][data-side="2"]`,
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
  initialInputs.forEach((input) => {
    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeydown);
  });

  // Pre-fill with existing scores if available
  if (matchUp.score?.sets && matchUp.score.sets.length > 0) {
    // Check if match is already complete to avoid showing extra empty sets
    const setsNeeded = Math.ceil(getBestOf() / 2);
    let setsWon1 = 0;
    let setsWon2 = 0;
    let matchAlreadyComplete = false;

    matchUp.score.sets.forEach((set: any, index: number) => {
      // Check completion status BEFORE creating this set row
      if (matchAlreadyComplete) {
        return; // Skip creating rows after match is complete
      }

      if (index > 0) {
        const setRow = createSetRow(index);
        setsContainer.appendChild(setRow);

        const setInputs = setRow.querySelectorAll('input');
        setInputs.forEach((inp) => {
          inp.addEventListener('input', handleInput);
          inp.addEventListener('keydown', handleKeydown);
        });
      }

      const side1Input = setsContainer.querySelector(
        `input[data-set-index="${index}"][data-side="1"]`,
      ) as HTMLInputElement;
      const side2Input = setsContainer.querySelector(
        `input[data-set-index="${index}"][data-side="2"]`,
      ) as HTMLInputElement;

      if (side1Input && side2Input) {
        side1Input.value = set.side1Score?.toString() || '';
        side2Input.value = set.side2Score?.toString() || '';
      }

      // Update completion tracking after filling this set
      if (set.winningSide === 1) setsWon1++;
      if (set.winningSide === 2) setsWon2++;
      matchAlreadyComplete = setsWon1 >= setsNeeded || setsWon2 >= setsNeeded;
    });
  } else {
    updateMatchUpDisplay();
  }

  // Initialize irregular ending and winner if present
  // Only set selectedOutcome if it's an actual irregular ending (not TO_BE_PLAYED)
  if (
    matchUp.matchUpStatus &&
    matchUp.matchUpStatus !== COMPLETED &&
    [RETIRED, WALKOVER, DEFAULTED].includes(matchUp.matchUpStatus)
  ) {
    selectedOutcome = matchUp.matchUpStatus;

    // Check the appropriate irregular ending radio button
    const outcomeRadios = irregularEndingContainer.querySelectorAll<HTMLInputElement>('input[name="matchOutcome"]');
    outcomeRadios.forEach((radio) => {
      if (radio.value === matchUp.matchUpStatus) {
        radio.checked = true;
      }
    });

    // Initialize winner if present
    if (matchUp.winningSide) {
      selectedWinner = matchUp.winningSide;

      // Check the appropriate winner radio button
      const winnerRadios = irregularEndingContainer.querySelectorAll<HTMLInputElement>('input[name="irregularWinner"]');
      winnerRadios.forEach((radio) => {
        if (Number.parseInt(radio.value) === matchUp.winningSide) {
          radio.checked = true;
        }
      });

      // Show winner selection container
      winnerSelectionContainer.style.display = 'block';
    }
  }

  // Trigger final update after all initialization
  if (matchUp.score?.sets && matchUp.score.sets.length > 0) {
    updateScoreFromInputs();
  } else {
    // For fresh matchUp with no score, hide irregular ending section
    // It will be shown automatically when user starts entering incomplete scores
    if (selectedOutcome === COMPLETED) {
      irregularEndingContainer.style.display = 'none';
      winnerSelectionContainer.style.display = 'none';
    }
  }

  // Focus first input
  setTimeout(() => {
    const firstInput = setsContainer.querySelector('input') as HTMLInputElement;
    if (firstInput) firstInput.focus();
  }, 100);
}

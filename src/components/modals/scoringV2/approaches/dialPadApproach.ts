/**
 * Dial Pad score entry approach
 * Intuitive digit-by-digit entry with intelligent auto-completion
 */
import { renderMatchUp } from 'courthive-components';
import { tournamentEngine, matchUpFormatCode } from 'tods-competition-factory';
import { tidyScore } from '../utils/scoreValidator';
import type { RenderScoreEntryParams, SetScore, ScoreOutcome } from '../types';
import { env } from 'settings/env';

type Phase = 'side1' | 'side2' | 'tiebreak_side1' | 'tiebreak_side2';

type EntryState = {
  currentSetIndex: number;
  currentPhase: Phase;
  pendingDigits: string;
  completedSets: SetScore[];
  matchUpFormat: any;
};

export function renderDialPadScoreEntry(params: RenderScoreEntryParams): void {
  console.log('renderDialPadScoreEntry called', params);
  const { matchUp, container, onScoreChange } = params;

  try {
    // Clear container
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '1em';

    const scaleAttributes = env.scales[env.activeScale];
    console.log('scaleAttributes:', scaleAttributes);

  // Parse match format
  const parsedFormat = matchUpFormatCode.parse(matchUp.matchUpFormat || 'SET3-S:6/TB7');
  const setTo = parsedFormat?.setFormat?.setTo || 6;
  const tiebreakAt = parsedFormat?.setFormat?.tiebreakAt || setTo;
  const bestOf = parsedFormat?.bestOf || 3;

  // Initialize state
  const state: EntryState = {
    currentSetIndex: 0,
    currentPhase: 'side1',
    pendingDigits: '',
    completedSets: [],
    matchUpFormat: parsedFormat,
  };

  // MatchUp display container
  const matchUpContainer = document.createElement('div');
  matchUpContainer.style.marginBottom = '1em';
  container.appendChild(matchUpContainer);

  // Render matchUp at top
  renderMatchUp({
    matchUp,
    scaleAttributes,
    element: matchUpContainer,
    highlighted: false,
    displayFormat: true,
  });

  // Current score display (light blue)
  const scoreDisplay = document.createElement('div');
  scoreDisplay.style.fontSize = '2em';
  scoreDisplay.style.color = '#64B5F6'; // Light blue
  scoreDisplay.style.textAlign = 'center';
  scoreDisplay.style.padding = '0.5em';
  scoreDisplay.style.fontWeight = 'bold';
  scoreDisplay.style.minHeight = '1.5em';
  scoreDisplay.textContent = '-';
  container.appendChild(scoreDisplay);

  // Dial pad container
  const dialPadContainer = document.createElement('div');
  dialPadContainer.style.display = 'grid';
  dialPadContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
  dialPadContainer.style.gap = '0.5em';
  dialPadContainer.style.maxWidth = '300px';
  dialPadContainer.style.margin = '0 auto';
  container.appendChild(dialPadContainer);

  // Helper: Update score display
  const updateScoreDisplay = () => {
    const scoreString = formatCurrentScore(state);
    scoreDisplay.textContent = scoreString || '-';
    
    // Validate and notify
    const outcome = validateCurrentScore(state, matchUp);
    onScoreChange(outcome);
  };

  // Helper: Format current score for display
  function formatCurrentScore(state: EntryState): string {
    const sets: SetScore[] = [...state.completedSets];
    
    // Add current set being entered
    if (state.currentSetIndex < bestOf) {
      const currentSet: SetScore = {};
      
      if (state.currentPhase === 'side1') {
        if (state.pendingDigits) {
          currentSet.side1Score = parseInt(state.pendingDigits);
        }
      } else if (state.currentPhase === 'side2') {
        // Get side1 from last completed phase
        currentSet.side1Score = getCurrentSetSide1(state);
        if (state.pendingDigits) {
          currentSet.side2Score = parseInt(state.pendingDigits);
        }
      } else if (state.currentPhase === 'tiebreak_side1') {
        currentSet.side1Score = getCurrentSetSide1(state);
        currentSet.side2Score = getCurrentSetSide2(state);
        if (state.pendingDigits) {
          currentSet.side1TiebreakScore = parseInt(state.pendingDigits);
        }
      } else if (state.currentPhase === 'tiebreak_side2') {
        currentSet.side1Score = getCurrentSetSide1(state);
        currentSet.side2Score = getCurrentSetSide2(state);
        currentSet.side1TiebreakScore = getCurrentSetTiebreakSide1(state);
        if (state.pendingDigits) {
          currentSet.side2TiebreakScore = parseInt(state.pendingDigits);
        }
      }
      
      sets.push(currentSet);
    }
    
    // Use factory's generateMatchUpOutcomeString
    try {
      const result = tournamentEngine.generateMatchUpOutcomeString({ sets });
      return result?.outcome || '';
    } catch {
      // Fallback to manual formatting
      return sets
        .map(set => {
          let str = `${set.side1Score || 0}-${set.side2Score || 0}`;
          if (set.side1TiebreakScore !== undefined || set.side2TiebreakScore !== undefined) {
            str += `(${set.side1TiebreakScore || 0}-${set.side2TiebreakScore || 0})`;
          }
          return str;
        })
        .join(' ');
    }
  }

  // Helper: Get current set's side1 score
  function getCurrentSetSide1(state: EntryState): number | undefined {
    // Look in temporary storage or completed side
    if (state.currentPhase === 'side1' && state.pendingDigits) {
      return parseInt(state.pendingDigits);
    }
    // Must have been completed - reconstruct from where we are
    return (state as any).tempSide1;
  }

  // Helper: Get current set's side2 score
  function getCurrentSetSide2(state: EntryState): number | undefined {
    if (state.currentPhase === 'side2' && state.pendingDigits) {
      return parseInt(state.pendingDigits);
    }
    return (state as any).tempSide2;
  }

  // Helper: Get current set's tiebreak side1 score
  function getCurrentSetTiebreakSide1(state: EntryState): number | undefined {
    if (state.currentPhase === 'tiebreak_side1' && state.pendingDigits) {
      return parseInt(state.pendingDigits);
    }
    return (state as any).tempTiebreakSide1;
  }

  // Helper: Detect if we should enter tiebreak mode
  function shouldEnterTiebreak(side1: number, side2: number): boolean {
    // Check if scores indicate tiebreak (e.g., 6-6, 7-6, 6-7 with tiebreakAt)
    if (side1 === tiebreakAt && side2 === tiebreakAt) return true;
    if (side1 === tiebreakAt + 1 && side2 === tiebreakAt) return true;
    if (side2 === tiebreakAt + 1 && side1 === tiebreakAt) return true;
    return false;
  }

  // Helper: Check if set is complete (no tiebreak)
  function isSetComplete(side1: number, side2: number): boolean {
    const higher = Math.max(side1, side2);
    const lower = Math.min(side1, side2);
    return higher >= setTo && higher - lower >= 2;
  }

  // Helper: Validate and create outcome
  function validateCurrentScore(state: EntryState, matchUp: any): ScoreOutcome {
    const scoreString = formatCurrentScore(state);
    
    if (!scoreString || scoreString === '-') {
      return {
        isValid: false,
        sets: [],
        error: 'Enter a score',
      };
    }

    // Use tidyScore for validation
    const tidyResult = tidyScore(scoreString);
    
    if (tidyResult.error) {
      return {
        isValid: false,
        sets: state.completedSets,
        error: tidyResult.error,
      };
    }

    return {
      isValid: true,
      sets: state.completedSets,
      score: tidyResult.tidyScore,
      matchUpStatus: tidyResult.matchUpStatus,
      matchUpFormat: matchUp.matchUpFormat,
    };
  }

  // Handle digit press
  const handleDigitPress = (digit: number) => {
    let value = digit;
    
    // Smart capping: if digit > setTo, cap it
    if (state.currentPhase === 'side1' || state.currentPhase === 'side2') {
      if (digit > setTo) {
        value = setTo;
      }
    }
    
    state.pendingDigits += value.toString();
    
    // Check if we should auto-advance
    const pendingValue = parseInt(state.pendingDigits);
    
    if (state.currentPhase === 'side1') {
      // Advance if >= setTo or two digits entered
      if (pendingValue >= setTo || state.pendingDigits.length >= 2) {
        (state as any).tempSide1 = pendingValue;
        state.pendingDigits = '';
        state.currentPhase = 'side2';
      }
    } else if (state.currentPhase === 'side2') {
      // Check if two digits or should advance
      if (state.pendingDigits.length >= 2 || pendingValue >= setTo) {
        const side1 = (state as any).tempSide1;
        const side2 = pendingValue;
        
        (state as any).tempSide2 = side2;
        
        // Check if tiebreak or set complete
        if (shouldEnterTiebreak(side1, side2)) {
          state.pendingDigits = '';
          state.currentPhase = 'tiebreak_side1';
        } else if (isSetComplete(side1, side2)) {
          // Set complete - add to completed sets
          state.completedSets.push({
            side1Score: side1,
            side2Score: side2,
            winningSide: side1 > side2 ? 1 : 2,
          });
          
          // Move to next set
          state.currentSetIndex++;
          state.currentPhase = 'side1';
          state.pendingDigits = '';
          delete (state as any).tempSide1;
          delete (state as any).tempSide2;
        } else {
          state.pendingDigits = '';
        }
      }
    } else if (state.currentPhase === 'tiebreak_side1') {
      // Wait for minus key to terminate
    } else if (state.currentPhase === 'tiebreak_side2') {
      // Wait for minus key to terminate
    }
    
    updateScoreDisplay();
  };

  // Handle minus key
  const handleMinusPress = () => {
    if (state.currentPhase === 'tiebreak_side1' && state.pendingDigits) {
      (state as any).tempTiebreakSide1 = parseInt(state.pendingDigits);
      state.pendingDigits = '';
      state.currentPhase = 'tiebreak_side2';
    } else if (state.currentPhase === 'tiebreak_side2' && state.pendingDigits) {
      // Tiebreak complete
      const side1 = (state as any).tempSide1;
      const side2 = (state as any).tempSide2;
      const tb1 = (state as any).tempTiebreakSide1;
      const tb2 = parseInt(state.pendingDigits);
      
      state.completedSets.push({
        side1Score: side1,
        side2Score: side2,
        side1TiebreakScore: tb1,
        side2TiebreakScore: tb2,
        winningSide: tb1 > tb2 ? 1 : 2,
      });
      
      // Move to next set
      state.currentSetIndex++;
      state.currentPhase = 'side1';
      state.pendingDigits = '';
      delete (state as any).tempSide1;
      delete (state as any).tempSide2;
      delete (state as any).tempTiebreakSide1;
    }
    
    updateScoreDisplay();
  };

  // Handle delete
  const handleDelete = () => {
    if (state.pendingDigits.length > 0) {
      // Remove last digit
      state.pendingDigits = state.pendingDigits.slice(0, -1);
    } else {
      // Step back to previous phase
      if (state.currentPhase === 'side2') {
        state.currentPhase = 'side1';
        state.pendingDigits = (state as any).tempSide1?.toString() || '';
        delete (state as any).tempSide1;
      } else if (state.currentPhase === 'tiebreak_side1') {
        state.currentPhase = 'side2';
        state.pendingDigits = (state as any).tempSide2?.toString() || '';
        delete (state as any).tempSide2;
      } else if (state.currentPhase === 'tiebreak_side2') {
        state.currentPhase = 'tiebreak_side1';
        state.pendingDigits = (state as any).tempTiebreakSide1?.toString() || '';
        delete (state as any).tempTiebreakSide1;
      } else if (state.currentPhase === 'side1' && state.currentSetIndex > 0) {
        // Go back to previous set
        const prevSet = state.completedSets.pop();
        if (prevSet) {
          state.currentSetIndex--;
          if (prevSet.side1TiebreakScore !== undefined) {
            // Was in tiebreak
            state.currentPhase = 'tiebreak_side2';
            state.pendingDigits = prevSet.side2TiebreakScore?.toString() || '';
            (state as any).tempSide1 = prevSet.side1Score;
            (state as any).tempSide2 = prevSet.side2Score;
            (state as any).tempTiebreakSide1 = prevSet.side1TiebreakScore;
          } else {
            // Regular set
            state.currentPhase = 'side2';
            state.pendingDigits = prevSet.side2Score?.toString() || '';
            (state as any).tempSide1 = prevSet.side1Score;
          }
        }
      }
    }
    
    updateScoreDisplay();
  };

  // Create dial pad buttons
  const buttons = [
    { label: '1', value: 1 },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 },
    { label: '6', value: 6 },
    { label: '7', value: 7 },
    { label: '8', value: 8 },
    { label: '9', value: 9 },
    { label: '⌫', value: 'delete', isSpecial: true },
    { label: '0', value: 0 },
    { label: '-', value: 'minus', isSpecial: true },
  ];

  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.className = 'button is-large';
    button.textContent = btn.label;
    button.style.fontSize = '1.5em';
    button.style.height = '60px';
    
    if (btn.isSpecial) {
      button.style.backgroundColor = '#f0f0f0';
    }
    
    button.onclick = () => {
      if (btn.value === 'delete') {
        handleDelete();
      } else if (btn.value === 'minus') {
        handleMinusPress();
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
      handleDigitPress(parseInt(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      handleDelete();
    } else if (e.key === '-' || e.key === 'Minus') {
      e.preventDefault();
      handleMinusPress();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  
  // Cleanup on modal close
  const cleanup = () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
  
  // Store cleanup function
  (window as any).cleanupDialPad = cleanup;

  // Initial display
  updateScoreDisplay();
  
  console.log('Dial pad rendered successfully');
  } catch (error) {
    console.error('Error rendering dial pad:', error);
    container.innerHTML = `<p style="color: red;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>`;
  }
}

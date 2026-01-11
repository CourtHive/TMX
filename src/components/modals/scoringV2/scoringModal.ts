/**
 * Modern TypeScript scoring modal
 * Supports multiple scoring approaches with validation
 */
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderTidyScoreEntry } from './approaches/tidyScoreApproach';
import { renderFreeScoreEntry } from './approaches/freeScoreApproach';
import { renderDynamicSetsScoreEntry } from './approaches/dynamicSetsApproach';
import { renderDialPadScoreEntry } from './approaches/dialPadApproach';
import type { ScoringModalParams, ScoreOutcome } from './types';
import { env } from 'settings/env';

export function scoringModal(params: ScoringModalParams): void {
  const { matchUp, callback } = params;
  
  // Choose approach based on env setting
  const approach = env.scoringApproach || 'tidyScore';
  
  const container = document.createElement('div');
  container.style.padding = '1em';
  
  // Track if matchUp had an existing score/status
  const hadExistingScore = !!(matchUp.score?.sets?.length || matchUp.matchUpStatus);
  let currentOutcome: ScoreOutcome | null = null;
  let wasCleared = false; // Track if user has cleared the score
  
  const handleScoreChange = (outcome: ScoreOutcome) => {
    currentOutcome = outcome;
    
    // If user enters anything after clearing, mark as no longer cleared
    if (wasCleared && (outcome.sets?.length > 0 || outcome.score)) {
      wasCleared = false;
    }
    
    // Enable/disable submit button based on validity
    const submitBtn = document.getElementById('submitScoreV2') as HTMLButtonElement;
    if (submitBtn) {
      // Submit should be enabled if:
      // 1. Score is valid (normal case), OR
      // 2. User cleared an existing score (wasCleared=true and hadExistingScore=true)
      const canSubmit = outcome.isValid || (wasCleared && hadExistingScore);
      submitBtn.disabled = !canSubmit;
    }
    
    // Enable/disable clear button based on whether there's input
    const clearBtn = document.getElementById('clearScoreV2') as HTMLButtonElement;
    if (clearBtn) {
      // For text-based approaches (freeScore, tidyScore), check input field
      const scoreInput = document.getElementById('scoreInputV2') as HTMLInputElement;
      if (scoreInput) {
        clearBtn.disabled = !scoreInput.value.trim();
      } else {
        // For other approaches (dynamicSets, dialPad), check if there are sets OR irregular ending status
        const hasSets = outcome.sets && outcome.sets.length > 0;
        const hasIrregularStatus = outcome.matchUpStatus && 
                                   outcome.matchUpStatus !== 'COMPLETED' && 
                                   outcome.matchUpStatus !== 'TO_BE_PLAYED';
        const hasContentToClear = hasSets || hasIrregularStatus;
        clearBtn.disabled = !hasContentToClear;
      }
    }
  };

  // Cleanup function to call when modal closes
  const cleanupCurrentApproach = () => {
    if ((window as any).cleanupDialPad) {
      (window as any).cleanupDialPad();
      (window as any).cleanupDialPad = undefined;
    }
    if ((window as any).resetDialPad) {
      (window as any).resetDialPad = undefined;
    }
    if ((window as any).resetDynamicSets) {
      (window as any).resetDynamicSets = undefined;
    }
  };
  
  if (approach === 'tidyScore') {
    renderTidyScoreEntry({
      matchUp,
      container,
      onScoreChange: handleScoreChange,
    });
  } else if (approach === 'freeScore') {
    renderFreeScoreEntry({
      matchUp,
      container,
      onScoreChange: handleScoreChange,
    });
  } else if (approach === 'dynamicSets') {
    renderDynamicSetsScoreEntry({
      matchUp,
      container,
      onScoreChange: handleScoreChange,
    });
  } else if (approach === 'dialPad') {
    renderDialPadScoreEntry({
      matchUp,
      container,
      onScoreChange: handleScoreChange,
    });
  } else {
    container.innerHTML = '<p>Unknown scoring approach...</p>';
  }
  
  openModal({
    title: 'Score Entry',
    content: container,
    config: undefined,
    buttons: [
      { 
        onClick: () => {
          cleanupCurrentApproach();
          // Cancel button should NOT call callback - just close modal
        },
        label: 'Cancel', 
        intent: 'none', 
        close: true 
      },
      {
        id: 'clearScoreV2',
        label: 'Clear',
        intent: 'none',
        disabled: true, // Initially disabled (no input yet)
        close: false, // Don't close modal when clearing
        onClick: () => {
          // Mark that user has cleared the score
          wasCleared = true;
          
          if (approach === 'tidyScore' || approach === 'freeScore') {
            // Clear text input (both tidyScore and freeScore use same input ID)
            const scoreInput = document.getElementById('scoreInputV2') as HTMLInputElement;
            if (scoreInput) {
              scoreInput.value = '';
              scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
              scoreInput.focus();
            }
          } else if (approach === 'dynamicSets') {
            // Clear dynamic sets
            if ((window as any).resetDynamicSets) {
              (window as any).resetDynamicSets();
            }
          } else if (approach === 'dialPad') {
            // Clear dial pad digits
            if ((window as any).resetDialPad) {
              (window as any).resetDialPad();
            }
          }
        },
      },
      {
        id: 'submitScoreV2',
        label: 'Submit Score',
        intent: 'is-primary',
        disabled: true,
        onClick: () => {
          // Allow submission if:
          // 1. Score is valid, OR
          // 2. User cleared an existing score (to remove it)
          const canSubmit = currentOutcome && (currentOutcome.isValid || (wasCleared && hadExistingScore));
          
          if (canSubmit) {
            cleanupCurrentApproach();
            // Pass the full outcome to callback
            callback(currentOutcome);
          }
        },
        close: true,
      },
    ],
  });
  
  // Apply yellow styling to Clear button and update button states after modal opens
  setTimeout(() => {
    const clearButton = document.getElementById('clearScoreV2') as HTMLButtonElement;
    if (clearButton) {
      clearButton.style.backgroundColor = '#ffeb3b';
      clearButton.style.color = '#333';
      
      // Enable Clear button if matchUp has existing score or irregular status
      if (hadExistingScore) {
        clearButton.disabled = false;
      }
      
      // Update button states if we have an initial outcome
      if (currentOutcome) {
        handleScoreChange(currentOutcome);
      }
    }
  }, 0);
}

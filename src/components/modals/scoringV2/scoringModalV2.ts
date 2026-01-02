/**
 * Modern TypeScript scoring modal (V2)
 * Supports multiple scoring approaches with validation
 */
import { openModal } from 'components/modals/baseModal/baseModal';
import { renderFreeTextScoreEntry } from './approaches/freeTextApproach';
import { renderDynamicSetsScoreEntry } from './approaches/dynamicSetsApproach';
import { renderDialPadScoreEntry } from './approaches/dialPadApproach';
import type { ScoringModalParams, ScoreOutcome } from './types';
import { env } from 'settings/env';

export function scoringModalV2(params: ScoringModalParams): void {
  const { matchUp, callback } = params;
  
  // Choose approach based on env setting
  const approach = env.scoringApproach || 'freeText';
  console.log('Scoring approach:', approach);
  
  const container = document.createElement('div');
  container.style.padding = '1em';
  
  let currentOutcome: ScoreOutcome | null = null;
  
  const handleScoreChange = (outcome: ScoreOutcome) => {
    currentOutcome = outcome;
    
    // Enable/disable submit button based on validity
    const submitBtn = document.getElementById('submitScoreV2') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.disabled = !outcome.isValid;
    }
    
    // Enable/disable clear button based on whether there's input
    const clearBtn = document.getElementById('clearScoreV2') as HTMLButtonElement;
    const scoreInput = document.getElementById('scoreInputV2') as HTMLInputElement;
    if (clearBtn && scoreInput) {
      clearBtn.disabled = !scoreInput.value.trim();
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
  
  if (approach === 'freeText') {
    renderFreeTextScoreEntry({
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
    config: approach === 'dialPad' ? { maxWidth: 380 } : undefined,
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
          if (approach === 'freeText') {
            // Clear free text input
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
          if (currentOutcome && currentOutcome.isValid) {
            cleanupCurrentApproach();
            // Pass the full outcome to callback
            callback(currentOutcome);
          }
        },
        close: true,
      },
    ],
  });
  
  // Apply yellow styling to Clear button after modal opens
  setTimeout(() => {
    const clearButton = document.getElementById('clearScoreV2') as HTMLButtonElement;
    if (clearButton) {
      clearButton.style.backgroundColor = '#ffeb3b';
      clearButton.style.color = '#333';
    }
  }, 0);
}

import { scoringModal } from '../scoringModal';

// Mock matchUp data
const mockMatchUp = {
  matchUpId: 'test-1',
  matchUpFormat: 'SET3-S:6/TB7',
  sides: [
    {
      sideNumber: 1,
      participant: {
        participantName: 'Player 1',
        participantId: 'p1',
      },
    },
    {
      sideNumber: 2,
      participant: {
        participantName: 'Player 2',
        participantId: 'p2',
      },
    },
  ],
};

const mockMatchUpWithScore = {
  ...mockMatchUp,
  score: {
    sets: [
      { side1Score: 6, side2Score: 3, winningSide: 1 },
      { side1Score: 2, side2Score: 6, winningSide: 2 },
    ],
  },
};

const mockMatchUpRetired = {
  ...mockMatchUp,
  score: {
    sets: [{ side1Score: 6, side2Score: 3, winningSide: 1 }],
  },
  matchUpStatus: 'RETIRED',
  winningSide: 1,
};

const meta = {
  title: 'Modals/Scoring Modal V2',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    approach: {
      control: 'select',
      options: ['tidyScore', 'freeScore', 'dynamicSets', 'dialPad'],
      description: 'Scoring approach to use',
    },
  },
};

export default meta;

// Story: Empty Match
export const EmptyMatch = {
  render: () => {
    const div = document.createElement('div');
    div.innerHTML = '<button id="open-modal">Open Scoring Modal (Empty Match)</button>';
    
    div.querySelector('#open-modal')?.addEventListener('click', () => {
      scoringModal({
        matchUp: mockMatchUp,
        callback: (outcome) => {
          console.log('Score submitted:', outcome);
          alert(`Score: ${JSON.stringify(outcome, null, 2)}`);
        },
      });
    });
    
    return div;
  },
};

// Story: Match with Existing Score
export const MatchWithScore = {
  render: () => {
    const div = document.createElement('div');
    div.innerHTML = '<button id="open-modal">Open Scoring Modal (With Score)</button>';
    
    div.querySelector('#open-modal')?.addEventListener('click', () => {
      scoringModal({
        matchUp: mockMatchUpWithScore,
        callback: (outcome) => {
          console.log('Score submitted:', outcome);
          alert(`Score: ${JSON.stringify(outcome, null, 2)}`);
        },
      });
    });
    
    return div;
  },
};

// Story: Match with Retired Status
export const RetiredMatch = {
  render: () => {
    const div = document.createElement('div');
    div.innerHTML = '<button id="open-modal">Open Scoring Modal (Retired)</button>';
    
    div.querySelector('#open-modal')?.addEventListener('click', () => {
      scoringModal({
        matchUp: mockMatchUpRetired,
        callback: (outcome) => {
          console.log('Score submitted:', outcome);
          alert(`Score: ${JSON.stringify(outcome, null, 2)}`);
        },
      });
    });
    
    return div;
  },
};

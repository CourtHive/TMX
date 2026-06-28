import { mountRoundProfileEditor, type RoundProfileEditorController } from './roundProfileEditor';
import type { Meta, StoryObj } from '@storybook/html-vite';

type StoryArgs = {
  drawSize: number;
  initialProfile?: number[];
};

const meta: Meta<StoryArgs> = {
  title: 'Components/RoundProfileEditor',
  argTypes: {
    drawSize: {
      control: { type: 'number', min: 2, step: 2 },
      description: 'Total number of participants (must be even).',
    },
    initialProfile: {
      control: { type: 'object' },
      description: 'Per-round matchUp counts. If omitted, the ceil-halving default is used.',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '420px';
    container.style.padding = '12px';

    // Live readout of the current profile, so the story doubles as a manual
    // smoke test for the cascading-defaults and "+N LL" badges.
    const readout = document.createElement('pre');
    readout.style.fontSize = '12px';
    readout.style.marginTop = '12px';
    readout.style.padding = '8px';
    readout.style.background = 'var(--tmx-bg-secondary, #f5f5f5)';
    readout.style.borderRadius = '3px';
    readout.style.color = 'var(--tmx-text-primary, #222)';

    let controller: RoundProfileEditorController | undefined;
    const updateReadout = (profile: number[] | null) => {
      if (!profile) {
        readout.textContent = 'profile: <invalid>';
        return;
      }
      const llCounts: number[] = [];
      for (let i = 0; i < profile.length - 1; i++) {
        llCounts.push(2 * profile[i + 1] - profile[i]);
      }
      readout.textContent =
        `roundProfile (matchUps): [${profile.join(', ')}]\n` +
        `LL per transition:       [${llCounts.join(', ')}]\n` +
        `R1 players:              ${profile[0] * 2}`;
    };

    controller = mountRoundProfileEditor(container, {
      drawSize: args.drawSize,
      initialProfile: args.initialProfile,
      onChange: updateReadout,
    });

    container.appendChild(readout);
    updateReadout(controller.getProfile());
    return container;
  },
};

export default meta;

type Story = StoryObj<StoryArgs>;

/**
 * The exact scenario from design discussion: drawSize 40, profile [20, 12, 8, 4, 2, 1].
 * R1→R2 needs 4 LL, R2→R3 needs 4 LL, the rest are clean halvings.
 */
export const DrawSize40_Custom: Story = {
  name: 'drawSize 40 — [20, 12, 8, 4, 2, 1]',
  args: {
    drawSize: 40,
    initialProfile: [20, 12, 8, 4, 2, 1],
  },
};

/** Default ceil-halving cascade for drawSize 40 — equivalent to a regular LUCKY_DRAW. */
export const DrawSize40_DefaultCascade: Story = {
  name: 'drawSize 40 — default ceil-halving',
  args: {
    drawSize: 40,
  },
};

/** Power-of-2 drawSize. No LL needed in any transition; all cells fall on natural halves. */
export const DrawSize32_PureHalving: Story = {
  name: 'drawSize 32 — pure halving',
  args: {
    drawSize: 32,
  },
};

/** Larger draw with a stretched 2nd round to force LL into R2. */
export const DrawSize64_StretchedR2: Story = {
  name: 'drawSize 64 — [32, 20, 10, 5, 3, 2, 1]',
  args: {
    drawSize: 64,
    initialProfile: [32, 20, 10, 5, 3, 2, 1],
  },
};

/** Odd drawSize — editor renders the "requires even" notice and getProfile() returns null. */
export const DrawSize11_Disabled: Story = {
  name: 'drawSize 11 — disabled (odd)',
  args: {
    drawSize: 11,
  },
};

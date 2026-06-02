/**
 * Live stories for the lucky-loser picker modal.
 *
 * Each story seeds a tournament via mocksEngine with `completeAllMatchUps: true`,
 * loads it into `tournamentEngine`, then renders a launcher button. Clicking
 * the button opens the actual `luckyLoserSelection` modal against the seeded
 * state — so the picker's row interactions, counter, and Advance button all
 * exercise the real code path. Mutation submit fires `mutationRequest`, which
 * in Storybook (no Socket.IO) will fall back to local execution; the picker
 * UX is what we're demoing, not the persistence.
 */
import type { Meta, StoryObj } from '@storybook/html-vite';
import { mocksEngine, drawDefinitionConstants } from 'tods-competition-factory';

import { luckyLoserSelection } from './luckyLoserSelection';
import { mountRoundProfileEditor } from '../drawers/addDraw/roundProfileEditor';
import { tournamentEngine } from 'services/factory/engine';

const { LUCKY_DRAW } = drawDefinitionConstants;

type StoryArgs = Record<string, never>;

type SeededDraw = {
  drawId: string;
  structureId: string;
  drawType: string;
  drawSize: number;
};

function seedDraw(args: { drawSize: number; drawType: string; roundProfile?: number[] }): SeededDraw {
  const drawProfile: any = {
    drawSize: args.drawSize,
    drawType: args.drawType,
  };
  if (args.roundProfile) drawProfile.roundProfile = args.roundProfile;

  const { tournamentRecord, drawIds } = mocksEngine.generateTournamentRecord({
    completeAllMatchUps: true,
    drawProfiles: [drawProfile],
  });
  tournamentEngine.setState(tournamentRecord);

  const drawId = drawIds?.[0] ?? '';
  // Pull structureId from the just-created tournament.
  const tr: any = tournamentEngine.getState().tournamentRecord;
  const drawDef = tr?.events?.flatMap((e: any) => e.drawDefinitions ?? []).find((d: any) => d.drawId === drawId);
  const structureId = drawDef?.structures?.[0]?.structureId ?? '';

  return { drawId, structureId, drawType: args.drawType, drawSize: args.drawSize };
}

function buildLauncher(label: string, onClick: () => void, info: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.padding = '12px';
  wrap.style.maxWidth = '520px';

  const blurb = document.createElement('div');
  blurb.style.marginBottom = '12px';
  blurb.style.fontSize = '13px';
  blurb.style.color = 'var(--tmx-text-secondary, #555)';
  blurb.textContent = info;
  wrap.appendChild(blurb);

  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.padding = '8px 14px';
  btn.style.background = 'var(--tmx-accent-blue, #2979ff)';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.borderRadius = '4px';
  btn.style.cursor = 'pointer';
  btn.style.fontWeight = '600';
  btn.addEventListener('click', onClick);
  wrap.appendChild(btn);

  return wrap;
}

const meta: Meta<StoryArgs> = {
  title: 'Modals/LuckyLoserSelection',
};
export default meta;

type Story = StoryObj<StoryArgs>;

/**
 * Standard LUCKY_DRAW, drawSize 11 → round 1 has 6 matchUps, round 2 needs 1 LL.
 * Single-select UX: clicking a different row replaces the prior selection.
 */
export const Standard_SingleLL: Story = {
  name: 'Standard LUCKY_DRAW — drawSize 11, 1 LL',
  render: () => {
    const { drawId, structureId } = seedDraw({ drawSize: 11, drawType: LUCKY_DRAW });
    return buildLauncher(
      'Open LL Picker for Round 1',
      () => luckyLoserSelection({ drawId, structureId, roundNumber: 1, callback: () => undefined }),
      'Standard LUCKY_DRAW with drawSize 11. Round 1 (6 matchUps) is complete; round 2 needs 1 LL. ' +
        'Clicking a row selects it and enables "Advance Selected".',
    );
  },
};

/**
 * LUCKY_DRAW with explicit roundProfile [20, 12, 8, 4, 2, 1]: 40 players → 12 matchUps in R2,
 * which needs 4 LL (20 winners + 4 LL = 24 = 12 × 2). The picker should require exactly 4
 * row selections before "Advance 4 Selected" enables; counter shows live "Selected: M / 4".
 */
export const Custom_FourLL: Story = {
  name: 'LUCKY_DRAW + roundProfile — drawSize 40, [20, 12, 8, 4, 2, 1], 4 LL',
  render: () => {
    const { drawId, structureId } = seedDraw({
      drawSize: 40,
      drawType: LUCKY_DRAW,
      roundProfile: [20, 12, 8, 4, 2, 1],
    });
    return buildLauncher(
      'Open LL Picker for Round 1 (pick 4)',
      () => luckyLoserSelection({ drawId, structureId, roundNumber: 1, callback: () => undefined }),
      'LUCKY_DRAW with explicit roundProfile [20, 12, 8, 4, 2, 1]. R1 produces 20 winners; ' +
        'R2 has 12 matchUps (24 slots), so 4 lucky losers are needed. The picker enforces ' +
        'exactly 4 selections — clicking past the cap warns instead of replacing.',
    );
  },
};

/**
 * Integrated: round-profile editor on the left, LL picker launcher on the right.
 * Edit the profile to change the LL count for R1→R2; click "Open LL Picker" to
 * see the modal with the corresponding `requiredLuckyLoserCount`. The seed
 * regenerates whenever the editor's onChange fires, so the picker always reflects
 * the current profile.
 */
export const Integrated_EditorAndPicker: Story = {
  name: 'Integrated — editor + live picker',
  render: () => {
    const root = document.createElement('div');
    root.style.display = 'grid';
    root.style.gridTemplateColumns = '1fr 1fr';
    root.style.gap = '24px';
    root.style.maxWidth = '900px';
    root.style.padding = '16px';

    const editorCol = document.createElement('div');
    const pickerCol = document.createElement('div');
    root.append(editorCol, pickerCol);

    const initialProfile = [20, 12, 8, 4, 2, 1];
    let currentProfile: number[] = initialProfile;
    let seeded: SeededDraw = seedDraw({
      drawSize: initialProfile[0] * 2,
      drawType: LUCKY_DRAW,
      roundProfile: initialProfile,
    });

    const reseed = (profile: number[]) => {
      currentProfile = profile;
      seeded = seedDraw({
        drawSize: profile[0] * 2,
        drawType: LUCKY_DRAW,
        roundProfile: profile,
      });
      updatePickerColumn();
    };

    const mountEditor = () => {
      mountRoundProfileEditor(editorCol, {
        drawSize: initialProfile[0] * 2,
        initialProfile,
        onChange: (profile) => {
          if (profile) reseed(profile);
        },
      });
    };

    const updatePickerColumn = () => {
      pickerCol.innerHTML = '';
      // The picker reads requiredLuckyLoserCount from getLuckyDrawRoundStatus
      // (which derives it from the customRoundProfile extension on the structure).
      // We display the same calc here for the blurb so the user can predict
      // what the modal will require for R1→R2: 2 * profile[1] - profile[0].
      const requiredR1 = currentProfile.length >= 2 ? 2 * currentProfile[1] - currentProfile[0] : 0;
      const launcher = buildLauncher(
        `Open LL Picker for R1 (pick ${requiredR1})`,
        () =>
          luckyLoserSelection({
            drawId: seeded.drawId,
            structureId: seeded.structureId,
            roundNumber: 1,
            callback: () => undefined,
          }),
        `Live picker against the currently-seeded tournament (drawSize ${seeded.drawSize}, ` +
          `profile [${currentProfile.join(', ')}]). Edit the round profile on the left and the ` +
          `seed regenerates; click below to open the picker. The modal reads the required count ` +
          `from getLuckyDrawRoundStatus, so it always matches the profile.`,
      );
      pickerCol.appendChild(launcher);
    };

    mountEditor();
    updatePickerColumn();

    return root;
  },
};

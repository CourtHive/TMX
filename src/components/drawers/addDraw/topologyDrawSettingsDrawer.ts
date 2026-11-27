/**
 * The Configure draw drawer the topology builder's Generate opens: the Add Draw drawer's settings
 * that the topology does not already define — score format, seeding policy, seeds, creation and (TEAM) scorecard.
 * The draw's name, type, size and structures come from the canvas, so their fields are not offered again.
 *
 * The fields are the Add Draw form's own items (`getDrawFormItems`), so provider limits — allowed score formats and
 * creation methods, a locked seeding policy — apply here exactly as they do there. A score format set on the Main
 * structure's card is the topology's; the field is then left out.
 */
import { topologyDrawSettings, type TopologyDrawSettings, type TopologyMain } from './topologyDrawSettings';
import { getMatchUpFormatModal, renderButtons, renderForm, renderOptions } from 'courthive-components';
import { editTieFormat } from 'components/overlays/editTieFormat.js/editTieFormat';
import { getMatchFormatLabels } from 'components/modals/matchFormatLabels';
import { buildSeedCountOptions, isSeedableDrawType } from './seedCount';
import { getSeedingAllowance, INHERIT } from './seedingPolicies';
import { removeAllChildNodes } from 'services/dom/transformers';
import { getDrawFormItems } from './getDrawFormItems';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import { AUTOMATED, CUSTOM, MATCHUP_FORMAT, NONE, RIGHT, SEEDING_POLICY, SEEDS_COUNT } from 'constants/tmxConstants';

const TIE_FORMAT_NAME = 'tieFormatName';
const TEAM_EVENT = 'TEAM';

function seedCountOptions({
  eventId,
  main,
  seedingPolicy,
}: {
  eventId: string;
  main: TopologyMain;
  seedingPolicy?: string;
}) {
  return buildSeedCountOptions({
    ...getSeedingAllowance({
      selectedSeedingPolicy: seedingPolicy || INHERIT,
      participantsCount: main.entriesCount,
      drawSize: main.drawSize,
      eventId,
    }),
    participantsCount: main.entriesCount,
    drawType: main.drawType,
    drawSize: main.drawSize,
  }).map((option, index) => (index ? option : { ...option, selected: true }));
}

export function openTopologyDrawSettings({
  event,
  main,
  onSubmit,
}: {
  event: any;
  main: TopologyMain;
  onSubmit: (settings: TopologyDrawSettings) => void;
}): void {
  const eventId = event.eventId;
  const fields = new Set([AUTOMATED, SEEDING_POLICY, SEEDS_COUNT, TIE_FORMAT_NAME]);
  if (!main.matchUpFormat) fields.add(MATCHUP_FORMAT);
  if (!isSeedableDrawType(main.drawType)) fields.delete(SEEDS_COUNT);

  const { items } = getDrawFormItems({ event, mode: { kind: 'NEW_MAIN', event } });
  const formItems = items
    .filter((item: any) => fields.has(item.field))
    .map((item: any) => {
      // the Add Draw form sizes its seed choices for its own draw; here the Main is the topology's
      if (item.field === SEEDS_COUNT) return { ...item, options: seedCountOptions({ eventId, main }), visible: true };
      return item.field === AUTOMATED ? { ...item, help: undefined } : item;
    });

  let inputs: any;
  const relationships = [
    {
      control: SEEDING_POLICY,
      onChange: () => {
        const select = inputs?.[SEEDS_COUNT];
        if (!select) return;
        const current = select.value;
        const options = seedCountOptions({ eventId, main, seedingPolicy: inputs[SEEDING_POLICY]?.value });
        const value = options.some((option) => String(option.value) === String(current)) ? current : '';
        removeAllChildNodes(select);
        renderOptions(select, { options, value });
      },
    },
  ];

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, formItems, relationships);
  };

  const submit = () => {
    const values = {
      matchUpFormat: inputs[MATCHUP_FORMAT]?.value,
      seedingPolicy: inputs[SEEDING_POLICY]?.value,
      seedsCount: inputs[SEEDS_COUNT]?.value,
      creation: inputs[AUTOMATED]?.value,
      // the scorecard field is hidden, and holds its default, for an event that is not TEAM
      tieFormatName: event.eventType === TEAM_EVENT ? inputs[TIE_FORMAT_NAME]?.value : undefined,
    };
    const settings = topologyDrawSettings({ values, eventId, main });
    const withTieFormat = () => {
      if (values.tieFormatName !== CUSTOM) return onSubmit(settings);
      editTieFormat({
        title: t('drawers.addDraw.customScorecard'),
        tieFormat: undefined,
        onClose: (tieFormat: any) => tieFormat && onSubmit({ ...settings, tieFormat }),
      });
    };
    if (values.matchUpFormat !== CUSTOM) return withTieFormat();
    (getMatchUpFormatModal as any)({
      callback: (matchUpFormat: string) => {
        if (!matchUpFormat) return;
        settings.matchUpFormat = matchUpFormat;
        withTieFormat();
      },
      config: { labels: getMatchFormatLabels() },
    });
  };

  const buttons = [
    { label: t('common.cancel'), intent: NONE, onClick: () => context.drawer.close() },
    { label: t('drawers.addDraw.generate'), id: 'generateTopologyDraw', intent: 'is-primary', onClick: submit },
  ];
  const footer = (elem: HTMLElement, close: () => void) => renderButtons(elem, buttons, close);
  context.drawer.open({ title: t('drawers.addDraw.configureDraw'), content, footer, side: RIGHT, width: '300px' });
}

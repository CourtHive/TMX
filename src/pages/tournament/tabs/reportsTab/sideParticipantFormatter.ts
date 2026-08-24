/**
 * Reports tab — render a matchUp-grain report's side column as a clickable
 * participant instead of a bare name string.
 *
 * `participantFormatter.formatParticipant` cannot serve here: it resolves the
 * participant from `data.participant`, a single row-level key. A matchUp-grain
 * row names **two** opponents and neither is "the" participant of the row, so the
 * side being rendered has to be selected explicitly.
 *
 * The factory keeps `side1` / `side2` as plain name strings and carries the ids
 * separately, which matters — the CSV exporter stringifies each cell value, so an
 * object in `side1` would export as `[object Object]`.
 */

import { preferencesConfig } from 'config/preferencesConfig';
import { renderParticipant } from 'courthive-components';
import { scalesMap } from 'config/scalesConfig';

export function formatSideParticipant(
  onClick: (params: any) => void,
  hydratedKey: string,
): (cell: any) => HTMLElement | string {
  return (cell: any) => {
    const data = cell.getRow().getData();
    const participant = data?.[hydratedKey];
    // Not hydrated (participant absent from this tournament, or the report
    // carries no id for this side) — fall back to the plain name the factory
    // already emitted rather than rendering an empty cell.
    if (!participant) return cell.getValue() ?? '';

    const scaleAttributes = scalesMap[preferencesConfig.get().activeScale];

    const render = (individual: any) =>
      renderParticipant({
        eventHandlers: {
          participantClick: (params: any) => onClick({ ...params, cell }),
        },
        composition: {
          theme: 'default',
          configuration: {
            participantDetail: 'TEAM',
            genderColor: true,
            scaleAttributes,
            flag: false,
          },
        },
        participant: individual,
      });

    // A PAIR renders each partner as its own click target, matching the
    // participant-grain columns. `renderParticipant` alone would not: with no
    // matchUp in scope it treats the pair as a single individual.
    const individuals = participant.individualParticipants ?? [];
    if (individuals.length > 1) {
      const container = document.createElement('div');
      container.className = 'flexrow flexjustifystart';
      individuals.forEach((individual: any, index: number) => {
        const element = render(individual);
        element.style.maxWidth = 'calc(50% - 0.5em)';
        element.style.overflow = 'hidden';
        element.style.whiteSpace = 'nowrap';
        element.style.textOverflow = 'ellipsis';
        container.appendChild(element);
        if (!index) {
          const spacer = document.createElement('span');
          spacer.style.width = '1em';
          spacer.innerHTML = '&nbsp;';
          container.appendChild(spacer);
        }
      });
      return container;
    }

    return render(participant);
  };
}

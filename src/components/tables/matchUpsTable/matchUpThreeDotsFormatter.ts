/**
 * Three-dot icon formatter for the matchUps table cell.
 *
 * Adds the `.three-dot-glow` class when the matchUp has at least one active
 * crowd-scoring session in `crowdActivityIndex` (Phase 4). Otherwise renders
 * the same icon the shared `threeDots` formatter would.
 *
 * The formatter is called by Tabulator on every render of the cell, so it
 * naturally picks up the latest activity count. No explicit subscribe is
 * needed in this cell — the table-level poller triggers a row-data update
 * which causes Tabulator to re-render the cell.
 */

import { hasActiveCrowdActivity } from 'services/crowd/crowdActivityIndex';

export function matchUpThreeDotsFormatter(cell: any): string {
  const matchUpId = cell?.getData?.()?.matchUpId;
  const glow = matchUpId && hasActiveCrowdActivity(matchUpId);
  const className = glow ? 'fa fa-ellipsis-vertical three-dot-glow' : 'fa fa-ellipsis-vertical';
  return `<i class='${className}'></i>`;
}

/** Pure helper for unit tests. */
export function pickThreeDotsClassName(matchUpId: string | undefined, hasActivity: (id: string) => boolean): string {
  const glow = !!matchUpId && hasActivity(matchUpId);
  return glow ? 'fa fa-ellipsis-vertical three-dot-glow' : 'fa fa-ellipsis-vertical';
}

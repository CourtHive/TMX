/**
 * Schedule2 — how severe a scheduling issue is, and what follows from that.
 *
 * `proConflicts` reports one raw string per issue (`ERROR` / `CONFLICT` / `WARNING` /
 * `ISSUE`, the `scheduleConstants` vocabulary). Three separate surfaces then have to
 * agree about what that string means:
 *
 *   - the Issues popover paints a per-row severity swatch;
 *   - the action bar's count badge is one colour for the whole set;
 *   - the court grid decorates each cell, and an operator can now turn the
 *     warning-severity decoration off.
 *
 * Before this module the mapping lived inside `buildIssues` as a closure, so the badge
 * had no way to reach it and hardcoded a single alarming fill instead — 18 adjacency
 * warnings read exactly like 18 faults. That is the defect this module exists to make
 * un-repeatable: one place decides what a raw issue string means, and everything that
 * cares asks it.
 *
 * Deliberately pure and DOM-free. TMX runs vitest in the node environment with no jsdom,
 * so a decision that lives here is cheaply testable while the same decision inlined into
 * a style string is not. The only import is a type, which erases.
 */
import { factoryConstants } from 'tods-competition-factory';

// constants and types
import type { ScheduleIssue, ScheduleIssueSeverity } from 'courthive-components';

const { scheduleConstants } = factoryConstants;
const { SCHEDULE_ERROR, SCHEDULE_CONFLICT, SCHEDULE_WARNING, SCHEDULE_ISSUE } = scheduleConstants;

/**
 * The severity of one raw `proConflicts` issue string.
 *
 * `CONFLICT` folds into `ERROR` on purpose: a double-booked court or a player in two
 * places at once is a fault the director must resolve, not an advisory. `ISSUE` is the
 * quiet informational band (an insufficient gap), and anything unrecognised degrades to
 * `WARN` — the middle of the three, so a vocabulary the factory adds later is neither
 * silently escalated to an alarm nor silently hidden.
 */
export function severityOf(issue: string | undefined): ScheduleIssueSeverity {
  if (issue === SCHEDULE_ERROR || issue === SCHEDULE_CONFLICT) return 'ERROR';
  if (issue === SCHEDULE_ISSUE) return 'INFO';
  if (issue === SCHEDULE_WARNING) return 'WARN';
  return 'WARN';
}

/**
 * How the count badge should read for a whole set of issues: as an error only when at
 * least one of them is one.
 *
 * `INFO` collapses into `WARN` here rather than getting a third colour. The badge is a
 * single glance answering a single question — *is any of this a fault?* — and a third
 * state would make the answer harder to read, not more precise. The popover is where
 * per-issue severity is available, and it already draws all three.
 *
 * An empty set answers `WARN`, though the button is not rendered at all in that case;
 * returning the calmer of the two keeps it from being a trap if that ever changes.
 */
export function badgeSeverity(issues: ScheduleIssue[]): 'ERROR' | 'WARN' {
  return issues.some((issue) => issue.severity === 'ERROR') ? 'ERROR' : 'WARN';
}

/**
 * Whether a cell carrying this raw issue string keeps its grid decoration.
 *
 * An operator who deliberately packs the grid — no spacing between rows — generates
 * adjacency warnings on almost every cell, because adjacency is precisely what they are
 * doing on purpose. Painting all of them is noise that buries the errors that matter,
 * so the warning band becomes optional.
 *
 * Only `WARN` is suppressible. `ERROR` decoration is never withheld — it is the thing
 * the toggle exists to make visible — and `INFO` is already quiet enough that hiding it
 * under a control labelled "warnings" would be a lie about what the control does.
 */
export function decoratesCell(issue: string | undefined, warningBarsVisible: boolean): boolean {
  return warningBarsVisible || severityOf(issue) !== 'WARN';
}

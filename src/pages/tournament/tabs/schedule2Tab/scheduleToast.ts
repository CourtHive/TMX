import { tmxToast } from 'services/notifications/tmxToast';

/**
 * Schedule-page toast — same as tmxToast but defaults to `bottom-center` so
 * notifications don't cover the Grid/Profile view switcher in the header.
 */
export function scheduleToast(params: any): void {
  // `offsetBottom: 60` lifts the toast above a typical modal footer so the
  // Scheduling Results modal (and similar) does not occlude the toast.
  tmxToast({ position: 'bottom-center', offsetBottom: 60, ...params });
}

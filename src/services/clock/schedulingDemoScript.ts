export const SCHEDULER_DEMO_ID = 'scheduler-demo-three-days';
export const SCHEDULER_DEMO_NAME = 'Scheduling Lab — Garman + Pro';
export const SCHEDULER_DEMO_VENUE = 'scheduler-demo-venue';
export const SCHEDULER_DEMO_ZONE = 'America/New_York';
export const SCHEDULER_DEMO_SCRIPT = 'scheduling-lab-v1';

/**
 * A demo tournament: the guided Scheduling Lab. The demo clock runs only on these (it stamps simulated times into the
 * record), and they are never offered Claim into a provider. Lives beside the clock, not with the page that builds the
 * profile, because the mutation path reaches it through `demoClock`.
 */
export function hasSchedulingDemoScript(record: any): boolean {
  return (
    record?.tournamentId === SCHEDULER_DEMO_ID ||
    record?.extensions?.some(
      (extension: any) => extension.name === 'demoScript' && extension.value === SCHEDULER_DEMO_SCRIPT,
    )
  );
}

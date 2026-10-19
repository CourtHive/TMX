import type { DemoWalkthrough } from './demoWalkthrough';
import type { MutationMethod } from 'types/services';

export type WalkthroughReplayDriver = {
  load: (tournament: any) => unknown | Promise<unknown>;
  setTime: (time: number) => unknown | Promise<unknown>;
  execute: (methods: MutationMethod[]) => { error?: unknown } | Promise<{ error?: unknown }>;
  read: () => any | Promise<any>;
  navigate?: (route: string) => unknown | Promise<unknown>;
};

const STEP_KINDS = new Set(['clock', 'navigation', 'mutation', 'state']);

function canonical(value: any): string {
  return JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(
          // Code-unit order: a canonical form must not vary with the runtime's locale.
          Object.keys(entry)
            .sort((a, b) => (a < b ? -1 : Number(a > b)))
            .map((key) => [key, entry[key]]),
        )
      : entry,
  );
}

/** No live TMX singleton: tests provide an isolated driver and decide how to restore its state. */
export async function replayDemoWalkthrough(artifact: DemoWalkthrough, driver: WalkthroughReplayDriver) {
  if (
    artifact?.schema !== 'courthive.demo-walkthrough' ||
    artifact.schemaVersion !== 1 ||
    !artifact.initialTournament ||
    artifact.initialTournament.tournamentId !== artifact.tournamentId ||
    !Array.isArray(artifact.steps) ||
    !Number.isFinite(artifact.initialTime)
  )
    return { verified: false, error: 'INVALID_CAPTURE' };
  let previousTime = artifact.initialTime;
  for (const [index, step] of artifact.steps.entries()) {
    if (
      step.sequence !== index + 1 ||
      !Number.isFinite(step.time) ||
      step.time < previousTime ||
      !STEP_KINDS.has(step.kind) ||
      (step.kind === 'mutation' && (!Array.isArray(step.methods) || !step.methods.length || !step.tournament))
    )
      return { verified: false, error: 'INVALID_CAPTURE', sequence: step.sequence };
    previousTime = step.time;
  }
  await driver.setTime(artifact.initialTime);
  await driver.load(structuredClone(artifact.initialTournament));
  await driver.navigate?.(artifact.initialRoute);
  for (const step of artifact.steps) {
    await driver.setTime(step.time);
    if (step.kind === 'state') return { verified: false, error: 'UNREPLAYABLE_STATE_STEP', sequence: step.sequence };
    if (step.kind === 'navigation') await driver.navigate?.(step.route);
    if (step.kind !== 'mutation') continue;
    const result = await driver.execute(structuredClone(step.methods!));
    if (result?.error)
      return { verified: false, error: 'MUTATION_REFUSED', sequence: step.sequence, detail: result.error };
    if (canonical(await driver.read()) !== canonical(step.tournament))
      return { verified: false, error: 'STATE_MISMATCH', sequence: step.sequence };
  }
  return { verified: true, steps: artifact.steps.length };
}

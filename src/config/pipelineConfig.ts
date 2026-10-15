/**
 * Pipeline features — per-call overrides for the factory's `setMatchUpStatus` outcome pipeline.
 *
 * A dev/testing surface (Settings → Pipeline features), honoured only where `services/pipeline/pipelineFeatures`
 * says the panel is active: logged out, or a mock tournament, and no scoring policy of the tournament's own.
 * Persisted per device in `tmx_settings`.
 *
 * Each option is tri-state. `default` injects nothing, so every call path keeps the value it already sends
 * (the score dialog sends `allowChangePropagation: true`, hotkey scoring sends none); `on` and `off` override it.
 */
export type PipelineSetting = 'default' | 'on' | 'off';

export interface PipelineCallOverrides {
  propagateExitStatus: PipelineSetting;
  propagateRetirementAsExit: PipelineSetting;
  allowChangePropagation: PipelineSetting;
  disableScoreValidation: PipelineSetting;
}

export const PIPELINE_CALL_KEYS: (keyof PipelineCallOverrides)[] = [
  'propagateExitStatus',
  'propagateRetirementAsExit',
  'allowChangePropagation',
  'disableScoreValidation',
];

const defaults: PipelineCallOverrides = {
  propagateExitStatus: 'default',
  propagateRetirementAsExit: 'default',
  allowChangePropagation: 'default',
  disableScoreValidation: 'default',
};

let current: PipelineCallOverrides = { ...defaults };

export const pipelineConfig = {
  get: (): Readonly<PipelineCallOverrides> => current,
  set: (partial: Partial<PipelineCallOverrides>) => {
    current = { ...current, ...partial };
  },
  reset: () => {
    current = { ...defaults };
  },
} as const;

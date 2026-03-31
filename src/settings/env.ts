/**
 * Environment configuration — backward-compatible shim.
 *
 * This module re-exports a mutable `env` object that delegates to the typed
 * config modules under `src/config/`. Existing code that reads/writes `env.X`
 * continues to work unchanged. New code should import directly from the
 * typed config modules instead.
 *
 * MIGRATION STATUS: Phase 1 — env delegates to typed modules but remains
 * the primary import for existing code. Properties set on env are forwarded
 * to the appropriate config module.
 *
 * @deprecated Import from the specific config module instead:
 *   - `import { serverConfig } from 'config/serverConfig'`
 *   - `import { featureFlags } from 'config/featureFlags'`
 *   - `import { preferencesConfig } from 'config/preferencesConfig'`
 *   - `import { deviceConfig } from 'config/deviceConfig'`
 *   - etc.
 */
import { locationConfig, leafletConfig } from 'config/locationConfig';
import { preferencesConfig } from 'config/preferencesConfig';
import { scoringBoardConfig } from 'config/scoringConfig';
import { scheduleConfig } from 'config/scheduleConfig';
import { featureFlags } from 'config/featureFlags';
import { displayConfig } from 'config/displayConfig';
import { serverConfig } from 'config/serverConfig';
import { deviceConfig } from 'config/deviceConfig';
import { debugConfig } from 'config/debugConfig';
import { scalesMap } from 'config/scalesConfig';
import { version } from 'config/version';

/**
 * The env object remains typed as `any` for full backward compatibility.
 * All initial values now come from the typed config modules.
 *
 * During migration (Phase 2+), reads and writes will be moved file-by-file
 * from `env.X` to the appropriate `xConfig.get().X` / `xConfig.set({ X })`.
 * Once all consumers are migrated, this file can be deleted.
 */
export const env: any = {
  // Server & sync — delegates to serverConfig
  get serverFirst() {
    return serverConfig.get().serverFirst;
  },
  set serverFirst(v: boolean) {
    serverConfig.set({ serverFirst: v });
  },
  get serverTimeout() {
    return serverConfig.get().serverTimeout;
  },
  set serverTimeout(v: number) {
    serverConfig.set({ serverTimeout: v });
  },
  get saveLocal() {
    return serverConfig.get().saveLocal;
  },
  set saveLocal(v: boolean) {
    serverConfig.set({ saveLocal: v });
  },
  get socketPath() {
    return serverConfig.get().socketPath;
  },
  set socketPath(v: string) {
    serverConfig.set({ socketPath: v });
  },
  get socketIo() {
    return serverConfig.get().socketIo;
  },
  set socketIo(v: any) {
    serverConfig.set({ socketIo: v });
  },

  // Device — delegates to deviceConfig
  get device() {
    return deviceConfig.get();
  },
  set device(_v: any) {
    deviceConfig.refresh();
  },

  // Feature flags — delegates to featureFlags
  get googleSheetsImport() {
    return featureFlags.get().googleSheetsImport;
  },
  set googleSheetsImport(v: boolean) {
    featureFlags.set({ googleSheetsImport: v });
  },
  get schedule2() {
    return featureFlags.get().schedule2;
  },
  set schedule2(v: boolean) {
    featureFlags.set({ schedule2: v });
  },
  get usePublishState() {
    return featureFlags.get().usePublishState;
  },
  set usePublishState(v: boolean) {
    featureFlags.set({ usePublishState: v });
  },

  // User preferences — delegates to preferencesConfig
  get activeScale() {
    return preferencesConfig.get().activeScale;
  },
  set activeScale(v: string) {
    preferencesConfig.set({ activeScale: v });
  },
  get scoringApproach() {
    return preferencesConfig.get().scoringApproach;
  },
  set scoringApproach(v: any) {
    preferencesConfig.set({ scoringApproach: v });
  },
  get smartComplements() {
    return preferencesConfig.get().smartComplements;
  },
  set smartComplements(v: boolean) {
    preferencesConfig.set({ smartComplements: v });
  },
  get hotkeys() {
    return preferencesConfig.get().hotkeys;
  },
  set hotkeys(v: boolean) {
    preferencesConfig.set({ hotkeys: v });
  },
  get scoring() {
    return preferencesConfig.get().scoring;
  },
  set scoring(v: boolean) {
    preferencesConfig.set({ scoring: v });
  },
  get ioc() {
    return preferencesConfig.get().ioc;
  },
  set ioc(v: string) {
    preferencesConfig.set({ ioc: v });
  },

  // Display — delegates to displayConfig
  get composition() {
    return displayConfig.get().composition;
  },
  set composition(v: any) {
    displayConfig.set({ composition: v });
  },
  get tableHeightMultiplier() {
    return displayConfig.get().tableHeightMultiplier;
  },
  set tableHeightMultiplier(v: number) {
    displayConfig.set({ tableHeightMultiplier: v });
  },
  get printing() {
    return displayConfig.get().printing;
  },
  set printing(v: any) {
    displayConfig.set({ printing: v });
  },

  // Schedule — delegates to scheduleConfig
  get schedule() {
    return scheduleConfig.get();
  },
  set schedule(v: any) {
    scheduleConfig.set(v);
  },

  // Scoreboard — delegates to scoringBoardConfig
  get scoreboard() {
    return scoringBoardConfig.get();
  },
  set scoreboard(v: any) {
    scoringBoardConfig.set(v);
  },

  // Scales — static, from scalesConfig
  scales: scalesMap,

  // Location & mapping — delegates to locationConfig
  get locations() {
    return locationConfig.get();
  },
  set locations(v: any) {
    locationConfig.set(v);
  },
  get leaflet() {
    return leafletConfig.get();
  },

  // Debug — delegates to debugConfig
  get log() {
    return debugConfig.get().log;
  },
  set log(v: any) {
    debugConfig.set({ log: v });
  },
  get renderLog() {
    return debugConfig.get().renderLog;
  },
  set renderLog(v: boolean) {
    debugConfig.set({ renderLog: v });
  },
  get devNotes() {
    return debugConfig.get().devNotes;
  },
  set devNotes(v: boolean) {
    debugConfig.set({ devNotes: v });
  },
  get averages() {
    return debugConfig.get().averages;
  },
  set averages(v: boolean) {
    debugConfig.set({ averages: v });
  },

  // Metadata — not delegated (session-only)
  version,
  messages: [] as any[],
};

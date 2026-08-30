// Re-export only. The implementation moved to the factory:
//   tods-competition-factory → tools.buildFromSources
//
// It lived here as an unversioned dev utility while four importers across three repos depended on
// it, including two that reached across repo boundaries into this file. One versioned, tested copy
// now, in the package that owns every draw generator it needs.
//
// The move also fixed what could not be fixed here: a record rebuilt from sources has no structure
// links, because links are a property of the draw while the sources are a projection of its
// matchUps. `getDrawData` REFUSES such a draw outright. The factory's `buildFromSources` now calls
// `repairDrawLinks` and reports what it inferred.
//
// This shim exists so cross-repo importers do not break in the same commit. New code should import
// from `tods-competition-factory` directly; this file can go once the last of them has moved.
import { tools } from 'tods-competition-factory';

// Named re-exports rather than `export ... from`: these live under the package's `tools` namespace,
// not at its top level, so a bare re-export resolves to nothing and fails at MODULE LOAD — which
// `node --check` does not catch, because it is a semantic failure and not a syntactic one.
export const buildFromSources = tools.buildFromSources;
export const buildTournamentRecord = tools.buildTournamentRecord;
export const repairDrawLinks = tools.repairDrawLinks;
export const classifySource = tools.classifySource;
export const extractEventData = tools.extractEventData;
export const extractMatchUps = tools.extractMatchUps;
export const extractParticipants = tools.extractParticipants;

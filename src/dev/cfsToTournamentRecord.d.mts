// Type declarations for the sibling .mjs core. Authored alongside so TMX TS
// callers get checked imports without forcing `allowJs` on the project.

export type SourceKind = 'event-data' | 'matchups' | 'participants' | 'unknown';

export interface Classification {
  index: number;
  kind: SourceKind;
}

export interface BuildFromSourcesResult {
  record: TournamentRecordShape;
  classification: Classification[];
  unknownCount: number;
}

// The shape is intentionally loose — factory types live elsewhere and this
// module's contract is "best-effort partial tournamentRecord".
export interface TournamentRecordShape {
  tournamentId?: string;
  tournamentName?: string;
  startDate?: string;
  endDate?: string;
  timeZone?: string;
  participants?: any[];
  venues?: any[];
  events?: any[];
  [key: string]: any;
}

export interface ExtractedEventData {
  tournamentInfo?: any;
  eventInfo?: any;
  drawsData: any[];
  participants: any[];
}

export function classifySource(raw: unknown): { kind: SourceKind; value: unknown };

export function extractEventData(raw: unknown): ExtractedEventData;
export function extractMatchUps(raw: unknown): any[];
export function extractParticipants(raw: unknown): any[];

export function buildTournamentRecord(input?: {
  eventDataDocs?: ExtractedEventData[];
  matchUpDocs?: any[];
  participantDocs?: any[][];
}): TournamentRecordShape;

export function buildFromSources(sources: unknown[]): BuildFromSourcesResult;

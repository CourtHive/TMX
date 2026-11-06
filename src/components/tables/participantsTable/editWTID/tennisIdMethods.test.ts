import { mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { tennisIdMethods } from './tennisIdMethods';
import { describe, expect, it } from 'vitest';

// Through the real engine: the methods the tennisId column saves are applied with executionQueue, as an
// acknowledged mutation would apply them.
function setup() {
  mocksEngine.generateTournamentRecord({ participantsProfile: { participantsCount: 4 }, setState: true });
  return tournamentEngine.getParticipants().participants ?? [];
}

function save(rows: any[]) {
  const participantMap = tournamentEngine.getParticipants().participantMap ?? {};
  const methods = tennisIdMethods({ rows, participantMap });
  return { methods, result: methods.length ? tournamentEngine.executionQueue(methods) : undefined };
}

const storedTennisId = (participantId: string) =>
  tournamentEngine.findParticipant({ participantId }).participant?.person?.tennisId;

describe('tennisIdMethods', () => {
  it('writes an edited tennisId, then clears it when the cell is emptied', () => {
    const [participant] = setup();
    const { participantId } = participant;

    let { methods, result }: any = save([{ participantId, tennisId: 'WT-1' }]);
    expect(methods.length).toEqual(1);
    expect(result.success).toEqual(true);
    expect(storedTennisId(participantId)).toEqual('WT-1');

    ({ methods, result } = save([{ participantId, tennisId: '' }]));
    expect(methods[0].params.participant.person.tennisId).toEqual('');
    expect(result.success).toEqual(true);
    expect(storedTennisId(participantId)).toBeUndefined();
  });

  it('sends nothing for rows whose tennisId is unchanged or still empty', () => {
    const participants = setup();
    save([{ participantId: participants[0].participantId, tennisId: 'WT-1' }]);

    const { methods } = save([
      { participantId: participants[0].participantId, tennisId: 'WT-1' },
      { participantId: participants[1].participantId, tennisId: '' },
      { participantId: participants[2].participantId },
    ]);
    expect(methods).toEqual([]);
  });
});

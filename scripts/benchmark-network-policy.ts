/** Run with Node 26: node scripts/benchmark-network-policy.ts */
import { mocksEngine } from 'tods-competition-factory';
import { assertServerAccess } from '../src/services/network/networkPolicy.ts';

const { tournamentRecord } = mocksEngine.generateTournamentRecord({
  nonRandom: 1,
  eventProfiles: Array.from({ length: 8 }, () => ({ drawProfiles: [{ drawSize: 256 }] })),
});
const payload = { tournamentRecords: { [tournamentRecord.tournamentId]: tournamentRecord } };
for (let i = 0; i < 10; i++) assertServerAccess(payload);
const samples = Array.from({ length: 50 }, () => {
  const start = performance.now();
  assertServerAccess(payload);
  return performance.now() - start;
}).toSorted((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      node: process.version,
      draws: 8,
      drawSize: 256,
      participants: tournamentRecord.participants.length,
      payloadBytes: Buffer.byteLength(JSON.stringify(payload)),
      iterations: samples.length,
      medianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(2)),
      p95Ms: Number(samples[Math.floor(samples.length * 0.95)].toFixed(2)),
      maxMs: Number(samples.at(-1)!.toFixed(2)),
    },
    null,
    2,
  ),
);

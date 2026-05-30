import { describe, expect, it } from 'vitest';
import { resolveParticipantRole } from './resolveParticipantRole';

describe('resolveParticipantRole', () => {
  it('returns the default with matched=false for empty / whitespace / nullish input', () => {
    expect(resolveParticipantRole(undefined)).toEqual({ role: 'COMPETITOR', matched: false });
    expect(resolveParticipantRole(null)).toEqual({ role: 'COMPETITOR', matched: false });
    expect(resolveParticipantRole('')).toEqual({ role: 'COMPETITOR', matched: false });
    expect(resolveParticipantRole('   ')).toEqual({ role: 'COMPETITOR', matched: false });
  });

  it('accepts exact-uppercase factory role constants', () => {
    expect(resolveParticipantRole('COMPETITOR')).toEqual({ role: 'COMPETITOR', matched: true });
    expect(resolveParticipantRole('COACH')).toEqual({ role: 'COACH', matched: true });
    expect(resolveParticipantRole('MEDICAL')).toEqual({ role: 'MEDICAL', matched: true });
  });

  it('case-insensitively matches direct factory constants', () => {
    expect(resolveParticipantRole('coach')).toEqual({ role: 'COACH', matched: true });
    expect(resolveParticipantRole('  Competitor  ')).toEqual({ role: 'COMPETITOR', matched: true });
    expect(resolveParticipantRole('Captain')).toEqual({ role: 'CAPTAIN', matched: true });
  });

  it('resolves physio aliases to PHYSIO (not MEDICAL)', () => {
    expect(resolveParticipantRole('physio')).toEqual({ role: 'PHYSIO', matched: true });
    expect(resolveParticipantRole('Physiotherapist')).toEqual({ role: 'PHYSIO', matched: true });
    expect(resolveParticipantRole('physical therapist')).toEqual({ role: 'PHYSIO', matched: true });
    expect(resolveParticipantRole('PT')).toEqual({ role: 'PHYSIO', matched: true });
  });

  it('resolves trainer aliases to TRAINER (not MEDICAL)', () => {
    expect(resolveParticipantRole('trainer')).toEqual({ role: 'TRAINER', matched: true });
    expect(resolveParticipantRole('Athletic Trainer')).toEqual({ role: 'TRAINER', matched: true });
    expect(resolveParticipantRole('AT')).toEqual({ role: 'TRAINER', matched: true });
    expect(resolveParticipantRole('Strength Coach')).toEqual({ role: 'TRAINER', matched: true });
  });

  it('resolves doctor / general-medical aliases to MEDICAL', () => {
    expect(resolveParticipantRole('doctor')).toEqual({ role: 'MEDICAL', matched: true });
    expect(resolveParticipantRole('Doc')).toEqual({ role: 'MEDICAL', matched: true });
    expect(resolveParticipantRole('MD')).toEqual({ role: 'MEDICAL', matched: true });
    expect(resolveParticipantRole('paramedic')).toEqual({ role: 'MEDICAL', matched: true });
  });

  it('resolves captain aliases', () => {
    expect(resolveParticipantRole('Captain')).toEqual({ role: 'CAPTAIN', matched: true });
    expect(resolveParticipantRole('capt')).toEqual({ role: 'CAPTAIN', matched: true });
  });

  it('resolves player synonyms to COMPETITOR', () => {
    expect(resolveParticipantRole('player')).toEqual({ role: 'COMPETITOR', matched: true });
    expect(resolveParticipantRole('Athlete')).toEqual({ role: 'COMPETITOR', matched: true });
    expect(resolveParticipantRole('comp')).toEqual({ role: 'COMPETITOR', matched: true });
  });

  it('returns matched=false (with COMPETITOR fallback) for unknown values', () => {
    expect(resolveParticipantRole('sherpa')).toEqual({ role: 'COMPETITOR', matched: false });
    expect(resolveParticipantRole('xyz')).toEqual({ role: 'COMPETITOR', matched: false });
  });

  it('strips spaces / punctuation before alias lookup but still requires the concatenation to match exactly', () => {
    // Spaces, periods, and hyphens are dropped — `Assistant Coach` and
    // `Asst. Coach` both collapse to alias keys present in the table.
    expect(resolveParticipantRole('Assistant Coach')).toEqual({ role: 'COACH', matched: true });
    expect(resolveParticipantRole('Asst. Coach')).toEqual({ role: 'COACH', matched: true });
    expect(resolveParticipantRole('Head Coach')).toEqual({ role: 'COACH', matched: true });

    // But the alpha-only concatenation must still match an alias key in
    // full — trailing modifiers ("Senior", "(2nd)") that don't appear in
    // any key fall through to the unknown branch. This is a deliberate
    // contract: we don't want a fuzzy "contains coach" matcher that
    // misclassifies, say, a `LIFE_COACH` row as a tennis coach.
    expect(resolveParticipantRole('Assistant Coach (Senior)')).toEqual({ role: 'COMPETITOR', matched: false });
  });
});

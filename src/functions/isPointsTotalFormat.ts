import { matchUpFormatCode } from 'tods-competition-factory';

/**
 * Whether a matchUpFormat is a combined-point total (`SET1-S:P32`, Americano / Padel scoring): one segment whose
 * score is how a fixed number of points split between the sides, which may end level (16-16).
 */
export function isPointsTotalFormat(matchUpFormat?: string): boolean {
  return !!matchUpFormatCode.parse(matchUpFormat ?? '')?.setFormat?.combinedPointTotal;
}

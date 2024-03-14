import { env } from './env';

export function setActiveScale(scale: string) {
  // TODO: persist in DISPLAY extension on tournamentRecord
  env.activeScale = scale;
}

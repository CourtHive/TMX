import { showSplash } from 'services/transitions/screenSlaver';
import { resetTournament } from './resetTournament';
import { context } from 'services/context';

export function goHome(): void {
  context.router?.navigate('/');
  resetTournament();
  showSplash();
}

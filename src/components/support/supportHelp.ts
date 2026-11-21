import { supportReportingAvailable } from 'services/support/reportAvailability';
import { SUPPORT_HELP } from 'constants/tmxConstants';
import { supportText } from 'services/support/text';
import './reportProblem.css';

export function mountSupportHelp() {
  const login = document.getElementById('login');
  if (!login?.parentElement || document.getElementById(SUPPORT_HELP)) return;
  const help = document.createElement('details');
  help.id = SUPPORT_HELP;
  help.className = 'tmx-support-help';
  const summary = document.createElement('summary');
  summary.textContent = supportText('help');
  const report = document.createElement('button');
  report.type = 'button';
  report.className = 'tmx-support-entry';
  report.hidden = !supportReportingAvailable();
  help.ontoggle = () => {
    report.hidden = !supportReportingAvailable();
  };
  report.textContent = supportText('report');
  report.onclick = () => {
    if (!supportReportingAvailable()) return;
    help.open = false;
    summary.focus();
    void import('./reportProblem').then(({ openProblemReport }) => openProblemReport());
  };
  help.append(summary, report);
  login.before(help);
}

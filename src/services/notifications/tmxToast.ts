import { supportReportingAvailable } from 'services/support/reportAvailability';
import { recordSupportDiagnostic } from 'services/support/reportContext';
import { SUPPORT_DIALOG } from 'constants/tmxConstants';
import { supportText } from 'services/support/text';
import { toast } from './toaster';

export function tmxToast(params) {
  const {
    position = 'top-center',
    intent = 'is-success',
    pauseOnHover = false,
    dismissible = true,
    clickClose = true,
    duration = 2500,
    single = true,
    onClose,

    offsetBottom = 0,
    offsetRight = 0,
    offsetLeft = 0,
    offsetTop = 0,
    opacity = 1,
    message,
    action
  } = params ?? {};

  let reportAction = action;
  // Never offer "Report a problem" from inside the report form itself: a failed report must not suggest reporting it.
  const reporting = Boolean(globalThis.document?.getElementById(SUPPORT_DIALOG));
  if (intent === 'is-danger' && supportReportingAvailable() && !reporting) {
    recordSupportDiagnostic('UNCLASSIFIED');
    reportAction ??= { text: supportText('report'), onClick: () => {
      void import('components/support/reportProblem').then(({ openProblemReport }) => openProblemReport());
    } };
  }
  toast({
    // animate: { in: 'fadeInRight', out: 'fadeOutLeft' }, // see animate.css
    // animate: { in: 'bounceInDown', out: 'bounceOutUp' }, // see animate.css
    animate: { in: 'fadeIn', out: 'fadeOut' }, // see animate.css
    classList: reportAction !== action ? 'tmx-support-report-toast' : undefined,
    pauseOnHover,
    offsetBottom,
    type: intent,
    offsetRight,
    dismissible,
    offsetLeft,
    clickClose,
    offsetTop,
    duration,
    position,
    message,
    onClose,
    opacity,
    action: reportAction,
    single
  });
}

import { recordSupportDiagnostic } from 'services/support/reportContext';
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
  if (intent === 'is-danger') {
    recordSupportDiagnostic('UNCLASSIFIED');
    reportAction ??= { text: supportText('report'), onClick: () => {
      void import('components/support/reportProblem').then(({ openProblemReport }) => openProblemReport());
    } };
  }
  toast({
    // animate: { in: 'fadeInRight', out: 'fadeOutLeft' }, // see animate.css
    // animate: { in: 'bounceInDown', out: 'bounceOutUp' }, // see animate.css
    animate: { in: 'fadeIn', out: 'fadeOut' }, // see animate.css
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

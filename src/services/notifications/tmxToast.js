import { toast } from './toaster';

export function tmxToast({
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
}) {
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
    action,
    single
  });
}

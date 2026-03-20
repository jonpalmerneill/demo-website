import { prefersLessMotion } from './motion.js';

const BLUR    = 'blur(18px)';
const EASE_IN  = 'power2.in';
const EASE_OUT = 'power2.out';

export function enterPage() {
  // Remove the CSS class that held the page invisible before JS ran
  document.documentElement.classList.remove('is-entering');

  if (prefersLessMotion()) return;

  gsap.from(document.body, {
    filter:  BLUR,
    opacity: 0,
    duration: 1.7,
    ease: EASE_OUT,
    clearProps: 'filter,opacity',
  });
}

export function leavePage(url) {
  if (prefersLessMotion()) {
    window.location.href = url;
    return;
  }

  gsap.to(document.body, {
    filter:  BLUR,
    opacity: 0,
    duration: 0.8,
    ease: EASE_IN,
    onComplete: () => { window.location.href = url; },
  });
}

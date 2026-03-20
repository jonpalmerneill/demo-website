import { prefersLessMotion } from './motion.js';

const EASE_IN  = 'power2.in';
const EASE_OUT = 'power2.out';

// Creates a full-screen overlay that sits BELOW the logo (z-index 395 < logo 400)
// so the logo remains visible throughout every transition.
function makeOverlay() {
  const el = document.createElement('div');
  const isLight = document.documentElement.dataset.theme === 'light';
  const bg = isLight ? '#f0ede8' : '#0a0a0a';
  el.style.cssText =
    `position:fixed;inset:0;z-index:395;pointer-events:none;background:${bg}`;
  document.body.appendChild(el);
  return el;
}

export function enterPage() {
  // Remove the CSS class that held the page invisible before JS ran
  document.documentElement.classList.remove('is-entering');

  if (prefersLessMotion()) return;

  // Creating the overlay in the same JS tick as removing 'is-entering' means
  // the browser renders them together — no flash of content.
  const overlay = makeOverlay();
  gsap.set(overlay, { opacity: 1, filter: 'blur(18px)' });
  gsap.to(overlay, {
    opacity: 0,
    filter: 'blur(0px)',
    duration: 1.7,
    ease: EASE_OUT,
    clearProps: 'filter',
    onComplete: () => overlay.remove(),
  });
}

export function leavePage(url) {
  if (prefersLessMotion()) {
    window.location.href = url;
    return;
  }

  const overlay = makeOverlay();
  gsap.set(overlay, { opacity: 0 });
  gsap.to(overlay, {
    opacity: 1,
    filter: 'blur(18px)',
    duration: 0.8,
    ease: EASE_IN,
    onComplete: () => { window.location.href = url; },
  });
}

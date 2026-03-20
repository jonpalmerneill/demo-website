import { enterPage } from './transition.js';
import { initNav }   from './nav.js';
import { prefersLessMotion } from './motion.js';

document.addEventListener('DOMContentLoaded', () => {
  enterPage();
  initNav();

  const promptEl  = document.querySelector('.contact__prompt');
  const actionsEl = document.querySelector('.contact__actions');

  // Set initial hidden states — GSAP manages these
  gsap.set(actionsEl.querySelectorAll('.contact__btn'), { opacity: 0, y: 16 });

  const message = "Hey, we're ready to connect in a number of ways. What works best for you?";

  // ── Typewriter ────────────────────────────────────────────────
  function typeMessage(onDone) {
    if (prefersLessMotion()) {
      promptEl.textContent = message;
      onDone();
      return;
    }

    let i = 0;
    const cursor = '<span class="contact__cursor" aria-hidden="true">|</span>';

    function step() {
      i++;
      promptEl.innerHTML = message.slice(0, i) + cursor;
      if (i < message.length) {
        setTimeout(step, 36 + Math.random() * 28);
      } else {
        // Hold cursor a beat, then clear it and proceed
        setTimeout(() => {
          promptEl.textContent = message;
          onDone();
        }, 480);
      }
    }

    // Small initial pause so the page-enter blur has a moment to settle
    setTimeout(step, 120);
  }

  // ── Reveal sequence ───────────────────────────────────────────
  function revealActions() {
    actionsEl.removeAttribute('aria-hidden');
    gsap.to(actionsEl.querySelectorAll('.contact__btn'), {
      opacity: 1,
      y: 0,
      duration: 0.55,
      ease: 'power3.out',
      stagger: 0.09,
    });
  }

  // ── Boot ──────────────────────────────────────────────────────
  // Give the page-enter animation (1.7s blur-in) a head start before typing
  setTimeout(() => typeMessage(revealActions), 820);
});

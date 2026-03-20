import { enterPage, leavePage } from './transition.js';
import { initNav }   from './nav.js';
import { prefersLessMotion } from './motion.js';
import { initCursor } from './cursor.js';

document.addEventListener('DOMContentLoaded', () => {
  enterPage();
  initCursor();
  initNav();

  // Intercept links that should animate out before navigating
  document.querySelectorAll('.contact__btn[data-transition]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      leavePage(link.href);
    });
  });

  const promptEl  = document.querySelector('.contact__prompt');
  const actionsEl = document.querySelector('.contact__actions');

  gsap.set(actionsEl.querySelectorAll('.contact__btn'), { opacity: 0, y: 16 });

  const message = "Hey, we're ready to connect in a number of ways. What works best for you?";

  // ── Blur-fade reveal (matches overlay style) ───────────────────
  function typeMessage(onDone) {
    if (prefersLessMotion()) {
      promptEl.textContent = message;
      onDone();
      return;
    }

    promptEl.innerHTML = message
      .split(' ')
      .map(word => {
        const letters = word.split('').map(c =>
          `<span class="char" style="display:inline-block">${c}</span>`
        ).join('');
        return `<span style="display:inline-block;white-space:nowrap">${letters}</span>`;
      })
      .join('<span style="display:inline-block">&nbsp;</span>');

    gsap.fromTo(
      promptEl.querySelectorAll('.char'),
      { opacity: 0, filter: 'blur(8px)' },
      {
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.5,
        stagger: 0.025,
        ease: 'power2.out',
        clearProps: 'filter',
        onComplete: onDone,
      }
    );
  }

  // ── Reveal action buttons ──────────────────────────────────────
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
  setTimeout(() => typeMessage(revealActions), 820);
});

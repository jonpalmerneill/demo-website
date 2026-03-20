import { enterPage, leavePage } from './transition.js';
import { initNav } from './nav.js';
import { prefersLessMotion } from './motion.js';
import { initCursor } from './cursor.js';

document.addEventListener('DOMContentLoaded', () => {
  enterPage();
  initCursor();
  initNav();

  const backLink = document.querySelector('.project-back');
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      leavePage('contact.html');
    });
  }

  const headingEl = document.querySelector('.faq__heading');
  const items     = document.querySelectorAll('.faq__item');

  gsap.set(items, { opacity: 0, y: 18 });

  const message = 'Frequently asked questions';

  // ── Blur-fade reveal (matches overlay style) ───────────────────
  function typeMessage(onDone) {
    if (prefersLessMotion()) {
      headingEl.textContent = message;
      onDone();
      return;
    }

    headingEl.innerHTML = message
      .split(' ')
      .map(word => {
        const letters = word.split('').map(c =>
          `<span class="char" style="display:inline-block">${c}</span>`
        ).join('');
        return `<span style="display:inline-block;white-space:nowrap">${letters}</span>`;
      })
      .join('<span style="display:inline-block">&nbsp;</span>');

    gsap.fromTo(
      headingEl.querySelectorAll('.char'),
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

  // ── Reveal FAQ items ──────────────────────────────────────────
  function revealItems() {
    if (prefersLessMotion()) {
      gsap.set(items, { opacity: 1, y: 0 });
    } else {
      gsap.to(items, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: 'power3.out',
        stagger: 0.09,
      });
    }
  }

  // ── Boot ──────────────────────────────────────────────────────
  setTimeout(() => typeMessage(revealItems), 820);

  // ── Accordion ─────────────────────────────────────────────────
  initAccordion(items);
});

function initAccordion(items) {
  const lm = prefersLessMotion();

  items.forEach(item => {
    const toggle = item.querySelector('.faq__toggle');
    const answer = item.querySelector('.faq__answer');

    gsap.set(answer, { height: 0, overflow: 'hidden' });

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        toggle.setAttribute('aria-expanded', 'false');
        item.classList.remove('is-open');
        if (lm) {
          gsap.set(answer, { height: 0 });
        } else {
          gsap.to(answer, { height: 0, duration: 0.35, ease: 'power3.inOut' });
        }
      } else {
        toggle.setAttribute('aria-expanded', 'true');
        item.classList.add('is-open');
        if (lm) {
          gsap.set(answer, { height: 'auto' });
        } else {
          gsap.to(answer, { height: 'auto', duration: 0.45, ease: 'power3.out' });
        }
      }
    });
  });
}

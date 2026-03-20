import { enterPage, leavePage } from './transition.js';
import { initNav } from './nav.js';
import { prefersLessMotion } from './motion.js';
import { initVoice } from './voice.js';
import { initCursor } from './cursor.js';

document.addEventListener('DOMContentLoaded', () => {
  enterPage();
  initCursor();
  initNav();

  const backLink = document.querySelector('.project-back');
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      leavePage('index.html');
    });
  }

  const skipLink = document.querySelector('.services__skip');
  if (skipLink) {
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      leavePage('index.html');
    });
  }

  const statementEl = document.querySelector('.services__statement');
  const pillsEl     = document.querySelector('.services__pills');
  const actionsEl   = document.querySelector('.services__actions');

  gsap.set([pillsEl, actionsEl], { opacity: 0, y: 16 });

  const message =
    'We turn ambitious ideas into real-world digital experiences through technology, design, and software development. What mediums or services are you most interested in?';

  // ── Blur-fade reveal (matches overlay style) ───────────────────
  function typeMessage(onDone) {
    if (prefersLessMotion()) {
      statementEl.textContent = message;
      onDone();
      return;
    }

    statementEl.innerHTML = message
      .split(' ')
      .map(word => {
        const letters = word.split('').map(c =>
          `<span class="char" style="display:inline-block">${c}</span>`
        ).join('');
        return `<span style="display:inline-block;white-space:nowrap">${letters}</span>`;
      })
      .join('<span style="display:inline-block">&nbsp;</span>');

    gsap.fromTo(
      statementEl.querySelectorAll('.char'),
      { opacity: 0, filter: 'blur(8px)' },
      {
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.5,
        stagger: 0.02,
        ease: 'power2.out',
        clearProps: 'filter',
        onComplete: onDone,
      }
    );
  }

  // ── Reveal pills + skip ───────────────────────────────────────
  function revealActions() {
    pillsEl.removeAttribute('aria-hidden');
    actionsEl.removeAttribute('aria-hidden');

    if (prefersLessMotion()) {
      gsap.set([pillsEl, actionsEl], { opacity: 1, y: 0 });
      return;
    }

    gsap.to(pillsEl,   { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
    gsap.to(actionsEl, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.12 });
  }

  // ── Boot ──────────────────────────────────────────────────────
  setTimeout(() => typeMessage(revealActions), 820);

  // ── Pill selection ────────────────────────────────────────────
  const pills = document.querySelectorAll('.services__pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('is-selected');
      pill.setAttribute('aria-pressed', pill.classList.contains('is-selected'));
    });
  });

  // ── Voice input ───────────────────────────────────────────────
  const micBtn = document.getElementById('services-mic');
  initVoice(
    micBtn,
    'What mediums or services are you most interested in?',
    (transcript) => {
      const t = transcript.toLowerCase();
      pills.forEach(pill => {
        const label = pill.textContent.trim().toLowerCase();
        if (t.includes(label)) {
          pill.classList.add('is-selected');
          pill.setAttribute('aria-pressed', 'true');
        }
      });
    }
  );
});

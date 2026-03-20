import { enterPage, leavePage } from './transition.js';
import { initNav } from './nav.js';
import { prefersLessMotion } from './motion.js';
import { initVoice } from './voice.js';
import { initCursor } from './cursor.js';
import { projects } from './data.js';

// ── Step 2 industry pills ─────────────────────────────────────────
const INDUSTRIES = [
  'Healthcare',
  'Education',
  'Retail',
  'Real estate',
  'Entertainment and media',
  'Manufacturing / industrial',
  'Tourism and hospitality',
  'Automotive',
  'Sports and fitness',
  'Construction',
  'Advertising and marketing',
  'Agriculture',
  'Telecommunications',
  'Energy',
];

// Map industry pill labels → project industry IDs in data.js
const INDUSTRY_MAP = {
  'Healthcare':               'healthcare',
  'Entertainment and media':  'media',
  'Tourism and hospitality':  'hospitality',
  'Automotive':               'automotive',
  'Sports and fitness':       'sport',
  'Advertising and marketing':'media',
  'Telecommunications':       'technology',
};

// Projects with usable thumbnail images, featured-first
const PREVIEW_POOL = projects
  .filter(p => { const s = p.poster || p.image; return s && !s.endsWith('.mp4'); })
  .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
  .slice(0, 24);

// ─────────────────────────────────────────────────────────────────
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
  const nextBtn     = document.querySelector('.services__next');

  gsap.set([pillsEl, actionsEl], { opacity: 0, y: 16 });
  gsap.set(nextBtn, { autoAlpha: 0, x: -8 });

  const step1Message =
    'We turn ambitious ideas into real-world digital experiences through technology, design, and software development. What mediums or services are you most interested in?';

  // ── Preview grid ──────────────────────────────────────────────
  const preview = initPreview(PREVIEW_POOL);

  // ── Step state ────────────────────────────────────────────────
  let currentStep = 'services';
  let currentPills = [];

  // ── Generic blur-fade typewriter ──────────────────────────────
  function typeText(el, msg, onDone) {
    if (prefersLessMotion()) {
      el.textContent = msg;
      if (onDone) onDone();
      return;
    }

    el.innerHTML = msg
      .split(' ')
      .map(word => {
        const letters = word.split('').map(c =>
          `<span class="char" style="display:inline-block">${c}</span>`
        ).join('');
        return `<span style="display:inline-block;white-space:nowrap">${letters}</span>`;
      })
      .join('<span style="display:inline-block">&nbsp;</span>');

    gsap.fromTo(
      el.querySelectorAll('.char'),
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

  // ── Reveal pills + actions row ────────────────────────────────
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
  setTimeout(() => typeText(statementEl, step1Message, revealActions), 820);

  // ── Next button visibility ────────────────────────────────────
  function updateNextBtn() {
    const anySelected = currentPills.some(p => p.classList.contains('is-selected'));
    if (anySelected) {
      gsap.to(nextBtn, { autoAlpha: 1, x: 0, duration: 0.3, ease: 'power2.out' });
      nextBtn.style.pointerEvents = 'auto';
    } else {
      gsap.to(nextBtn, { autoAlpha: 0, x: -8, duration: 0.2, ease: 'power2.in' });
      nextBtn.style.pointerEvents = 'none';
    }
  }

  // ── Preview update ────────────────────────────────────────────
  function updatePreview() {
    const selected = currentPills
      .filter(p => p.classList.contains('is-selected'))
      .map(p => p.textContent.trim());

    if (currentStep === 'services') {
      if (selected.length > 0) {
        preview.activate();
        preview.update(null); // show all
      } else {
        preview.deactivate();
      }
      return;
    }

    // Step 2: industries
    if (!selected.length) {
      preview.update(null); // show all, no filter active
      return;
    }

    const mappedIds = selected.map(s => INDUSTRY_MAP[s]).filter(Boolean);
    if (!mappedIds.length) {
      preview.update([]); // no project data for these industries
      return;
    }

    const subset = PREVIEW_POOL.filter(p =>
      p.industries.some(id => mappedIds.includes(id))
    );
    preview.update(subset.length ? subset : []);
  }

  // ── Pill binding ──────────────────────────────────────────────
  function bindPills(pillEls) {
    pillEls.forEach(pill => {
      pill.addEventListener('click', () => {
        pill.classList.toggle('is-selected');
        pill.setAttribute('aria-pressed', pill.classList.contains('is-selected'));
        updateNextBtn();
        updatePreview();
      });
    });
  }

  currentPills = Array.from(pillsEl.querySelectorAll('.services__pill'));
  bindPills(currentPills);

  // ── Voice — mutable callback so step 2 can update it ─────────
  const micBtn = document.getElementById('services-mic');
  let voiceCallback = (transcript) => {
    const t = transcript.toLowerCase();
    currentPills.forEach(pill => {
      const label = pill.textContent.trim().toLowerCase();
      if (t.includes(label)) {
        pill.classList.add('is-selected');
        pill.setAttribute('aria-pressed', 'true');
      }
    });
    updateNextBtn();
    updatePreview();
  };

  initVoice(
    micBtn,
    'What mediums or services are you most interested in?',
    (transcript) => voiceCallback(transcript)
  );

  // ── Advance to step 2 (industries) ───────────────────────────
  nextBtn.addEventListener('click', function onNext() {
    nextBtn.removeEventListener('click', onNext);
    nextBtn.style.pointerEvents = 'none';

    gsap.to([statementEl, pillsEl], {
      opacity: 0,
      y: -40,
      duration: 0.45,
      ease: 'power3.in',
      stagger: 0.06,
      onComplete: () => {
        pillsEl.innerHTML = '';
        const newPills = INDUSTRIES.map(label => {
          const btn = document.createElement('button');
          btn.className = 'services__pill';
          btn.type = 'button';
          btn.dataset.service = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          btn.textContent = label;
          pillsEl.appendChild(btn);
          return btn;
        });

        currentPills = newPills;
        currentStep = 'industries';
        bindPills(newPills);

        gsap.set(nextBtn, { autoAlpha: 0, x: -8 });
        nextBtn.style.pointerEvents = 'none';

        voiceCallback = (transcript) => {
          const t = transcript.toLowerCase();
          newPills.forEach(pill => {
            const label = pill.textContent.trim().toLowerCase();
            if (t.includes(label)) {
              pill.classList.add('is-selected');
              pill.setAttribute('aria-pressed', 'true');
            }
          });
          updateNextBtn();
          updatePreview();
        };

        // Keep preview showing all on entry to step 2
        preview.update(null);

        gsap.set(statementEl, { opacity: 1, y: 0 });
        gsap.set(pillsEl, { opacity: 0, y: 16 });

        typeText(statementEl, 'What industries are you focused on?', () => {
          gsap.to(pillsEl, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
        });
      },
    });
  });
});

// ── Preview grid module ───────────────────────────────────────────
// subset === null  → show all cards
// subset === []    → hide all cards
// subset = [...]   → show only those, hide the rest
function initPreview(pool) {
  const el = document.getElementById('services-preview');
  if (!el) return { activate() {}, deactivate() {}, update() {} };

  let isActive  = false;
  let cardEls   = [];
  let visibleIds = new Set();

  function activate() {
    if (isActive) return;
    isActive = true;

    const grid = document.createElement('div');
    grid.className = 'services__preview-grid';

    cardEls = pool.map(p => {
      const card = document.createElement('div');
      card.className = 'services__preview-card';
      card.dataset.id = p.id;

      const img = document.createElement('img');
      img.src      = p.poster || p.image;
      img.alt      = p.title;
      img.loading  = 'lazy';
      img.decoding = 'async';
      card.appendChild(img);
      grid.appendChild(card);
      return card;
    });

    el.appendChild(grid);
    visibleIds = new Set(pool.map(p => p.id));

    if (prefersLessMotion()) {
      gsap.set(el, { autoAlpha: 1, y: 0 });
      gsap.set(cardEls, { opacity: 1 });
      return;
    }

    gsap.set(el, { autoAlpha: 0, y: 60 });
    gsap.set(cardEls, { opacity: 0 });
    gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.65, ease: 'power3.out' });
    gsap.to(cardEls, {
      opacity: 1, duration: 0.4, ease: 'power3.out',
      stagger: 0.03, delay: 0.2,
    });
  }

  function deactivate() {
    if (!isActive) return;

    if (prefersLessMotion()) {
      gsap.set(el, { autoAlpha: 0 });
      el.innerHTML = '';
      isActive = false; cardEls = []; visibleIds = new Set();
      return;
    }

    gsap.to(el, {
      autoAlpha: 0, y: 40, duration: 0.4, ease: 'power3.in',
      onComplete: () => {
        el.innerHTML = '';
        isActive = false; cardEls = []; visibleIds = new Set();
      },
    });
  }

  function update(subset) {
    if (!isActive) return;

    const newIds = subset === null
      ? new Set(pool.map(p => p.id))
      : new Set(subset.map(p => p.id));

    const toHide = cardEls.filter(c =>  visibleIds.has(c.dataset.id) && !newIds.has(c.dataset.id));
    const toShow = cardEls.filter(c => !visibleIds.has(c.dataset.id) &&  newIds.has(c.dataset.id));

    visibleIds = newIds;

    if (toHide.length === 0 && toShow.length === 0) return;

    if (prefersLessMotion()) {
      toHide.forEach(c => { c.style.display = 'none'; });
      toShow.forEach(c => { c.style.display = ''; gsap.set(c, { opacity: 1, scale: 1 }); });
      return;
    }

    const showCards = () => {
      if (!toShow.length) return;
      toShow.forEach(c => { c.style.display = ''; });
      gsap.fromTo(
        toShow,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.3, stagger: 0.025, ease: 'power3.out' }
      );
    };

    if (toHide.length > 0) {
      gsap.to(toHide, {
        opacity: 0,
        scale: 0.75,
        duration: 0.22,
        stagger: 0.015,
        ease: 'power2.in',
        onComplete: () => {
          toHide.forEach(c => { c.style.display = 'none'; gsap.set(c, { scale: 1 }); });
          // rAF ensures layout reflows before new cards animate in
          requestAnimationFrame(showCards);
        },
      });
    } else {
      showCards();
    }
  }

  return { activate, deactivate, update };
}

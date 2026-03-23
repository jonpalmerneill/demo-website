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

  // Saved DOM snapshots so step 1 can be restored without re-typing
  let step1PillsHTML     = '';
  let step1StatementHTML = '';

  // ── Back link — always leaves the page
  const backLink = document.querySelector('.project-back');
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      leavePage('index.html');
    });
  }

  // ── Scroll up on step 2 → revert to step 1 ───────────────────
  let reverting = false;
  window.addEventListener('wheel', (e) => {
    if (currentStep === 'industries' && e.deltaY < 0 && !reverting) {
      reverting = true;
      revertToStep1();
    }
  }, { passive: true });

  const skipLink = document.querySelector('.services__skip');
  if (skipLink) {
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      leavePage('index.html');
    });
  }

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

  // ── Register the Next button handler (called on load + after revert)
  function registerNextHandler() {
    nextBtn.addEventListener('click', function onNext() {
      nextBtn.removeEventListener('click', onNext);
      advanceToStep2();
    });
  }

  registerNextHandler();

  // ── Step 1 → Step 2 ───────────────────────────────────────────
  function advanceToStep2() {
    nextBtn.style.pointerEvents = 'none';

    // Snapshot step 1 DOM so it can be restored on back navigation
    step1PillsHTML     = pillsEl.innerHTML;
    step1StatementHTML = statementEl.innerHTML;

    gsap.to([statementEl, pillsEl], {
      opacity: 0,
      y: -40,
      duration: 0.45,
      ease: 'power3.in',
      stagger: 0.06,
      onComplete: () => {
        // Build industry pills
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
        currentStep  = 'industries';
        bindPills(newPills);

        // Inject Previous button before Next
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'services__prev';
        prevBtn.setAttribute('aria-label', 'Previous step');
        prevBtn.innerHTML = `<svg viewBox="0 0 28 14" fill="none" aria-hidden="true">
          <line x1="26" y1="7" x2="4" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <polyline points="10,2 4,7 10,12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg><span>Previous</span>`;
        actionsEl.insertBefore(prevBtn, nextBtn);
        prevBtn.addEventListener('click', revertToStep1);

        // Reset next button (no industries selected yet)
        gsap.set(nextBtn, { autoAlpha: 0, x: -8 });
        nextBtn.style.pointerEvents = 'none';
        registerNextHandler();

        // Update voice callback for step 2 pills
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

        preview.update(null); // keep preview showing all on step 2 entry

        gsap.set(statementEl, { opacity: 1, y: 0 });
        gsap.set(pillsEl, { opacity: 0, y: 16 });

        typeText(statementEl, 'What industries are you focused on?', () => {
          gsap.to(pillsEl, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' });
        });
      },
    });
  }

  // ── Step 2 → Step 1 (previous / scroll-up) ───────────────────
  function revertToStep1() {
    // Remove the Previous button
    const prevBtn = actionsEl.querySelector('.services__prev');
    if (prevBtn) prevBtn.remove();

    nextBtn.style.pointerEvents = 'none';

    // Slide current step 2 content downward and out
    gsap.to([statementEl, pillsEl], {
      opacity: 0,
      y: 40,
      duration: 0.35,
      ease: 'power3.in',
      stagger: 0.05,
      onComplete: () => {
        // Restore step 1 pills (including previously selected state)
        pillsEl.innerHTML = step1PillsHTML;
        currentPills = Array.from(pillsEl.querySelectorAll('.services__pill'));
        currentStep  = 'services';
        bindPills(currentPills);

        // Reset voice callback back to step 1 pills
        voiceCallback = (transcript) => {
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

        // Restore the typed statement HTML directly (no re-typing on back nav)
        statementEl.innerHTML = step1StatementHTML;

        // Slide step 1 content back in from above
        gsap.fromTo(
          statementEl,
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
        );
        gsap.fromTo(
          pillsEl,
          { opacity: 0, y: -16 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.08 }
        );

        // Sync next button and preview with restored pill state
        updateNextBtn();
        updatePreview();
        reverting = false;
      },
    });
  }
});

// ── Preview grid module ───────────────────────────────────────────
// subset === null  → show all cards
// subset === []    → hide all cards
// subset = [...]   → show only those, hide the rest
function initPreview(pool) {
  const el = document.getElementById('services-preview');
  if (!el) return { activate() {}, deactivate() {}, update() {} };

  let isActive   = false;
  let cardEls    = [];
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

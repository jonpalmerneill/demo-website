import { initVoice } from './voice.js';
import { prefersLessMotion } from './motion.js';

// ── Shared helpers ─────────────────────────────────────────────────
function highlightMatch(result) {
  if (!result.matches || result.matches.length === 0) return result.item.label;
  const label = result.item.label;
  const match = result.matches[0];
  let out = '';
  let last = 0;
  for (const [start, end] of match.indices) {
    out += escapeHtml(label.slice(last, start));
    out += `<mark>${escapeHtml(label.slice(start, end + 1))}</mark>`;
    last = end + 1;
  }
  out += escapeHtml(label.slice(last));
  return out;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function initOverlay(industries, onShow) {
  const overlay    = document.getElementById('overlay');
  const scrim      = document.getElementById('overlay-scrim');
  const input      = document.getElementById('overlay-input');
  const dropdown   = document.getElementById('overlay-autocomplete');
  const dismissBtn = document.getElementById('overlay-dismiss');
  const micBtn     = document.getElementById('overlay-mic');
  const placeholderEl = document.getElementById('overlay-placeholder');

  if (!overlay || !input || !dropdown) return;

  // Capture original headline text before any DOM transformation
  const textEl      = overlay.querySelector('.overlay__text');
  const originalText = textEl ? textEl.textContent.trim() : '';

  // ─── Fuse.js fuzzy search ──────────────────────────────────────
  const fuse = new Fuse(industries, {
    keys: ['label'],
    threshold: 0.4,
    includeMatches: true,
  });

  const reducedMotion = prefersLessMotion();

  let selectedIndex = -1;
  let currentResults = [];

  function renderDropdown(results) {
    currentResults = results;
    selectedIndex = -1;

    dropdown.innerHTML = results
      .map((res, i) => {
        const label = highlightMatch(res);
        return `<button
          class="overlay__suggestion"
          id="overlay-suggestion-${i}"
          data-index="${i}"
          data-id="${res.item.id}"
          type="button"
        >${label}</button>`;
      })
      .join('');

    dropdown.classList.toggle('is-open', results.length > 0);
  }

  function closeDropdown() {
    dropdown.classList.remove('is-open');
    dropdown.innerHTML = '';
    currentResults = [];
    selectedIndex = -1;
    input.removeAttribute('aria-activedescendant');
  }

  function selectIndustry(industryId) {
    const industry = industries.find((i) => i.id === industryId);
    if (!industry) return;
    dismissOverlay(() => {
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('filter:set', {
          detail: { industry: industry.id },
        }));
      }, 400);
    });
  }

  // ─── Input events ──────────────────────────────────────────────
  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (input.value.length === 0 && placeholderEl) {
      placeholderEl.hidden = false;
      startTypewriter();
    }
    if (!query) {
      closeDropdown();
      return;
    }
    const results = fuse.search(query).slice(0, 6);
    renderDropdown(results);
  });

  input.addEventListener('keydown', () => {
    // Hide placeholder the instant a key is pressed, before value changes
    if (placeholderEl && !placeholderEl.hidden) {
      placeholderEl.hidden = true;
      stopTypewriter();
      resetCards();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('is-open')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      updateActiveItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateActiveItem();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && currentResults[selectedIndex]) {
        selectIndustry(currentResults[selectedIndex].item.id);
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  function updateActiveItem() {
    const items = dropdown.querySelectorAll('.overlay__suggestion');
    items.forEach((item, i) => {
      item.classList.toggle('is-active', i === selectedIndex);
    });
    if (selectedIndex >= 0) {
      input.setAttribute('aria-activedescendant', `overlay-suggestion-${selectedIndex}`);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  // ─── Dropdown click ────────────────────────────────────────────
  dropdown.addEventListener('click', (e) => {
    const btn = e.target.closest('.overlay__suggestion');
    if (btn) selectIndustry(btn.dataset.id);
  });

  let isShowing = false;

  // ─── Placeholder typewriter ───────────────────────────────────
  const PHRASES = [
    'An app that generates sales leads.',
    'A retail website for customers to find their perfect fit.',
    'Advanced software for predicting financial trends.',
  ];
  const TYPE_SPEED   = 55;
  const DELETE_SPEED = 28;
  const PAUSE_TYPED  = 1800;
  const PAUSE_CLEAR  = 380;

  let twTimer    = null;
  let twPhrase   = 0;
  let twChar     = 0;
  let twDeleting = false;

  // ─── Phrase card highlight ──────────────────────────────────────
  let isCardHighlightActive = false;
  let prevHighlightIds = new Set();

  function animatePhraseCards() {
    if (!isShowing || reducedMotion) return;
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) return;
    const allCards = Array.from(canvasEl.querySelectorAll('.card'));
    if (!allCards.length) return;

    const count = Math.max(1, Math.round(allCards.length * 0.25));

    // Prioritise cards NOT highlighted last cycle to guarantee a fresh selection
    const notPrev = [...allCards].filter(c => !prevHighlightIds.has(c.dataset.id))
                                 .sort(() => Math.random() - 0.5);
    const fromPrev = [...allCards].filter(c => prevHighlightIds.has(c.dataset.id))
                                  .sort(() => Math.random() - 0.5);
    const selected = [...notPrev, ...fromPrev].slice(0, count);
    const highlightSet = new Set(selected);
    prevHighlightIds = new Set(selected.map(c => c.dataset.id));

    isCardHighlightActive = true;
    allCards.forEach(card => {
      gsap.killTweensOf(card);
      if (highlightSet.has(card)) {
        gsap.to(card, {
          scale: 1.15, opacity: 1,
          duration: 0.7, ease: 'power2.out',
          onComplete: () => gsap.set(card, { clearProps: 'filter' }),
        });
      } else {
        gsap.to(card, {
          scale: 0.5, opacity: 0.3, filter: 'blur(3px)',
          duration: 0.7, ease: 'power2.out',
        });
      }
    });
  }

  function resetCards() {
    if (!isCardHighlightActive) return;
    isCardHighlightActive = false;
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) return;
    const allCards = Array.from(canvasEl.querySelectorAll('.card'));
    allCards.forEach(card => {
      gsap.killTweensOf(card);
      gsap.to(card, {
        scale: 1, opacity: 1,
        duration: 0.35, ease: 'power2.out',
        onComplete: () => gsap.set(card, { clearProps: 'filter' }),
      });
    });
  }

  function twStep() {
    if (!placeholderEl || input.value.length > 0) return;
    const text = PHRASES[twPhrase];
    if (!twDeleting) {
      twChar++;
      placeholderEl.textContent = text.slice(0, twChar);
      if (twChar === text.length) {
        animatePhraseCards();
        twTimer = setTimeout(() => { twDeleting = true; twStep(); }, PAUSE_TYPED);
        return;
      }
      twTimer = setTimeout(twStep, TYPE_SPEED);
    } else {
      twChar--;
      placeholderEl.textContent = text.slice(0, twChar);
      if (twChar === 0) {
        twPhrase = (twPhrase + 1) % PHRASES.length;
        twDeleting = false;
        twTimer = setTimeout(twStep, PAUSE_CLEAR);
        return;
      }
      twTimer = setTimeout(twStep, DELETE_SPEED);
    }
  }

  function startTypewriter() {
    clearTimeout(twTimer);
    twPhrase = 0; twChar = 0; twDeleting = false;
    if (placeholderEl) placeholderEl.textContent = '';
    twTimer = setTimeout(twStep, 500);
  }

  function stopTypewriter() {
    clearTimeout(twTimer);
    twTimer = null;
    if (placeholderEl) placeholderEl.textContent = '';
  }

  // ─── Dismiss ───────────────────────────────────────────────────
  function dismissOverlay(callback, immediate = false) {
    if (!isShowing) return;
    isShowing = false;
    stopTypewriter();
    resetCards();

    const dur = reducedMotion ? 0 : (immediate ? 0.18 : 0.4);

    gsap.killTweensOf(overlay);
    gsap.to(overlay, {
      opacity: 0,
      y: 24,
      duration: dur,
      ease: 'power2.in',
      onComplete: () => {
        overlay.style.display = 'none';
        if (callback) callback();
      },
    });
    gsap.killTweensOf(scrim);
    gsap.to(scrim, {
      opacity: 0,
      duration: dur,
      ease: 'power2.in',
      onComplete: () => scrim.classList.remove('is-visible'),
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => dismissOverlay());
  }

  // ─── Dismiss immediately on gallery or menu interaction ────────
  const viewport = document.getElementById('viewport');
  if (viewport) {
    viewport.addEventListener('pointerdown', () => dismissOverlay(null, true), { passive: true });
  }

  const navLogo = document.getElementById('nav-logo');
  if (navLogo) {
    navLogo.addEventListener('click', () => dismissOverlay(null, true));
  }

  // ─── Show overlay (called from main.js or trigger button) ───────
  function showOverlay() {
    isShowing = true;

    // Reset input state from any previous session
    input.value = '';
    closeDropdown();
    if (placeholderEl) placeholderEl.hidden = false;

    overlay.style.display = '';
    scrim.classList.add('is-visible');

    if (reducedMotion) {
      textEl.textContent = originalText;
      const inputRow = overlay.querySelector('.overlay__input-row');
      const dismiss  = overlay.querySelector('.overlay__dismiss');
      gsap.set(overlay,                              { opacity: 1, y: 0 });
      gsap.set(scrim,                                { opacity: 1 });
      gsap.set([inputRow, dismiss, micBtn].filter(Boolean), { opacity: 1 });
      input.focus();
      return;
    }

    // ── Build char spans (single sentence) ───────────────────────
    const makeSpans = (str, cls) =>
      str.split(' ').map((word) => {
        const letters = word.split('').map((c) =>
          `<span class="char ${cls}" style="display:inline-block">${c}</span>`
        ).join('');
        return `<span style="display:inline-block;white-space:nowrap">${letters}</span>`;
      }).join('<span style="display:inline-block">&nbsp;</span>');

    textEl.innerHTML = makeSpans(originalText, 's1');

    const chars    = textEl.querySelectorAll('.char.s1');
    const inputRow = overlay.querySelector('.overlay__input-row');
    const dismiss  = overlay.querySelector('.overlay__dismiss');
    const controls = [inputRow, dismiss, micBtn].filter(Boolean);

    // Hide input + controls so they animate in at the end
    gsap.set(controls, { opacity: 0 });

    // ── Container slides up from bottom ──────────────────────────
    gsap.fromTo(overlay,
      { opacity: 1, y: 24 },
      { y: 0, duration: 0.6, delay: 0.1, ease: 'power3.out' }
    );

    // ── Char blur-fade then input row ─────────────────────────────
    const tl = gsap.timeline({ delay: 0.25 });
    tl.fromTo(chars,
      { opacity: 0, filter: 'blur(8px)' },
      { opacity: 1, filter: 'blur(0px)', duration: 0.5, stagger: 0.025, ease: 'power2.out', clearProps: 'filter' }
    );
    tl.fromTo(controls,
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: 'power2.out', onComplete: startTypewriter },
      '>+0.3'
    );

    input.focus();

    gsap.fromTo(scrim,
      { opacity: 0 },
      { opacity: 1, duration: 0.6, delay: 0.1, ease: 'power2.out' }
    );
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!overlay.contains(e.target)) closeDropdown();
  });

  // ─── Focus trap ────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (!isShowing || e.key !== 'Tab') return;
    const focusable = Array.from(
      overlay.querySelectorAll('input:not([disabled]), button:not([disabled])')
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });

  // ─── Voice input ───────────────────────────────────────────────
  initVoice(micBtn, originalText, (transcript) => {
    // Prepare the input: clear placeholder + typewriter
    if (placeholderEl) placeholderEl.hidden = true;
    stopTypewriter();
    resetCards();
    input.value = '';
    closeDropdown();

    // Type transcript into the input character-by-character,
    // firing `input` events so Fuse search updates on each keystroke
    let i = 0;
    function typeChar() {
      i++;
      input.value = transcript.slice(0, i);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (i < transcript.length) {
        setTimeout(typeChar, 42 + Math.random() * 18);
      } else {
        // Auto-select the top Fuse result once typing finishes
        setTimeout(() => {
          if (currentResults.length > 0) {
            selectIndustry(currentResults[0].item.id);
          }
        }, 380);
      }
    }
    setTimeout(typeChar, 60);
  });

  onShow(showOverlay);
}

// ── Nav prompt — same search UX inside the full-screen nav menu ──────
export function initNavPrompt({ input, dropdown, micBtn }, industries, closeNav) {
  if (!input || !dropdown) return;

  const fuse = new Fuse(industries, {
    keys: ['label'],
    threshold: 0.4,
    includeMatches: true,
  });

  let selectedIndex = -1;
  let currentResults = [];

  function renderDropdown(results) {
    currentResults = results;
    selectedIndex = -1;
    dropdown.innerHTML = results.map((res, i) =>
      `<button class="nav__prompt-suggestion" data-index="${i}" data-id="${res.item.id}" type="button">${highlightMatch(res)}</button>`
    ).join('');
    dropdown.classList.toggle('is-open', results.length > 0);
  }

  function closeDropdown() {
    dropdown.classList.remove('is-open');
    dropdown.innerHTML = '';
    currentResults = [];
    selectedIndex = -1;
  }

  function selectIndustry(industryId) {
    const industry = industries.find(i => i.id === industryId);
    if (!industry) return;
    input.value = '';
    closeDropdown();
    if (closeNav) closeNav();
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('filter:set', { detail: { industry: industry.id } }));
    }, 500);
  }

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (!query) { closeDropdown(); return; }
    renderDropdown(fuse.search(query).slice(0, 6));
  });

  input.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('is-open')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && currentResults[selectedIndex]) {
        selectIndustry(currentResults[selectedIndex].item.id);
      }
      return;
    } else if (e.key === 'Escape') {
      closeDropdown();
      return;
    }
    dropdown.querySelectorAll('.nav__prompt-suggestion').forEach((el, i) => {
      el.classList.toggle('is-active', i === selectedIndex);
    });
  });

  dropdown.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav__prompt-suggestion');
    if (btn) selectIndustry(btn.dataset.id);
  });

  // Clear input and dropdown when nav closes
  const navMenu = document.getElementById('nav-menu');
  if (navMenu) {
    new MutationObserver(() => {
      if (!navMenu.classList.contains('is-open')) {
        input.value = '';
        closeDropdown();
      }
    }).observe(navMenu, { attributes: true, attributeFilter: ['class'] });
  }

  initVoice(micBtn, 'What would you like to build?', (transcript) => {
    input.value = '';
    closeDropdown();
    let i = 0;
    function typeChar() {
      i++;
      input.value = transcript.slice(0, i);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (i < transcript.length) {
        setTimeout(typeChar, 42 + Math.random() * 18);
      } else {
        setTimeout(() => {
          if (currentResults.length > 0) selectIndustry(currentResults[0].item.id);
        }, 380);
      }
    }
    setTimeout(typeChar, 60);
  });
}

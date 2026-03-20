import { resolveVoice } from './voice.js';

const PLAY_SVG  = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><polygon points="5,2 17,10 5,18"/></svg>`;
const PAUSE_SVG = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="4" height="14" rx="1"/><rect x="12" y="3" width="4" height="14" rx="1"/></svg>`;

// Approximate chars per second at speech rate 1.0 (~150 wpm, ~5 chars/word)
const CHARS_PER_SEC = 12;

// ── Collect readable text segments in document order ──────────
function collectSegments() {
  const segs = [];
  const meta  = document.querySelector('.project__meta');
  const title = document.querySelector('.project__title');
  const intro = document.querySelector('.project__intro');
  if (meta)  segs.push(meta);
  if (title) segs.push(title);
  if (intro) segs.push(intro);
  document.querySelectorAll('.project__body > p:not(.project__intro)').forEach(p => segs.push(p));
  const quoteP    = document.querySelector('.project__quote p');
  const quoteCite = document.querySelector('.project__quote cite');
  if (quoteP)    segs.push(quoteP);
  if (quoteCite) segs.push(quoteCite);
  return segs;
}

// Wrap every character in a .rc span and return the span array.
// The element's textContent is preserved; origHTML is stored by the caller.
function wrapChars(el) {
  const text = el.textContent;
  const frag = document.createDocumentFragment();
  const spans = Array.from(text).map(ch => {
    const s = document.createElement('span');
    s.className = 'rc';
    s.textContent = ch;
    frag.appendChild(s);
    return s;
  });
  el.innerHTML = '';
  el.appendChild(frag);
  return spans;
}

function revealUpTo(spans, idx) {
  for (let i = 0; i < Math.min(idx, spans.length); i++) {
    spans[i].classList.add('rc--shown');
  }
}

// ─────────────────────────────────────────────────────────────────
// initReader(playBtn)
// ─────────────────────────────────────────────────────────────────
export function initReader(playBtn) {
  if (!playBtn || !window.speechSynthesis) {
    if (playBtn) playBtn.hidden = true;
    return;
  }

  let state    = 'idle';
  let segments = [];
  let segSpans = []; // span arrays, one per segment
  let segIdx   = 0;
  let revealTimer = null;
  let revealPos   = 0;
  const origHTML = new Map();

  playBtn.innerHTML = PLAY_SVG;

  function setState(next) {
    state = next;
    playBtn.innerHTML = next === 'playing' ? PAUSE_SVG : PLAY_SVG;
    playBtn.setAttribute('aria-label', next === 'playing' ? 'Pause reading' : 'Read aloud');
    playBtn.classList.toggle('is-active', next !== 'idle');
    document.documentElement.classList.toggle('is-reading-mode', next !== 'idle');
  }

  function stopRevealTimer() {
    if (revealTimer) { clearInterval(revealTimer); revealTimer = null; }
  }

  function startRevealTimer(spans, rate) {
    stopRevealTimer();
    revealPos = 0;
    const ms = 1000 / (CHARS_PER_SEC * (rate || 1));
    revealTimer = setInterval(() => {
      revealPos++;
      revealUpTo(spans, revealPos);
      if (revealPos >= spans.length) stopRevealTimer();
    }, ms);
  }

  function restoreAll() {
    stopRevealTimer();
    segments.forEach(el => {
      const orig = origHTML.get(el);
      if (orig !== undefined) el.innerHTML = orig;
      el.classList.remove('is-reading');
    });
    origHTML.clear();
    segments = [];
    segSpans = [];
  }

  function stop() {
    window.speechSynthesis.cancel();
    restoreAll();
    segIdx = 0;
    setState('idle');
  }

  async function readFrom(idx) {
    if (state !== 'playing') return;
    if (idx >= segments.length) { stop(); return; }

    segIdx = idx;
    segments.forEach((el, i) => el.classList.toggle('is-reading', i === idx));

    const el    = segments[idx];
    const spans = segSpans[idx];
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Ensure all past segments are fully revealed
    for (let i = 0; i < idx; i++) {
      segSpans[i].forEach(s => s.classList.add('rc--shown'));
    }

    const text = el.textContent.trim();
    if (!text) {
      el.classList.remove('is-reading');
      readFrom(idx + 1);
      return;
    }

    const voice = await resolveVoice();
    if (state !== 'playing') return;

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.92;
    if (voice) utt.voice = voice;

    // Timer-based reveal (fallback + all browsers)
    startRevealTimer(spans, utt.rate);

    // Word boundary events (Chrome/Edge) advance reveal ahead of the timer
    utt.addEventListener('boundary', (e) => {
      if (e.name !== 'word') return;
      const ahead = e.charIndex + (e.charLength ?? 1);
      if (ahead > revealPos) {
        revealPos = ahead;
        revealUpTo(spans, ahead);
      }
    });

    utt.onend = () => {
      stopRevealTimer();
      spans.forEach(s => s.classList.add('rc--shown')); // ensure fully revealed
      el.classList.remove('is-reading');
      setTimeout(() => { if (state === 'playing') readFrom(idx + 1); }, 180);
    };

    utt.onerror = () => {
      stopRevealTimer();
      spans.forEach(s => s.classList.add('rc--shown'));
      el.classList.remove('is-reading');
      setTimeout(() => { if (state === 'playing') readFrom(idx + 1); }, 180);
    };

    window.speechSynthesis.speak(utt);
  }

  function startReading() {
    segments = collectSegments();
    origHTML.clear();
    // Wrap all chars upfront — all text starts dim simultaneously with layout change
    segSpans = segments.map(el => {
      origHTML.set(el, el.innerHTML);
      return wrapChars(el);
    });
    segIdx = 0;
    setState('playing');
    const header = document.querySelector('.project__header');
    if (header) header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => readFrom(0), 400);
  }

  function pauseReading() {
    stopRevealTimer();
    setState('paused');
    window.speechSynthesis.cancel();
    // Partial reveal stays visible so the user sees where they stopped
  }

  function resumeReading() {
    // Re-wrap current segment so it restarts from dim
    const el = segments[segIdx];
    if (el) {
      const orig = origHTML.get(el);
      if (orig !== undefined) el.innerHTML = orig;
      el.classList.remove('is-reading');
      segSpans[segIdx] = wrapChars(el);
    }
    setState('playing');
    readFrom(segIdx);
  }

  // Prevent scrubber's setPointerCapture from hijacking click events
  playBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

  playBtn.addEventListener('click', () => {
    if (state === 'idle')         startReading();
    else if (state === 'playing') pauseReading();
    else if (state === 'paused')  resumeReading();
  });

  window.addEventListener('beforeunload', () => window.speechSynthesis.cancel());
}

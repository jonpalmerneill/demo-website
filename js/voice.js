// ── Browser support detection ──────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// ── Voice selection ────────────────────────────────────────────────
// Ordered by quality: macOS/iOS neural enhanced voices first, then
// Windows neural online, then decent cross-platform fallbacks.
const VOICE_PRIORITY = [
  // macOS / iOS — neural enhanced (user must download in System Settings
  // → Accessibility → Spoken Content, but they sound genuinely natural)
  'Ava', 'Nicky', 'Tom', 'Reed', 'Evan', 'Shelley',
  // Windows — neural online voices (stream from Microsoft, very natural)
  'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy',
  // macOS / iOS — classic built-in (good quality, always present)
  'Samantha', 'Alex',
  // Quality regional English voices
  'Karen', 'Daniel', 'Moira', 'Tessa',
  // Chrome built-in Google voices
  'Google UK English Female', 'Google US English',
  // Windows desktop fallbacks
  'Microsoft Zira', 'Microsoft David',
];

function pickBestVoice(voices) {
  const english = voices.filter(v => v.lang.startsWith('en'));
  for (const name of VOICE_PRIORITY) {
    const match = english.find(v => v.name.includes(name));
    if (match) return match;
  }
  return english[0] ?? voices[0] ?? null;
}

// Voices load async in Chrome — resolve once and cache the result.
let voicePromise = null;
export function resolveVoice() {
  if (voicePromise) return voicePromise;
  voicePromise = new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(pickBestVoice(voices)); return; }
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => resolve(pickBestVoice(window.speechSynthesis.getVoices())),
      { once: true }
    );
  });
  return voicePromise;
}

// ── Two-note ascending chime (E5 → B5) via Web Audio API ──────────
function playChime() {
  return new Promise(resolve => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      const notes = [
        { freq: 659, start: 0,    dur: 0.28, gain: 0.20 },  // E5
        { freq: 988, start: 0.12, dur: 0.38, gain: 0.16 },  // B5
      ];

      notes.forEach(({ freq, start, dur, gain }) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g);
        g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + start;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.start(t);
        osc.stop(t + dur);
      });

      setTimeout(resolve, 540);
    } catch {
      resolve();
    }
  });
}

// ── Speak a string via SpeechSynthesis ────────────────────────────
async function speak(text) {
  return new Promise(async resolve => {
    if (!window.speechSynthesis) { resolve(); return; }
    const voice = await resolveVoice();
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate  = 1.0;
    utt.pitch = 1.0;
    if (voice) utt.voice = voice;
    utt.onend   = resolve;
    utt.onerror = resolve;
    window.speechSynthesis.speak(utt);
  });
}

// ─────────────────────────────────────────────────────────────────
// initVoice(micBtn, promptText, onTranscript)
//
//   micBtn       — the <button> element in the overlay
//   promptText   — string to read aloud before listening
//   onTranscript — called with the recognised string when done
// ─────────────────────────────────────────────────────────────────
export function initVoice(micBtn, promptText, onTranscript) {
  if (!micBtn) return;

  // Hide the button entirely if the browser doesn't support the APIs
  if (!SpeechRecognition || !window.speechSynthesis) {
    micBtn.hidden = true;
    return;
  }

  // Kick off voice loading now so it's ready before the user clicks
  resolveVoice();

  let state       = 'idle'; // idle | speaking | listening
  let recognition = null;

  function setState(next) {
    state = next;
    micBtn.classList.toggle('is-speaking',  next === 'speaking');
    micBtn.classList.toggle('is-listening', next === 'listening');
    micBtn.setAttribute('aria-label',
      next === 'speaking'  ? 'Speaking…'               :
      next === 'listening' ? 'Listening — tap to cancel' :
      'Voice input'
    );
  }

  function reset() {
    window.speechSynthesis.cancel();
    if (recognition) { try { recognition.abort(); } catch { /* ignore */ } recognition = null; }
    setState('idle');
  }

  micBtn.addEventListener('click', async () => {
    // Any active state: cancel and return to idle
    if (state !== 'idle') { reset(); return; }

    // ── 1. Read the prompt aloud ────────────────────────────────
    setState('speaking');
    await speak(promptText);
    if (state !== 'speaking') return; // cancelled mid-speech

    // ── 2. Chime ────────────────────────────────────────────────
    await playChime();
    if (state !== 'speaking') return;

    // ── 3. Start listening ──────────────────────────────────────
    setState('listening');

    recognition = new SpeechRecognition();
    recognition.continuous      = false;
    recognition.interimResults  = false;
    recognition.maxAlternatives = 1;
    recognition.lang            = 'en-US';

    recognition.addEventListener('result', (e) => {
      const transcript = e.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setState('idle');
        recognition = null;
        onTranscript(transcript);
      }
    });

    recognition.addEventListener('end', () => {
      if (state === 'listening') setState('idle');
    });

    recognition.addEventListener('error', () => {
      setState('idle');
    });

    try {
      recognition.start();
    } catch {
      setState('idle');
    }
  });
}

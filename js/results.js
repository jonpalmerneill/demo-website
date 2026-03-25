import { enterPage, leavePage } from './transition.js';
import { initNav } from './nav.js';
import { prefersLessMotion } from './motion.js';
import { initCursor } from './cursor.js';
import { projects } from './data.js';

// Maps services-page industry pill labels → project industry IDs in data.js
const INDUSTRY_MAP = {
  'Healthcare':               'healthcare',
  'Entertainment and media':  'media',
  'Tourism and hospitality':  'hospitality',
  'Automotive':               'automotive',
  'Sports and fitness':       'sport',
  'Advertising and marketing':'media',
  'Telecommunications':       'technology',
};

const INSIGHTS = [
  {
    tag: 'Insight',
    title: 'Designing for Healthcare: Clarity Under Pressure',
    body: 'How we approach UX in high-stakes environments where clarity directly shapes outcomes.',
  },
  {
    tag: 'Article',
    title: 'The Hidden ROI of Accessible Design',
    body: 'Why digital accessibility is more than a compliance checkbox — it\'s a measurable competitive edge.',
  },
  {
    tag: 'Insight',
    title: 'From Vision to Version 1',
    body: 'The questions we ask at the start of every product engagement to align teams and reduce friction.',
  },
];

// ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  enterPage();
  initCursor();
  initNav();

  // Read quiz answers saved by services.js
  let quiz = { services: [], industries: [], goals: [] };
  try {
    const raw = localStorage.getItem('carnevale_quiz');
    if (raw) quiz = JSON.parse(raw);
  } catch (e) { /* malformed — use empty defaults */ }

  const statementEl = document.querySelector('.results__statement');
  const gridEl      = document.querySelector('.results__grid');

  // Back link uses page transition instead of hard navigation
  const backLink = document.querySelector('.project-back');
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      leavePage('services.html');
    });
  }

  const keywords = [...quiz.services, ...quiz.industries, ...quiz.goals];

  // Delay matches the enterPage blur dissolve so typing starts as it clears
  setTimeout(() => {
    animateStatement(statementEl, buildStatement(quiz), keywords, () => {
      buildCards(gridEl, quiz);
      animateCards(gridEl);
    });
  }, 900);
});

// ── Statement ─────────────────────────────────────────────────────
function joinList(arr) {
  if (!arr.length) return '';
  const items = arr.map(s => s.toLowerCase());
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}

function buildStatement({ services, industries, goals }) {
  const s   = joinList(services);
  const ind = joinList(industries);
  const g   = joinList(goals);

  const sentence1 = (s && ind)
    ? `We bring deep experience in ${s}, with a proven track record of work across ${ind}.`
    : s
      ? `We bring deep experience in ${s}, delivering precise, considered work for ambitious clients.`
      : 'We bring deep experience delivering precise, considered work for ambitious clients.';

  const sentence2 = g
    ? `We're experienced in translating goals like ${g} into actionable strategies and lasting outcomes.`
    : 'We translate ambition into clear, actionable strategies and lasting outcomes.';

  return `${sentence1} ${sentence2}`;
}

function animateStatement(el, text, keywords, onDone) {
  if (prefersLessMotion()) {
    el.innerHTML = applyKeywordHTML(text, keywords);
    if (onDone) onDone();
    return;
  }

  el.innerHTML = text
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
      stagger: 0.015,
      ease: 'power2.out',
      clearProps: 'filter',
      onComplete: () => {
        boldKeywordSpans(el, keywords);
        if (onDone) onDone();
      },
    }
  );
}

// After the typewriter renders, find word spans matching each keyword and
// inject an animated underline line that draws left-to-right via scaleX.
// Normalises both sides so punctuation / slashes don't break matching.
function boldKeywordSpans(el, keywords) {
  const wordSpans = Array.from(
    el.querySelectorAll('span[style*="white-space:nowrap"]')
  );
  const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
  const spanNorms = wordSpans.map(s => norm(s.textContent));

  keywords.forEach(keyword => {
    const kwParts = keyword.toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    for (let i = 0; i <= spanNorms.length - kwParts.length; i++) {
      if (kwParts.every((kw, j) => spanNorms[i + j] === kw)) {
        kwParts.forEach((_, j) => {
          const span = wordSpans[i + j];
          span.style.position = 'relative';

          const line = document.createElement('span');
          line.className = 'results__underline';
          span.appendChild(line);

          // Stagger each word in a multi-word phrase by 60ms
          gsap.to(line, {
            scaleX: 1,
            duration: 0.5,
            ease: 'power2.out',
            delay: j * 0.06,
          });
        });
      }
    }
  });
}

// For reduced-motion: wrap keywords in a span that gets a static underline
function applyKeywordHTML(text, keywords) {
  let html = text;
  [...keywords]
    .sort((a, b) => b.length - a.length) // longest first prevents sub-matches
    .forEach(kw => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(
        new RegExp(`(${escaped})`, 'gi'),
        '<span class="results__keyword">$1</span>'
      );
    });
  return html;
}

// Per-item note positions — percentage-based so gap scales with screen width.
// Card is centred at 65% item width → side zones are 17.5% each.
// Notes at left/right 2% with width 12% → guaranteed ~3.5% gap to card edge.
const NOTE_POSITIONS = [
  { css: 'left: 2%; top: 22%;',     width: '12%' },
  { css: 'right: 2%; top: 10%;',    width: '12%' },
  { css: 'left: 2%; top: 52%;',     width: '12%' },
  { css: 'right: 2%; top: 38%;',    width: '12%' },
  { css: 'left: 2%; bottom: 20%;',  width: '12%' },
  { css: 'right: 2%; bottom: 14%;', width: '12%' },
];

// Small rotation applied to each handwritten note
const NOTE_ROTS = [-3.5, 2.8, -2.5, 1.5, -4.2, 2.2];

// Per-card scatter: [x offset (px), rotation (deg)]
// Even items have notes on the left  → positive x shifts card right (widens gap)
// Odd  items have notes on the right → negative x shifts card left  (widens gap)
const CARD_OFFSETS = [
  [ 32, -0.6],
  [-26,  0.5],
  [ 22, -0.4],
  [-38,  0.7],
  [ 28, -0.5],
  [-18,  0.4],
];

// ── Project selection ─────────────────────────────────────────────
// Pick 3 projects most relevant to the visitor's chosen industries,
// falling back to featured projects if there aren't enough matches.
function pickProjects({ industries }) {
  const mappedIds = industries
    .map(label => INDUSTRY_MAP[label])
    .filter(Boolean);

  const pool = projects.filter(p => {
    const img = p.poster || p.image;
    return img && !img.endsWith('.mp4');
  });

  const scored = pool
    .map(p => ({
      p,
      score: p.industries.filter(id => mappedIds.includes(id)).length
             + (p.featured ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const picked = scored.slice(0, 3).map(s => s.p);

  if (picked.length < 3) {
    const usedIds = new Set(picked.map(p => p.id));
    const extras = pool
      .filter(p => !usedIds.has(p.id))
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    while (picked.length < 3 && extras.length) picked.push(extras.shift());
  }

  return picked;
}

// ── Note generation ───────────────────────────────────────────────
function generateNote(type, item, quiz, index) {
  const { services, industries, goals } = quiz;
  const g   = goals[index % Math.max(goals.length, 1)]       || goals[0]      || '';
  const s   = services[index % Math.max(services.length, 1)] || services[0]   || '';
  const ind = industries[index % Math.max(industries.length, 1)] || industries[0] || '';

  if (type === 'project') {
    const matchedLabel = industries.find(label => {
      const id = INDUSTRY_MAP[label];
      return id && item.industries.includes(id);
    });

    if (matchedLabel && g) {
      return [
        `${matchedLabel} work that speaks directly to your ${g.toLowerCase()} goal.`,
        `This is what ${g.toLowerCase()} looks like in a ${matchedLabel.toLowerCase()} context.`,
        `Your ${matchedLabel.toLowerCase()} focus × your ${g.toLowerCase()} goal — this is that overlap.`,
      ][index % 3];
    }
    if (matchedLabel) {
      return [
        `Right in your ${matchedLabel.toLowerCase()} world.`,
        `Your ${matchedLabel.toLowerCase()} work — this is the territory.`,
        `A benchmark for ${matchedLabel.toLowerCase()} work done well.`,
      ][index % 3];
    }
    if (g) {
      return [
        `Strong reference for your ${g.toLowerCase()} ambitions.`,
        `Connects directly to your ${g.toLowerCase()} thinking.`,
        `Relevant to anyone chasing ${g.toLowerCase()}.`,
      ][index % 3];
    }
    return ['One of our sharpest pieces of work.', 'A benchmark project.', 'Worth a close look.'][index % 3];
  }

  if (type === 'insight') {
    if (g) {
      return [
        `Useful context for your ${g.toLowerCase()} journey.`,
        `We wrote this for clients chasing ${g.toLowerCase()}.`,
        `A framework that maps directly to your ${g.toLowerCase()} goal.`,
      ][index % 3];
    }
    if (s) return `Directly relevant to your ${s.toLowerCase()} work.`;
    return 'Worth a close read.';
  }
}

// ── Card rendering ────────────────────────────────────────────────
// Each card gets its own .results__item row. The note sits outside
// the card in the side-padding zone; an SVG arrow links them.
function buildCards(gridEl, quiz) {
  const allItems = [];

  pickProjects(quiz).forEach((p, i) => {
    const noteText = generateNote('project', p, quiz, i);
    const card = document.createElement('div');
    card.className = 'results__card results__card--project';
    card.innerHTML = `
      <img src="${p.poster || p.image}" alt="${p.title}" loading="lazy" decoding="async" />
      <div class="results__card-overlay">
        <div class="results__card-meta">
          <p class="results__card-client">${p.client}</p>
          <h3 class="results__card-title">${p.title}</h3>
        </div>
      </div>
    `;
    allItems.push({ card, noteText });
  });

  INSIGHTS.forEach((insight, i) => {
    const noteText = generateNote('insight', insight, quiz, i);
    const card = document.createElement('div');
    card.className = 'results__card results__card--insight';
    card.innerHTML = `
      <div class="results__card-content">
        <span class="results__card-tag">${insight.tag}</span>
        <h3 class="results__card-title">${insight.title}</h3>
        <p class="results__card-body">${insight.body}</p>
      </div>
    `;
    allItems.push({ card, noteText });
  });

  allItems.forEach(({ card, noteText }, i) => {
    const pos = NOTE_POSITIONS[i % NOTE_POSITIONS.length];
    const rot = NOTE_ROTS[i % NOTE_ROTS.length];

    const item = document.createElement('div');
    item.className = 'results__item';

    // Note wrap — positioned in the side-padding zone, outside the card
    const noteWrap = document.createElement('div');
    noteWrap.className = 'results__note-wrap';
    noteWrap.style.cssText = `${pos.css} width: ${pos.width};`;

    const noteEl = document.createElement('p');
    noteEl.className = 'results__note';
    noteEl.style.transform = `rotate(${rot}deg)`;
    noteEl.textContent = noteText;
    noteWrap.appendChild(noteEl);

    // SVG arrow — path is drawn by drawArrows() after animation completes
    const svgWrapper = document.createElement('div');
    svgWrapper.innerHTML = `<svg class="results__arrow" aria-hidden="true">
      <defs>
        <marker id="ah-${i}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="currentColor" opacity="0.4" />
        </marker>
      </defs>
      <path class="results__arrow-path" fill="none" stroke="currentColor" stroke-width="1.2"
            marker-end="url(#ah-${i})" opacity="0.4" />
    </svg>`;
    const arrowSvg = svgWrapper.firstElementChild;

    item.appendChild(card);
    item.appendChild(noteWrap);
    item.appendChild(arrowSvg);
    gridEl.appendChild(item);
  });
}

function animateCards(gridEl) {
  const items  = Array.from(gridEl.querySelectorAll('.results__item'));
  const cards  = items.map(item => item.querySelector('.results__card'));
  const noteWs = items.map(item => item.querySelector('.results__note-wrap'));

  // Apply scatter offsets + set initial invisible state
  cards.forEach((card, i) => {
    const [x, rot] = CARD_OFFSETS[i % CARD_OFFSETS.length];
    gsap.set(card, { x, rotation: rot, y: 60, opacity: 0 });
  });
  noteWs.forEach(nw => nw && gsap.set(nw, { opacity: 0 }));

  if (prefersLessMotion()) {
    cards.forEach(card => gsap.set(card, { y: 0, opacity: 1 }));
    noteWs.forEach(nw => nw && gsap.set(nw, { opacity: 1 }));
    drawArrows(gridEl);
    return;
  }

  // Each card reveals when it scrolls into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);

      const card = entry.target;
      const idx  = cards.indexOf(card);
      const nw   = noteWs[idx];
      const item = items[idx];

      gsap.to(card, {
        y: 0, opacity: 1,
        duration: 0.75,
        ease: 'power3.out',
        onComplete: () => {
          if (!nw) { drawArrow(item, idx); return; }
          gsap.to(nw, {
            opacity: 1, duration: 0.45, ease: 'power2.out',
            onComplete: () => drawArrow(item, idx),
          });
        },
      });
    });
  }, { threshold: 0.15 });

  cards.forEach(card => observer.observe(card));
}

// Draw the arrow for a single item (called after its card + note have animated in)
function drawArrow(item, i) {
  const card     = item.querySelector('.results__card');
  const noteWrap = item.querySelector('.results__note-wrap');
  const pathEl   = item.querySelector('.results__arrow-path');

    const iRect = item.getBoundingClientRect();
    const cRect = card.getBoundingClientRect();
    const nRect = noteWrap.getBoundingClientRect();

    // Convert to item-local coordinates
    const local = r => ({
      l:  r.left   - iRect.left,
      t:  r.top    - iRect.top,
      r:  r.right  - iRect.left,
      b:  r.bottom - iRect.top,
      cx: r.left + r.width  / 2 - iRect.left,
      cy: r.top  + r.height / 2 - iRect.top,
    });

    const n = local(nRect);
    const c = local(cRect);

    // Arrow end: nearest card edge, clamped to avoid corners
    let ex, ey;
    if (nRect.right < cRect.left) {
      ex = c.l;
      ey = Math.max(c.t + 20, Math.min(c.b - 20, n.cy));
    } else if (nRect.left > cRect.right) {
      ex = c.r;
      ey = Math.max(c.t + 20, Math.min(c.b - 20, n.cy));
    } else if (nRect.bottom < cRect.top) {
      ex = Math.max(c.l + 20, Math.min(c.r - 20, n.cx));
      ey = c.t;
    } else {
      ex = Math.max(c.l + 20, Math.min(c.r - 20, n.cx));
      ey = c.b;
    }

    // Arrow start: note edge facing the card (keeps path clear of text)
    let sx, sy;
    if (nRect.right < cRect.left) {
      sx = n.r;  sy = n.cy;  // note is left  → start from its right edge
    } else if (nRect.left > cRect.right) {
      sx = n.l;  sy = n.cy;  // note is right → start from its left edge
    } else if (nRect.bottom < cRect.top) {
      sx = n.cx; sy = n.b;   // note is above → start from its bottom edge
    } else {
      sx = n.cx; sy = n.t;   // note is below → start from its top edge
    }

    // Shorten end so arrowhead sits at card edge (not inside)
    const dx = ex - sx;
    const dy = ey - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) return; // skip if note and card are too close
    const trim = 6;
    const fx = sx + dx * (dist - trim) / dist;
    const fy = sy + dy * (dist - trim) / dist;

    // Gentle quadratic bezier bow
    const mx  = (sx + fx) / 2;
    const my  = (sy + fy) / 2;
    const bow = 0.22;
    const cx2 = mx - (fy - sy) * bow;
    const cy2 = my + (fx - sx) * bow;

    const d = `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx2.toFixed(1)},${cy2.toFixed(1)} ${fx.toFixed(1)},${fy.toFixed(1)}`;
    pathEl.setAttribute('d', d);

    // Measure true path length and animate stroke draw
    const length = pathEl.getTotalLength();
    pathEl.style.strokeDasharray = length;
    pathEl.style.strokeDashoffset = length;
    gsap.to(pathEl, {
      strokeDashoffset: 0,
      duration: 0.7,
      ease: 'power2.inOut',
    });
}

// Convenience wrapper — draws all arrows at once (used by reduced-motion path)
function drawArrows(gridEl) {
  Array.from(gridEl.querySelectorAll('.results__item')).forEach((item, i) => {
    drawArrow(item, i);
  });
}

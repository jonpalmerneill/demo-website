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
    el.innerHTML = applyBoldHTML(text, keywords);
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

// After the typewriter renders, find word spans matching each keyword
// and apply bold weight. Normalises both sides so punctuation and
// slash-separated terms (e.g. "Manufacturing / industrial") still match.
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
        for (let j = 0; j < kwParts.length; j++) {
          wordSpans[i + j].style.fontWeight = '800';
        }
      }
    }
  });
}

// For reduced-motion: regex-wrap keywords in <strong> directly in the text
function applyBoldHTML(text, keywords) {
  let html = text;
  [...keywords]
    .sort((a, b) => b.length - a.length) // longest first prevents sub-matches
    .forEach(kw => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(`(${escaped})`, 'gi'), '<strong>$1</strong>');
    });
  return html;
}

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

  // Score by number of matching industries + a bonus for featured
  const scored = pool
    .map(p => ({
      p,
      score: p.industries.filter(id => mappedIds.includes(id)).length
             + (p.featured ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const picked = scored.slice(0, 3).map(s => s.p);

  // Fill any remaining slots with top featured projects
  if (picked.length < 3) {
    const usedIds = new Set(picked.map(p => p.id));
    const extras = pool
      .filter(p => !usedIds.has(p.id))
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    while (picked.length < 3 && extras.length) picked.push(extras.shift());
  }

  return picked;
}

// ── Card rendering ────────────────────────────────────────────────
function buildCards(gridEl, quiz) {
  pickProjects(quiz).forEach(p => {
    const card = document.createElement('div');
    card.className = 'results__card results__card--project';
    card.innerHTML = `
      <img src="${p.poster || p.image}" alt="${p.title}" loading="lazy" decoding="async" />
      <div class="results__card-info">
        <p class="results__card-client">${p.client}</p>
        <h3 class="results__card-title">${p.title}</h3>
      </div>
    `;
    gridEl.appendChild(card);
  });

  INSIGHTS.forEach(insight => {
    const card = document.createElement('div');
    card.className = 'results__card results__card--insight';
    card.innerHTML = `
      <span class="results__card-tag">${insight.tag}</span>
      <h3 class="results__card-title">${insight.title}</h3>
      <p class="results__card-body">${insight.body}</p>
    `;
    gridEl.appendChild(card);
  });
}

function animateCards(gridEl) {
  const cards = Array.from(gridEl.querySelectorAll('.results__card'));
  if (prefersLessMotion()) {
    gsap.set(cards, { opacity: 1, y: 0 });
    return;
  }
  gsap.fromTo(
    cards,
    { opacity: 0, y: 48 },
    { opacity: 1, y: 0, duration: 0.65, stagger: 0.1, ease: 'power3.out' }
  );
}

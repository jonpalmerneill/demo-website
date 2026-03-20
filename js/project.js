import { initNav } from './nav.js';
import { enterPage, leavePage } from './transition.js';
import { projects, industries } from './data.js';
import { initReader } from './reader.js';
import { prefersLessMotion } from './motion.js';
import { initCursor } from './cursor.js';

document.addEventListener('DOMContentLoaded', () => {
  enterPage();
  initCursor();
  initNav();

  initProjectFromSelection();

  // Intercept back link to animate out before navigating
  const backLink = document.querySelector('.project-back');
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      leavePage('index.html');
    });
  }

  initScrubber();
  initRelated();

  const reducedMotion = prefersLessMotion();
  if (reducedMotion) return;

  // Per-element entrance: title and hero slide up as page blurs in
  const meta  = document.querySelector('.project__meta');
  const title = document.querySelector('.project__title');
  const hero  = document.querySelector('.project__hero');

  if (meta)  gsap.from(meta,  { y: 16, duration: 0.6, ease: 'power3.out', delay: 0.15 });
  if (title) gsap.from(title, { y: 44, duration: 0.9, ease: 'power3.out', delay: 0.25 });
  if (hero)  gsap.from(hero,  { y: 30, duration: 1.0, ease: 'power3.out', delay: 0.45 });

  // Scroll-triggered reveal for body content and visuals
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      gsap.to(entry.target, { y: 0, opacity: 1, duration: 0.65, ease: 'power3.out' });
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.project__body > p, .project__quote, .project__visual').forEach(el => {
    gsap.set(el, { y: 28, opacity: 0 });
    observer.observe(el);
  });
});

function initProjectFromSelection() {
  const main = document.querySelector('[data-project-id]');
  if (!main) return;

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('project');
  const fromSession = sessionStorage.getItem('selectedProjectId');
  const selectedId = fromUrl || fromSession || main.dataset.projectId;
  if (!selectedId) return;

  const current = projects.find(p => p.id === selectedId);
  if (!current) return;

  main.dataset.projectId = current.id;
  hydrateProjectPage(current);
}

function hydrateProjectPage(project) {
  const meta = document.querySelector('.project__meta');
  const title = document.querySelector('.project__title');
  const heroImg = document.querySelector('.project__hero img');

  if (title) title.textContent = project.title;

  if (meta) {
    const primaryIndustryId = Array.isArray(project.industries) ? project.industries[0] : null;
    const industryLabel = industries.find(i => i.id === primaryIndustryId)?.label || 'Project';
    meta.textContent = `${industryLabel} · ${project.client} · ${project.year}`;
  }

  if (heroImg) {
    const isVideo = project.image && project.image.endsWith('.mp4');
    const heroSrc = isVideo ? (project.poster || project.image) : (project.image || project.poster);
    if (heroSrc) heroImg.src = heroSrc;
    heroImg.alt = `${project.title} — main image`;
  }
}

// ── Section scrubber ──────────────────────────────────────────────
function initScrubber() {
  const sectionEls = Array.from(document.querySelectorAll('[data-section]'));
  if (sectionEls.length < 2) return;

  const sections = sectionEls.map(el => ({ el, label: el.dataset.section }));

  // Build scrubber DOM
  const scrubber = document.createElement('nav');
  scrubber.className = 'section-scrubber';
  scrubber.setAttribute('aria-label', 'Page sections');

  const pills = sections.map((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'scrubber__pill';
    btn.type = 'button';
    btn.textContent = s.label;
    btn.dataset.index = i;
    btn.dataset.section = s.label;
    scrubber.appendChild(btn);
    return btn;
  });

  // Separator + play/pause button
  const sep = document.createElement('div');
  sep.className = 'scrubber__sep';
  sep.setAttribute('aria-hidden', 'true');
  scrubber.appendChild(sep);

  const playBtn = document.createElement('button');
  playBtn.className = 'scrubber__play';
  playBtn.type = 'button';
  playBtn.setAttribute('aria-label', 'Read aloud');
  scrubber.appendChild(playBtn);

  // ── Active state tracking ─────────────────────────────────────
  let activeIndex = -1;

  function setActive(i) {
    if (i === activeIndex) return;
    activeIndex = i;
    pills.forEach((p, j) => p.classList.toggle('is-active', j === i));
  }

  function getActiveIndex() {
    let idx = 0;
    sections.forEach((s, i) => {
      if (s.el.getBoundingClientRect().top <= window.innerHeight * 0.45) idx = i;
    });
    return idx;
  }

  setActive(getActiveIndex());
  window.addEventListener('scroll', () => setActive(getActiveIndex()), { passive: true });

  // Defer DOM insertion until after enterPage() clears its body filter (1.7s).
  // A filter on any ancestor hijacks fixed-position containing-block, which
  // would place the scrubber off-screen until the filter is removed.
  setTimeout(() => {
    document.body.appendChild(scrubber);
    gsap.fromTo(scrubber,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
    );
    initReader(playBtn);
  }, 1800);

  // ── Scroll to a section ───────────────────────────────────────
  const OFFSET = 90; // clear fixed header / back button

  function scrollToSection(i, smooth) {
    const top = sections[i].el.getBoundingClientRect().top + window.scrollY - OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'instant' });
  }

  // ── Pointer: tap + horizontal scrub ──────────────────────────
  let pointing = false, didDrag = false;
  let startX = 0, lastDragIdx = -1;
  let downTarget = null; // store pointerdown target before capture redirects e.target

  function pillAtX(x) {
    let best = 0, bestDist = Infinity;
    pills.forEach((p, i) => {
      const r   = p.getBoundingClientRect();
      const mid = (r.left + r.right) / 2;
      const d   = Math.abs(x - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  scrubber.addEventListener('pointerdown', (e) => {
    pointing    = true;
    didDrag     = false;
    lastDragIdx = -1;
    startX      = e.clientX;
    downTarget  = e.target; // capture before setPointerCapture redirects future events
    scrubber.setPointerCapture(e.pointerId);
  });

  scrubber.addEventListener('pointermove', (e) => {
    if (!pointing) return;
    if (!didDrag && Math.abs(e.clientX - startX) > 6) didDrag = true;
    if (!didDrag) return;

    const idx = pillAtX(e.clientX);
    if (idx !== lastDragIdx) {
      lastDragIdx = idx;
      scrollToSection(idx, false); // instant while scrubbing
    }
  });

  scrubber.addEventListener('pointerup', (e) => {
    if (!didDrag) {
      // Use downTarget because setPointerCapture redirects e.target to the scrubber itself
      const btn = downTarget && downTarget.closest('.scrubber__pill');
      if (btn) scrollToSection(parseInt(btn.dataset.index), true);
    }
    pointing   = false;
    didDrag    = false;
    downTarget = null;
  });

  scrubber.addEventListener('pointercancel', () => {
    pointing = false;
    didDrag  = false;
  });
}

// ── Related projects ───────────────────────────────────────────────
function initRelated() {
  const main = document.querySelector('[data-project-id]');
  if (!main) return;

  const current = projects.find(p => p.id === main.dataset.projectId);
  if (!current) return;

  const diagram = document.getElementById('related-diagram');
  if (!diagram) return;

  const picks = pickRelated(current);
  if (!picks.length) return;

  renderRelated(diagram, picks);

  const reducedMotion = prefersLessMotion();
  if (!reducedMotion) {
    gsap.set(diagram.querySelectorAll('.related__card'), { opacity: 0, y: 20 });
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();

    if (reducedMotion) return;

    gsap.to(diagram.querySelectorAll('.related__card'), {
      opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', stagger: 0.12, delay: 0.05,
    });

    // Draw SVG lines via stroke-dashoffset
    diagram.querySelectorAll('.related__svg-line').forEach(line => {
      const len = Math.hypot(
        line.x2.baseVal.value - line.x1.baseVal.value,
        line.y2.baseVal.value - line.y1.baseVal.value,
      );
      line.setAttribute('stroke-dasharray', len);
      gsap.fromTo(line,
        { strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out', delay: 0.3 },
      );
    });
  }, { threshold: 0.15 });

  observer.observe(diagram);
}

function pickRelated(current) {
  const others = projects.filter(p => p.id !== current.id);
  const used = new Set();
  const result = [];

  // 1. Same client — fallback to same-year featured if no match
  let p = others.find(o => o.client === current.client);
  let rel = 'Same Client';
  if (!p) {
    p = others.find(o => o.year === current.year && o.featured);
    rel = `Also ${current.year}`;
  }
  if (!p) {
    p = others.find(o => o.year === current.year);
    rel = `Also ${current.year}`;
  }
  if (p) { result.push({ project: p, relationship: rel }); used.add(p.id); }

  // 2. Same primary industry (prefer featured)
  const industry = current.industries[0];
  const industryLabel = industry.charAt(0).toUpperCase() + industry.slice(1);
  p = others.find(o => !used.has(o.id) && o.industries.includes(industry) && o.featured);
  if (!p) p = others.find(o => !used.has(o.id) && o.industries.includes(industry));
  if (p) { result.push({ project: p, relationship: industryLabel }); used.add(p.id); }

  // 3. Any remaining featured project
  p = others.find(o => !used.has(o.id) && o.featured);
  if (p) result.push({ project: p, relationship: 'Featured Work' });

  return result.slice(0, 3);
}

function renderRelated(diagram, picks) {
  // Cluster layout: three cards matching home-card image proportions (4/3),
  // gently rotated and connected with SVG lines.
  const CARD_W = 300;
  const CARD_TOTAL_H = 280; // visual estimate (image + label block)
  const OVERLAP_STEP = 285; // CARD_W - overlap (smaller overlap than before)
  const CL = 25; // cluster left offset within .related__diagram
  const LABEL_TOP = 320;
  const slots = [
    { left: CL,                 top: 25, rot: -6, z: 1 },
    { left: CL + OVERLAP_STEP, top: 0,  rot:  0, z: 3 },
    { left: CL + OVERLAP_STEP * 2, top: 25, rot:  6, z: 2 },
  ];

  // Card bottom-centers in container space (approx, ignoring small rotation offset)
  const lineFrom = [
    { x: slots[0].left + CARD_W / 2, y: slots[0].top + CARD_TOTAL_H - 5 },
    { x: slots[1].left + CARD_W / 2, y: slots[1].top + CARD_TOTAL_H - 5 },
    { x: slots[2].left + CARD_W / 2, y: slots[2].top + CARD_TOTAL_H - 5 },
  ];
  // Endpoints near the labels
  const lineTo = [
    { x: slots[0].left + CARD_W / 2, y: LABEL_TOP - 5 },
    { x: slots[1].left + CARD_W / 2, y: LABEL_TOP - 5 },
    { x: slots[2].left + CARD_W / 2, y: LABEL_TOP - 5 },
  ];

  // SVG overlay
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('related__svg');

  picks.forEach((pick, i) => {
    // Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', lineFrom[i].x);
    line.setAttribute('y1', lineFrom[i].y);
    line.setAttribute('x2', lineTo[i].x);
    line.setAttribute('y2', lineTo[i].y);
    line.classList.add('related__svg-line');
    svg.appendChild(line);

    // Card
    const card = document.createElement('a');
    card.className = 'related__card';
    card.href = `project.html?project=${encodeURIComponent(pick.project.id)}`;
    card.style.cssText =
      `left:${slots[i].left}px;top:${slots[i].top}px;rotate:${slots[i].rot}deg;z-index:${slots[i].z}`;
    const thumb = pick.project.poster || pick.project.image;
    card.innerHTML = `<img src="${thumb}" alt="${pick.project.title}" loading="lazy">`;
    card.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.setItem('selectedProjectId', pick.project.id);
      leavePage(`project.html?project=${encodeURIComponent(pick.project.id)}`);
    });

    // Label
    const label = document.createElement('div');
    label.className = 'related__label';
    label.style.cssText = `left:${slots[i].left}px;top:${LABEL_TOP}px`;

    // Tooltip text: single sentence (always visible).
    const title = pick.project.title;
    const client = pick.project.client;
    const year = pick.project.year;
    const industry = Array.isArray(pick.project.industries) ? pick.project.industries[0] : null;
    const industryLabel = industry
      ? industry.charAt(0).toUpperCase() + industry.slice(1)
      : null;

    let sentence = '';
    if (pick.relationship === 'Same Client') {
      sentence = `${title} is also a project for ${client}.`;
    } else if (pick.relationship === 'Featured Work') {
      sentence = `${title} for ${client} is also featured work (${year}).`;
    } else if (pick.relationship.startsWith('Also ')) {
      const relYear = pick.relationship.slice(5).trim();
      sentence = relYear === String(year)
        ? `${title} for ${client} is also from ${year}.`
        : `${title} for ${client} is also associated with ${relYear} work.`;
    } else if (industryLabel && pick.relationship === industryLabel) {
      // Primary industry match: include both title and client.
      sentence = `${title} for ${client} is also a ${industryLabel} project.`;
    } else if (industryLabel) {
      // Fallback when we know the primary industry.
      sentence = `${title} for ${client} is also a ${industryLabel} project.`;
    } else {
      sentence = `${title} for ${client} is also related work.`;
    }

    label.innerHTML = `<span class="related__label-title">${sentence}</span>`;

    diagram.appendChild(card);
    diagram.appendChild(label);
  });

  diagram.appendChild(svg);
}

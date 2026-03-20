// Layout constants — shared across all modes
const CARD_W         = 300;
const CARD_H         = Math.round(CARD_W * 0.75) + 52; // 277px
const CARD_GAP       = 24;

// Timeline snake constants
const TOP_MARGIN     = 200;

// Client constants
const CLIENT_X       = 100;
const CLIENT_HDR_H   = 60;
const CLIENT_ROW_GAP = 40;

// Service / neural-network constants
const SVC_CANVAS_W   = 9000;
const SVC_CANVAS_H   = 8000;
const SVC_CX         = 4500;
const SVC_CY         = 4000;
const HUB_R          = 1600;   // radius of hub circle arrangement
const MIN_ORBIT_R    = 320;    // minimum card orbit radius around a hub

// Unconstrained bounds used during animated transitions
const UNBOUND = { minX: -20000, minY: -20000, maxX: 20000, maxY: 20000 };

import { prefersLessMotion } from './motion.js';

export function initFilter(projects, industries, canvas, viewport, canvasCtrl) {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;

  let activeMode = null;

  // ── Project lookup ────────────────────────────────────────────────
  const projectMap = {};
  projects.forEach(p => { projectMap[p.id] = p; });

  // ── Cache original card positions (centre-tile cards only) ───────
  const origPos = {};
  Array.from(canvas.querySelectorAll('.card:not([data-ghost]):not([data-filler])')).forEach(card => {
    origPos[card.dataset.id] = {
      x: parseInt(card.style.left) || 0,
      y: parseInt(card.style.top)  || 0,
    };
  });

  const origCanvasW = parseInt(canvas.style.width)  || 3640;
  const origCanvasH = parseInt(canvas.style.height) || 3410;
  const origBounds  = { minX: 0, minY: 0, maxX: origCanvasW, maxY: origCanvasH };

  // ── Canvas header / hub elements ──────────────────────────────────
  let activeHeaders = [];
  let activeZones   = [];

  function clearHeaders() {
    activeHeaders.forEach(el => el.remove());
    activeHeaders = [];
    activeZones.forEach(el => el.remove());
    activeZones = [];
  }

  function addHeader(x, y, text, type) {
    const el = document.createElement('div');
    el.className = `canvas-header canvas-header--${type}`;
    el.style.cssText = `left:${x}px;top:${y}px;opacity:0`;
    el.textContent = text;
    canvas.appendChild(el);
    activeHeaders.push(el);
    return el;
  }

  function addHubNode(x, y, label) {
    const el = document.createElement('div');
    el.className = 'canvas-hub';
    el.style.cssText = `left:${x}px;top:${y}px;opacity:0`;
    el.textContent = label;
    canvas.appendChild(el);
    activeHeaders.push(el);
    return el;
  }

  // ── SVG line overlay ──────────────────────────────────────────────
  let svgEl = null;

  function clearLines() {
    if (svgEl) { svgEl.remove(); svgEl = null; }
  }

  function makeSvg() {
    clearLines();
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;opacity:0';
    svgEl.setAttribute('aria-hidden', 'true');
    canvas.insertBefore(svgEl, canvas.firstChild); // behind cards
    return svgEl;
  }

  function addLine(svg, x1, y1, x2, y2, color, width) {
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', x1);
    ln.setAttribute('y1', y1);
    ln.setAttribute('x2', x2);
    ln.setAttribute('y2', y2);
    ln.setAttribute('stroke', color);
    ln.setAttribute('stroke-width', width);
    ln.setAttribute('stroke-linecap', 'round');
    ln.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(ln);
  }

  // ── Animate cards to new positions ───────────────────────────────
  function moveCards(posMap) {
    const lm = prefersLessMotion();
    Array.from(canvas.querySelectorAll('.card:not([data-ghost]):not([data-filler])')).forEach((card, i) => {
      const pos = posMap[card.dataset.id];
      if (!pos) return;
      gsap.killTweensOf(card);
      if (lm) {
        gsap.set(card, { left: pos.x, top: pos.y, opacity: 1 });
      } else {
        gsap.to(card, {
          left: pos.x, top: pos.y, opacity: 1,
          duration: 0.9, ease: 'power3.inOut',
          delay: i * 0.006,
        });
      }
    });
    setTimeout(() => document.dispatchEvent(new Event('layout:changed')), lm ? 0 : 950);
  }

  // ── Smooth pan + optional zoom ────────────────────────────────────
  let activePanTween = null;

  function panTo(tx, ty, toScale, duration = 1.2, onComplete) {
    if (activePanTween) { activePanTween.kill(); activePanTween = null; }
    const { x, y, scale } = canvasCtrl.getState();
    if (toScale === undefined) toScale = scale;

    if (prefersLessMotion()) {
      canvasCtrl.setTransform(tx, ty, toScale);
      if (onComplete) onComplete();
      return;
    }

    const proxy = { x, y, scale };
    activePanTween = gsap.to(proxy, {
      x: tx, y: ty, scale: toScale,
      duration, ease: 'power3.inOut',
      onUpdate:   () => canvasCtrl.setTransform(proxy.x, proxy.y, proxy.scale),
      onComplete: () => { activePanTween = null; if (onComplete) onComplete(); },
    });
  }

  // Kill any in-progress pan animation the instant the user touches the canvas,
  // so drag/scroll takes over immediately without fighting the tween.
  function interruptPan() {
    if (activePanTween) { activePanTween.kill(); activePanTween = null; }
  }
  viewport.addEventListener('pointerdown', interruptPan, { passive: true });
  viewport.addEventListener('wheel',       interruptPan, { passive: true });

  // ── Zoom to fit a content bounding box ────────────────────────────
  function zoomToFit(minX, minY, maxX, maxY, onComplete) {
    const vw  = viewport.clientWidth;
    const vh  = viewport.clientHeight;
    const pad = 80;
    const cW  = maxX - minX;
    const cH  = maxY - minY;
    const fitScale = Math.min((vw - pad * 2) / cW, (vh - pad * 2) / cH);
    const tx = (vw - cW * fitScale) / 2 - minX * fitScale;
    const ty = (vh - cH * fitScale) / 2 - minY * fitScale;
    panTo(tx, ty, fitScale, 1.4, onComplete);
  }

  // ── Timeline layout — snake, newest → oldest ─────────────────────
  function applyTimeline() {
    clearHeaders();
    clearLines();

    // Sort newest → oldest; preserve original relative order within same year
    const sorted = [...projects].sort((a, b) => b.year - a.year);

    const vw     = viewport.clientWidth;
    const PAD    = 48;                      // side padding in canvas-space
    const TL_GAP = CARD_GAP * 2;           // double column spacing for timeline
    const ROW_H  = CARD_H + 90;            // card height + vertical gap between rows

    // How many whole cards fit across the viewport at scale 1
    const COLS   = Math.max(1, Math.floor((vw - PAD * 2 + TL_GAP) / (CARD_W + TL_GAP)));
    const rowW   = COLS * (CARD_W + TL_GAP) - TL_GAP;
    const totalW = PAD * 2 + rowW;

    // Build augmented sequence: insert a year-title slot before each new year group
    const items = [];
    let seqYear = null;
    sorted.forEach(p => {
      if (p.year !== seqYear) {
        items.push({ type: 'year', year: p.year });
        seqYear = p.year;
      }
      items.push({ type: 'project', project: p });
    });

    const posMap    = {};
    const allPoints = []; // all item centres in sequence order (for polyline)

    items.forEach((item, idx) => {
      const row      = Math.floor(idx / COLS);
      const col      = idx % COLS;
      const reversed = row % 2 === 1;
      const x = PAD + (reversed ? (COLS - 1 - col) : col) * (CARD_W + TL_GAP);
      const y = PAD + row * ROW_H;

      allPoints.push({ x: x + CARD_W / 2, y: y + CARD_H / 2 });

      if (item.type === 'project') {
        posMap[item.project.id] = { x, y };
      } else {
        const el = document.createElement('div');
        el.className = 'canvas-year-card';
        el.style.cssText = `left:${x}px;top:${y}px;width:${CARD_W}px;height:${CARD_H}px;opacity:0;`;
        el.textContent = String(item.year);
        canvas.appendChild(el);
        activeHeaders.push(el);
      }
    });

    const rows   = Math.ceil(items.length / COLS);
    const totalH = PAD * 2 + rows * ROW_H;

    canvas.style.width  = `${totalW}px`;
    canvas.style.height = `${totalH}px`;
    canvasCtrl.updateBounds(UNBOUND);
    canvasCtrl.setScaleLimits(0.1, 1.5);
    moveCards(posMap);

    // Scale so the full row width lands exactly at the viewport edge (max 1.0)
    const TARGET_SCALE = Math.min(1.0, vw / totalW);
    // Center horizontally; start below logo (~90px from viewport top)
    const TOP_CLEARANCE = 90;
    const tx = (vw - totalW * TARGET_SCALE) / 2;
    const ty = TOP_CLEARANCE - PAD * TARGET_SCALE;
    panTo(tx, ty, TARGET_SCALE, 1.2, () => {
      canvasCtrl.setScaleLimits(Math.min(TARGET_SCALE, 0.45), 1.5);
      canvasCtrl.updateBounds({
        minX: -tx / TARGET_SCALE,
        minY: -ty / TARGET_SCALE,
        maxX: (vw - tx) / TARGET_SCALE,
        maxY: totalH,
      });
    });

    // Draw snake connecting line + show year labels after cards settle
    setTimeout(() => {
      const isLight   = document.documentElement.dataset.theme === 'light';
      const lineColor = isLight ? 'rgba(10,10,10,0.3)' : 'rgba(240,237,232,0.3)';

      const svg = makeSvg();

      const points = allPoints.map(p => `${p.x},${p.y}`).join(' ');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points',         points);
      poly.setAttribute('fill',           'none');
      poly.setAttribute('stroke',         lineColor);
      poly.setAttribute('stroke-width',   '1.5');
      poly.setAttribute('stroke-linecap', 'round');
      poly.setAttribute('stroke-linejoin','round');
      poly.setAttribute('vector-effect',  'non-scaling-stroke');
      svg.appendChild(poly);

      if (prefersLessMotion()) {
        gsap.set(svg, { opacity: 1 });
        activeHeaders.forEach(h => gsap.set(h, { opacity: 1 }));
      } else {
        gsap.to(svg, { opacity: 1, duration: 0.6, ease: 'power2.out' });
        activeHeaders.forEach(h => gsap.to(h, { opacity: 1, duration: 0.4, ease: 'power2.out' }));
      }
    }, prefersLessMotion() ? 0 : 950);
  }

  // ── Client layout ─────────────────────────────────────────────────
  function applyClient() {
    clearHeaders();
    clearLines();

    const vw     = viewport.clientWidth;
    const vh     = viewport.clientHeight;
    const posMap = {};
    let   y      = TOP_MARGIN;

    const clients = [...new Set(projects.map(p => p.client))].sort((a, b) =>
      a.localeCompare(b)
    );

    const letterMap = {}; // first letter → canvas Y of that client's header
    const rows = []; // { clientProjs, startX, rowWidth, cardY }

    clients.forEach(client => {
      const clientProjs = projects.filter(p => p.client === client);
      const rowWidth    = clientProjs.length * (CARD_W + CARD_GAP) - CARD_GAP;
      // Center row if it fits; otherwise center the first card
      const startX      = rowWidth <= vw
        ? Math.round((vw - rowWidth) / 2)
        : Math.round((vw - CARD_W)   / 2);

      // Record first letter → header Y for alpha scroll
      const firstLetter = client[0].toUpperCase();
      if (!(firstLetter in letterMap)) letterMap[firstLetter] = y;

      // Client name — centered across full width
      const hdrEl = addHeader(0, y, client, 'client');
      hdrEl.style.width     = `${vw}px`;
      hdrEl.style.textAlign = 'center';
      y += CLIENT_HDR_H;

      clientProjs.forEach((p, i) => {
        posMap[p.id] = { x: startX + i * (CARD_W + CARD_GAP), y };
      });

      rows.push({ clientProjs, startX, rowWidth, cardY: y });
      y += CARD_H + CLIENT_ROW_GAP;
    });

    const totalH = y + TOP_MARGIN;

    canvas.style.width  = `${vw}px`;
    canvas.style.height = `${totalH}px`;
    canvasCtrl.updateBounds(UNBOUND);
    canvasCtrl.setScaleLimits(0.1, 1.5);
    moveCards(posMap);

    // ── Per-row carousel zones ──────────────────────────────────────
    rows.forEach(({ clientProjs, startX, rowWidth, cardY }) => {
      // Scroll bounds: min = last card centred, max = first card centred
      const maxX = Math.round((vw - CARD_W) / 2);
      const minX = maxX - (rowWidth - CARD_W);
      let offsetX = startX;

      const zone = document.createElement('div');
      zone.className = 'client-carousel-zone';
      zone.style.cssText =
        `position:absolute;left:0;top:${cardY}px;width:${vw}px;height:${CARD_H}px;cursor:grab;`;
      canvas.appendChild(zone);
      activeZones.push(zone);

      function updateCards(ox) {
        clientProjs.forEach((p, i) => {
          const el = canvas.querySelector(`.card:not([data-ghost]):not([data-filler])[data-id="${p.id}"]`);
          if (el) { gsap.killTweensOf(el); el.style.left = `${ox + i * (CARD_W + CARD_GAP)}px`; }
        });
      }

      let pId = null, sx = 0, sy = 0, sOffsetX = startX, sCanvasY = 0, direction = null;

      zone.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return;
        e.stopPropagation();
        zone.setPointerCapture(e.pointerId);
        pId      = e.pointerId;
        sx       = e.clientX;  sy = e.clientY;
        sOffsetX = offsetX;
        sCanvasY = canvasCtrl.getState().y;
        direction = null;
        zone.style.cursor = 'grabbing';
      });

      zone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== pId) return;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (!direction) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          direction = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
        }
        if (direction === 'h') {
          offsetX = Math.max(minX, Math.min(maxX, sOffsetX + dx));
          updateCards(offsetX);
        } else {
          const newY = Math.max(vh - totalH, Math.min(0, sCanvasY + dy));
          canvasCtrl.setTransform(0, newY, 1.0);
        }
      });

      zone.addEventListener('pointerup', (e) => {
        if (e.pointerId !== pId) return;
        const moved = Math.hypot(e.clientX - sx, e.clientY - sy);
        pId = null;  direction = null;
        zone.style.cursor = 'grab';
        // Tap: find the card under the pointer and forward the event
        if (moved < 8) {
          zone.style.pointerEvents = 'none';
          const el = document.elementFromPoint(e.clientX, e.clientY);
          zone.style.pointerEvents = 'auto';
          const card = el && el.closest('.card');
          if (card) {
            viewport.dispatchEvent(new CustomEvent('canvas:tap', {
              bubbles: true,
              detail: { target: card },
            }));
          }
        }
      });

      zone.addEventListener('pointercancel', () => {
        pId = null;  direction = null;
        zone.style.cursor = 'grab';
      });
    });

    panTo(0, 80 - TOP_MARGIN, 1.0, 1.2, () => {
      canvasCtrl.setScaleLimits(1.0, 1.0);
      // x is locked (canvas width = viewport width); y scrolls freely between rows
      canvasCtrl.updateBounds({ minX: 0, minY: 0, maxX: vw, maxY: totalH });
    });

    setTimeout(() => {
      if (prefersLessMotion()) {
        activeHeaders.forEach(h => gsap.set(h, { opacity: 1 }));
      } else {
        activeHeaders.forEach(h => gsap.to(h, { opacity: 1, duration: 0.4, ease: 'power2.out' }));
      }
    }, prefersLessMotion() ? 0 : 950);

    // ── Alphabet quick-scroll sidebar ──────────────────────────
    const alphaEl = document.createElement('div');
    alphaEl.className = 'alpha-scroll';
    document.body.appendChild(alphaEl);
    activeZones.push(alphaEl);

    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
      const span = document.createElement('span');
      span.className = 'alpha-scroll__letter' + (letter in letterMap ? ' is-available' : '');
      span.dataset.letter = letter;
      span.textContent = letter;
      alphaEl.appendChild(span);
    });

    if (prefersLessMotion()) {
      gsap.set(alphaEl, { opacity: 1, x: 0 });
    } else {
      gsap.set(alphaEl, { opacity: 0, x: 16 });
      setTimeout(() => {
        gsap.to(alphaEl, { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' });
      }, 1000);
    }

    function navigateToLetter(clientY) {
      // Find the letter slot closest to the pointer
      let target = null, targetDist = Infinity;
      alphaEl.querySelectorAll('.alpha-scroll__letter').forEach(item => {
        const ir  = item.getBoundingClientRect();
        const mid = (ir.top + ir.bottom) / 2;
        const d   = Math.abs(clientY - mid);
        if (d < targetDist) { targetDist = d; target = item; }
      });
      if (!target) return;

      // If closest letter has no clients, find nearest available
      if (!(target.dataset.letter in letterMap)) {
        let best = null, bestDist = Infinity;
        alphaEl.querySelectorAll('.alpha-scroll__letter.is-available').forEach(item => {
          const ir  = item.getBoundingClientRect();
          const mid = (ir.top + ir.bottom) / 2;
          const d   = Math.abs(clientY - mid);
          if (d < bestDist) { bestDist = d; best = item; }
        });
        target = best;
      }
      if (!target || !(target.dataset.letter in letterMap)) return;

      alphaEl.querySelectorAll('.alpha-scroll__letter').forEach(el => el.classList.remove('is-active'));
      target.classList.add('is-active');
      panTo(0, 80 - letterMap[target.dataset.letter], 1.0, 0.35);
    }

    let alphaPointing = false;
    alphaEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      alphaEl.setPointerCapture(e.pointerId);
      alphaPointing = true;
      navigateToLetter(e.clientY);
    });
    alphaEl.addEventListener('pointermove', (e) => {
      if (!alphaPointing) return;
      navigateToLetter(e.clientY);
    });
    alphaEl.addEventListener('pointerup',     () => { alphaPointing = false; });
    alphaEl.addEventListener('pointercancel', () => { alphaPointing = false; });
  }

  // ── Service / neural-network layout ───────────────────────────────
  function applyService() {
    clearHeaders();
    clearLines();
    canvas.classList.add('mode-service');

    const industryIds = industries.map(ind => ind.id);
    const labelMap    = {};
    industries.forEach(ind => { labelMap[ind.id] = ind.label; });

    // Group projects by primary industry first so orbit radii can be computed
    const grouped = {};
    industryIds.forEach(id => { grouped[id] = []; });
    projects.forEach(p => {
      const primary = p.industries[0];
      if (grouped[primary]) grouped[primary].push(p);
    });

    // Compute orbit radius per cluster (scales with card count)
    const spacing = CARD_W + 36;
    const orbitRadii = {};
    industryIds.forEach(id => {
      const count = grouped[id].length;
      orbitRadii[id] = count > 0
        ? Math.max(MIN_ORBIT_R, (count * spacing) / (2 * Math.PI))
        : MIN_ORBIT_R;
    });
    const maxOrbitR = Math.max(...Object.values(orbitRadii));

    // Compute hub circle radius so adjacent clusters never overlap.
    // Adjacent hub distance = 2 * hubR * sin(π / N).
    // No overlap when that distance > 2 * (maxOrbitR + CARD_W / 2) + CLUSTER_GAP.
    const N           = industryIds.length;
    const CLUSTER_GAP = 300;
    const minHubR     = N > 1
      ? Math.ceil((maxOrbitR + CARD_W / 2 + CLUSTER_GAP / 2) / Math.sin(Math.PI / N))
      : maxOrbitR + 600;
    const hubR = Math.max(HUB_R, minHubR);

    // Size canvas to fully contain all clusters with breathing room
    const extent = hubR + maxOrbitR + CARD_W + 500;
    const svcW   = Math.max(SVC_CANVAS_W, extent * 2);
    const svcH   = Math.max(SVC_CANVAS_H, extent * 2);
    const cx     = svcW / 2;
    const cy     = svcH / 2;

    // Hub positions — equally spaced in a circle, starting from top
    const hubs = {};
    industryIds.forEach((id, i) => {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      hubs[id] = {
        x: cx + hubR * Math.cos(angle),
        y: cy + hubR * Math.sin(angle),
      };
    });

    // Compute card positions using precomputed orbit radii
    const posMap = {};
    industryIds.forEach(id => {
      const hub    = hubs[id];
      const cards  = grouped[id];
      if (!cards.length) return;
      const orbitR = orbitRadii[id];
      cards.forEach((p, i) => {
        const angle = (i / cards.length) * Math.PI * 2 - Math.PI / 2;
        posMap[p.id] = {
          x: Math.round(hub.x + orbitR * Math.cos(angle) - CARD_W / 2),
          y: Math.round(hub.y + orbitR * Math.sin(angle) - CARD_H / 2),
        };
      });
    });

    // Canvas + bounds setup
    canvas.style.width  = `${svcW}px`;
    canvas.style.height = `${svcH}px`;
    canvasCtrl.updateBounds(UNBOUND);
    canvasCtrl.setScaleLimits(0.08, 1.5);

    // Place hub node labels
    industryIds.forEach(id => {
      addHubNode(hubs[id].x, hubs[id].y, labelMap[id]);
    });

    // Animate cards to service positions
    moveCards(posMap);

    // Zoom to fit all content
    const allX    = Object.values(posMap).map(p => p.x);
    const allY    = Object.values(posMap).map(p => p.y);
    const pad     = 350;
    const fitMinX = Math.min(...allX) - pad;
    const fitMinY = Math.min(...allY) - pad;
    const fitMaxX = Math.max(...allX) + CARD_W + pad;
    const fitMaxY = Math.max(...allY) + CARD_H + pad;

    // Don't tighten bounds after zoom-to-fit: at the fit scale (~0.13) the canvas
    // is narrower than the viewport, which would invert the clamp range and make
    // horizontal panning impossible. UNBOUND (set above) stays in effect so the
    // user can always drag freely; scale limits (0.08–1.5) still prevent extreme zoom.
    zoomToFit(fitMinX, fitMinY, fitMaxX, fitMaxY);

    // Draw SVG network lines + show labels after cards settle
    setTimeout(() => {
      const isLight     = document.documentElement.dataset.theme === 'light';
      const clientColor = isLight ? 'rgba(10,10,10,0.5)' : 'rgba(240,237,232,0.5)';

      const svg = makeSvg();

      const clientGroups = {};
      projects.forEach(p => {
        if (!posMap[p.id]) return;
        if (!clientGroups[p.client]) clientGroups[p.client] = [];
        clientGroups[p.client].push(p);
      });

      Object.values(clientGroups).forEach(group => {
        if (group.length < 2) return;
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            addLine(
              svg,
              posMap[group[i].id].x + CARD_W / 2,
              posMap[group[i].id].y + CARD_H / 2,
              posMap[group[j].id].x + CARD_W / 2,
              posMap[group[j].id].y + CARD_H / 2,
              clientColor, 1.5
            );
          }
        }
      });

      if (prefersLessMotion()) {
        gsap.set(svg, { opacity: 1 });
        activeHeaders.forEach(h => gsap.set(h, { opacity: 1 }));
      } else {
        gsap.to(svg, { opacity: 1, duration: 0.8, ease: 'power2.out' });
        activeHeaders.forEach(h => gsap.to(h, { opacity: 1, duration: 0.5, ease: 'power2.out' }));
      }
    }, prefersLessMotion() ? 0 : 950);
  }

  // ── Default restore ───────────────────────────────────────────────
  function applyDefault() {
    clearHeaders();
    clearLines();
    canvas.classList.remove('mode-service');

    const posMap = {};
    Object.entries(origPos).forEach(([id, pos]) => { posMap[id] = pos; });
    moveCards(posMap);

    // Keep canvas at current (possibly large service) size during animation
    // to avoid clamping issues at intermediate scales
    canvasCtrl.updateBounds(UNBOUND);

    // Compute center of original grid at scale 1.0
    const targetX = Math.min(0, (viewport.clientWidth  - origCanvasW) / 2);
    const targetY = Math.min(0, (viewport.clientHeight - origCanvasH) / 2);

    panTo(targetX, targetY, 1.0, 1.2, () => {
      canvas.style.width  = `${origCanvasW}px`;
      canvas.style.height = `${origCanvasH}px`;
      canvasCtrl.setScaleLimits(1.0, 1.0);
      canvasCtrl.updateBounds(origBounds);
    });
  }

  // ── Build filter bar ──────────────────────────────────────────────
  filterBar.innerHTML = '';

  const labelEl = document.createElement('span');
  labelEl.className = 'filter-bar__label';
  labelEl.textContent = 'Show by';
  filterBar.appendChild(labelEl);

  const modes = [
    { id: 'service',  label: 'Service'  },
    { id: 'client',   label: 'Client'   },
    { id: 'timeline', label: 'Timeline' },
    { id: 'topic',    label: 'Topic'    },
  ];

  modes.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'filter-pill';
    btn.textContent = label;
    btn.dataset.mode = id;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => setMode(activeMode === id ? null : id));
    filterBar.appendChild(btn);
  });

  function updatePills(mode) {
    filterBar.querySelectorAll('.filter-pill').forEach(pill => {
      pill.setAttribute('aria-pressed', String(pill.dataset.mode === mode));
    });
  }

  function setMode(mode) {
    activeMode = mode;
    updatePills(mode);
    document.dispatchEvent(new CustomEvent('filter:activate', { detail: { mode } }));
    if      (!mode)                   applyDefault();
    else if (mode === 'timeline')     applyTimeline();
    else if (mode === 'client')       applyClient();
    else if (mode === 'service')      applyService();
    // topic: no-op (pill highlights, layout unchanged)
  }

  // ── Industry filter from overlay ──────────────────────────────────
  document.addEventListener('filter:set', (e) => {
    const { industry } = e.detail;
    activeMode = null;
    updatePills(null);
    const allCards = Array.from(canvas.querySelectorAll('.card:not([data-ghost]):not([data-filler])'));
    const lm = prefersLessMotion();
    allCards.forEach(card => {
      const p       = projectMap[card.dataset.id];
      const matches = p && p.industries.includes(industry);
      if (lm) {
        gsap.set(card, { opacity: matches ? 1 : 0.12, scale: matches ? 1 : 0.94 });
      } else {
        gsap.to(card, { opacity: matches ? 1 : 0.12, scale: matches ? 1 : 0.94, duration: 0.35 });
      }
    });
  });

  // ── Show filter bar after intro settles ───────────────────────────
  function showBar() {
    filterBar.classList.add('is-visible');
    if (prefersLessMotion()) {
      gsap.set(filterBar, { y: 0, opacity: 1 });
    } else {
      gsap.fromTo(filterBar,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
      );
    }
  }

  setTimeout(showBar, prefersLessMotion() ? 0 : 1400);

  // ── Dim filter bar while dragging / scrolling ─────────────────────
  let scrollRestoreTimer = null;

  function dimBar() {
    if (!filterBar.classList.contains('is-visible')) return;
    gsap.killTweensOf(filterBar, 'opacity');
    gsap.to(filterBar, { opacity: 0.3, filter: 'blur(4px)', duration: 0.15, ease: 'power2.out' });
  }

  function restoreBar() {
    if (!filterBar.classList.contains('is-visible')) return;
    gsap.killTweensOf(filterBar, 'opacity');
    gsap.to(filterBar, { opacity: 1, filter: 'blur(0px)', duration: 0.3, ease: 'power2.out',
      onComplete: () => gsap.set(filterBar, { clearProps: 'filter' }),
    });
  }

  viewport.addEventListener('pointerdown', dimBar,    { passive: true });
  viewport.addEventListener('pointerup',   restoreBar, { passive: true });
  viewport.addEventListener('pointercancel', restoreBar, { passive: true });

  viewport.addEventListener('wheel', () => {
    dimBar();
    clearTimeout(scrollRestoreTimer);
    scrollRestoreTimer = setTimeout(restoreBar, 200);
  }, { passive: true });
}

// Distance (viewport px) over which scale falls from MAX to MIN
const SCALE_RADIUS    = 700;
// Cards within this distance show their label
const LABEL_THRESHOLD = 250;
// Minimum canvas scale before any labels are shown
const LABEL_ZOOM_MIN  = 0.7;
// Scale at viewport center vs. far edge — fixed at 1.0 (zoom is locked)
const MAX_SCALE = 1.0;
const MIN_SCALE = 1.0;

function setLabelFontSize(scale) {
  const root = document.documentElement;
  root.style.setProperty('--label-font-size', `${(18 / scale).toFixed(3)}px`);
  root.style.setProperty('--label-meta-size', `${(13 / scale).toFixed(3)}px`);
}

export function initProximity(viewport, getState) {
  let cardData     = [];
  let rafId        = null;
  let filterActive = false;

  function cacheCards() {
    cardData = Array.from(document.querySelectorAll('.card:not([data-ghost])')).map((el) => {
      const left  = parseFloat(el.style.left)  || 0;
      const top   = parseFloat(el.style.top)   || 0;
      const width = parseFloat(el.style.width) || 300;
      return {
        el,
        canvasCX: left + width / 2,
        canvasCY: top  + (width * 0.75) / 2,
        currentScale: -1,  // force first-frame update
        wasNearCenter: false,
      };
    });
  }

  let lastX = null, lastY = null, lastScale = null;

  document.addEventListener('filter:activate', (e) => {
    filterActive = !!e.detail?.mode;
    if (filterActive) {
      // Reset all cards to neutral scale immediately
      for (const item of cardData) {
        item.currentScale = 1;
        gsap.set(item.el, { scale: 1 });
        if (item.wasNearCenter) {
          item.wasNearCenter = false;
          item.el.classList.remove('is-near-center');
        }
      }
    } else {
      // Force a full recompute on next frame
      lastX = lastY = lastScale = null;
    }
  });

  function update() {
    const { x, y, scale } = getState();

    // Skip expensive card loop when canvas hasn't moved or filter is active
    if (filterActive || (x === lastX && y === lastY && scale === lastScale)) {
      rafId = requestAnimationFrame(update);
      return;
    }

    // Keep label text visually constant at 18px regardless of zoom
    if (scale !== lastScale) setLabelFontSize(scale);

    lastX = x; lastY = y; lastScale = scale;

    const vCX = viewport.clientWidth  / 2;
    const vCY = viewport.clientHeight / 2;

    for (const item of cardData) {
      const { el } = item;

      if (el.classList.contains('is-filtered-out')) {
        if (item.currentScale !== 1) {
          item.currentScale = 1;
          gsap.set(el, { scale: 1 });
        }
        continue;
      }

      // Map card canvas-space center → viewport-space position
      const screenX = x + item.canvasCX * scale;
      const screenY = y + item.canvasCY * scale;
      const dist    = Math.sqrt((screenX - vCX) ** 2 + (screenY - vCY) ** 2);

      // Smoothstep falloff: MAX_SCALE at center, MIN_SCALE at edge + beyond
      const t         = Math.max(0, 1 - dist / SCALE_RADIUS);
      const tSmooth   = t * t * (3 - 2 * t);
      const cardScale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * tSmooth;

      if (Math.abs(cardScale - item.currentScale) > 0.002) {
        item.currentScale = cardScale;
        gsap.set(el, { scale: cardScale });
      }

      // Label: only show when zoomed in past threshold and near center
      const nearCenter = scale >= LABEL_ZOOM_MIN && dist < LABEL_THRESHOLD;
      if (nearCenter !== item.wasNearCenter) {
        item.wasNearCenter = nearCenter;
        el.classList.toggle('is-near-center', nearCenter);
      }
    }

    rafId = requestAnimationFrame(update);
  }

  function start() {
    cacheCards();
    setLabelFontSize(getState().scale);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(update);
  }

  function stop() {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  return { start, stop, cacheCards };
}

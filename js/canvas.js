// bounds = { minX, minY, maxX, maxY } in canvas-space px, already padded.
export function initCanvas(viewport, canvas, bounds, wrapConfig = null) {
  const state = {
    x: 0,
    y: 0,
    scale: 1,
    velX: 0,
    velY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    rafId: null,
    activePointers: new Map(),
    lastPinchDist: null,
    lastPinchMidX: null,
    lastPinchMidY: null,
    aboveThreshold: false,
  };

  const FRICTION     = 0.92;
  let   MIN_SCALE    = 1.0;
  let   MAX_SCALE    = 1.0;
  const ZOOM_THRESHOLD = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--zoom-threshold') || '0.9'
  );

  // ─── Wraparound (infinite-feel) state ────────────────────────────
  // We use a 3×3 tile layout. tileW/tileH is the single-tile size in
  // canvas-px. When the viewport centre drifts outside the centre tile
  // ([tileW, 2*tileW] × [tileH, 2*tileH]), we teleport the camera by
  // ±tileW/H — a seamless snap since ghost tiles are identical copies.
  let wrapEnabled = true;
  const tileW = Number(wrapConfig?.tileW) || 0;
  const tileH = Number(wrapConfig?.tileH) || 0;

  // Disable wrap (and hide ghost tiles) while any filter mode is active.
  document.addEventListener('filter:activate', (e) => {
    wrapEnabled = !e.detail?.mode;
    canvas.querySelectorAll('.card--ghost, [data-filler]').forEach(el => {
      el.style.visibility = wrapEnabled ? '' : 'hidden';
    });
  });

  // ─── Bounds helpers ─────────────────────────────────────────────
  function getAllowedRange(s) {
    if (!bounds) return null;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    // Drag right max: left padded edge sits at viewport left  → xMax = -bounds.minX * s
    // Drag left max:  right padded edge sits at viewport right → xMin = vw - bounds.maxX * s
    return {
      xMin: vw - bounds.maxX * s,
      xMax: -bounds.minX * s,
      yMin: vh - bounds.maxY * s,
      yMax: -bounds.minY * s,
    };
  }

  function clampXY(x, y, s = state.scale) {
    const r = getAllowedRange(s);
    if (!r) return { x, y };
    return {
      x: Math.min(r.xMax, Math.max(r.xMin, x)),
      y: Math.min(r.yMax, Math.max(r.yMin, y)),
    };
  }

  function clampScale(s) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  }

  // ─── Camera wrap ─────────────────────────────────────────────────
  // If the viewport centre has drifted outside the centre tile
  // ([tileW, 2*tileW] × [tileH, 2*tileH] in canvas-space), teleport
  // the camera by ±tileW/H so it looks at the identical centre tile.
  // This is a pure camera move — no card positions ever change.
  function wrapIfNeeded() {
    if (!wrapEnabled || !tileW || !tileH) return;

    // Viewport centre in canvas-space
    const vcx = (-state.x + viewport.clientWidth  / 2) / state.scale;
    const vcy = (-state.y + viewport.clientHeight / 2) / state.scale;

    let dx = 0;
    let dy = 0;

    let vx = vcx;
    while (vx >= tileW * 2) { dx += tileW * state.scale; vx -= tileW; }
    while (vx <  tileW)     { dx -= tileW * state.scale; vx += tileW; }

    let vy = vcy;
    while (vy >= tileH * 2) { dy += tileH * state.scale; vy -= tileH; }
    while (vy <  tileH)     { dy -= tileH * state.scale; vy += tileH; }

    if (dx || dy) {
      state.x += dx;
      state.y += dy;
      // Keep pointer/canvas alignment: the formula nx = e.clientX - state.startX
      // must still yield state.x after teleport, so shift the drag origin by dx/dy.
      if (state.isDragging) {
        state.startX -= dx;
        state.startY -= dy;
      }
      applyTransform();
      document.dispatchEvent(new Event('layout:changed'));
    }
  }

  // ─── Apply (no clamping here — callers clamp before calling) ────
  function applyTransform() {
    canvas.style.transform =
      `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  }

  // ─── Threshold event ────────────────────────────────────────────
  function checkThreshold() {
    const above = state.scale >= ZOOM_THRESHOLD;
    if (above !== state.aboveThreshold) {
      state.aboveThreshold = above;
      viewport.dispatchEvent(new CustomEvent('zoom:threshold', {
        bubbles: true,
        detail: { above },
      }));
    }
  }

  // ─── Zoom to cursor ─────────────────────────────────────────────
  function zoomToPoint(newScale, originX, originY) {
    const oldScale = state.scale;
    newScale = clampScale(newScale);
    let nx = originX - (newScale / oldScale) * (originX - state.x);
    let ny = originY - (newScale / oldScale) * (originY - state.y);
    const clamped = clampXY(nx, ny, newScale);
    state.x     = clamped.x;
    state.y     = clamped.y;
    state.scale = newScale;
    applyTransform();
    checkThreshold();
  }

  // ─── Inertia loop ───────────────────────────────────────────────
  function tick() {
    if (state.isDragging) return;

    const speed = Math.sqrt(state.velX ** 2 + state.velY ** 2);
    if (speed < 0.05) {
      state.velX = 0;
      state.velY = 0;
      state.rafId = null;
      return;
    }

    let nx = state.x + state.velX;
    let ny = state.y + state.velY;

    if (wrapEnabled) {
      state.x = nx;
      state.y = ny;
      applyTransform();
      wrapIfNeeded();
    } else {
      const { x: cx, y: cy } = clampXY(nx, ny);

      // Kill velocity on the axis that hit a wall
      if (cx !== nx) state.velX = 0;
      if (cy !== ny) state.velY = 0;

      state.x = cx;
      state.y = cy;
    }
    applyTransform();
    state.velX *= FRICTION;
    state.velY *= FRICTION;
    state.rafId = requestAnimationFrame(tick);
  }

  // ─── Tap detection ──────────────────────────────────────────────
  // Fires 'canvas:tap' on the viewport when a pointer goes down and
  // up with < 6px displacement (single-touch only, no pinch).
  let tapTarget  = null;
  let tapOriginX = 0;
  let tapOriginY = 0;

  // ─── Pointer drag ───────────────────────────────────────────────
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return;

    state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.activePointers.size === 1) {
      viewport.setPointerCapture(e.pointerId);
      state.isDragging = true;
      state.startX = e.clientX - state.x;
      state.startY = e.clientY - state.y;
      state.lastX  = e.clientX;
      state.lastY  = e.clientY;
      state.velX   = 0;
      state.velY   = 0;
      if (state.rafId) cancelAnimationFrame(state.rafId);
      viewport.classList.add('is-dragging');
      // Record tap candidate
      tapTarget  = e.target;
      tapOriginX = e.clientX;
      tapOriginY = e.clientY;
    } else if (state.activePointers.size === 2) {
      tapTarget = null; // Multi-touch — not a tap
      state.isDragging = false;
      viewport.classList.remove('is-dragging');
      const pts = [...state.activePointers.values()];
      state.lastPinchDist = pinchDist(pts);
      const mid = pinchMid(pts);
      state.lastPinchMidX = mid.x;
      state.lastPinchMidY = mid.y;
    }
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!state.activePointers.has(e.pointerId)) return;
    state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.activePointers.size === 2) {
      const pts = [...state.activePointers.values()];
      const dist = pinchDist(pts);
      const mid  = pinchMid(pts);

      if (state.lastPinchDist !== null) {
        const scaleDelta = dist / state.lastPinchDist;
        const newScale   = clampScale(state.scale * scaleDelta);
        let nx = mid.x - (newScale / state.scale) * (mid.x - state.x);
        let ny = mid.y - (newScale / state.scale) * (mid.y - state.y);
        nx += mid.x - state.lastPinchMidX;
        ny += mid.y - state.lastPinchMidY;
        const { x: cx, y: cy } = clampXY(nx, ny, newScale);
        state.x     = cx;
        state.y     = cy;
        state.scale = newScale;
        applyTransform();
        checkThreshold();
      }

      state.lastPinchDist  = dist;
      state.lastPinchMidX  = mid.x;
      state.lastPinchMidY  = mid.y;
      return;
    }

    if (!state.isDragging) return;

    // Record velocity from raw mouse delta (for inertia)
    state.velX = e.clientX - state.lastX;
    state.velY = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    // Desired position
    let nx = e.clientX - state.startX;
    let ny = e.clientY - state.startY;

    if (wrapEnabled) {
      state.x = nx;
      state.y = ny;
      applyTransform();
      wrapIfNeeded();
    } else {
      // Clamp to bounds
      const { x: cx, y: cy } = clampXY(nx, ny);

      // If we hit a wall, kill velocity on that axis and reset the drag
      // origin so there's no accumulated "debt" when the user reverses.
      if (cx !== nx) { state.velX = 0; state.startX = e.clientX - cx; }
      if (cy !== ny) { state.velY = 0; state.startY = e.clientY - cy; }

      state.x = cx;
      state.y = cy;
      applyTransform();
    }
  });

  function endPointer(e) {
    state.activePointers.delete(e.pointerId);

    if (state.activePointers.size === 0) {
      state.isDragging = false;
      viewport.classList.remove('is-dragging');
      if (Math.abs(state.velX) > 0.5 || Math.abs(state.velY) > 0.5) {
        state.rafId = requestAnimationFrame(tick);
      }

      // Fire tap event if pointer barely moved (< 6px)
      if (tapTarget) {
        const dx = e.clientX - tapOriginX;
        const dy = e.clientY - tapOriginY;
        if (Math.sqrt(dx * dx + dy * dy) < 6) {
          viewport.dispatchEvent(new CustomEvent('canvas:tap', {
            bubbles: true,
            detail: { target: tapTarget },
          }));
        }
        tapTarget = null;
      }
    }

    state.lastPinchDist = null;
  }

  viewport.addEventListener('pointerup',     endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  // ─── Suppress native drag ───────────────────────────────────────
  viewport.addEventListener('dragstart', (e) => e.preventDefault());

  // ─── Wheel — pan + pinch-zoom ───────────────────────────────────
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();

    if (e.ctrlKey) {
      const zoomFactor = 1 - e.deltaY * 0.01;
      zoomToPoint(state.scale * zoomFactor, e.clientX, e.clientY);
    } else {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      if (wrapEnabled) {
        state.x = state.x - e.deltaX;
        state.y = state.y - e.deltaY;
        applyTransform();
        wrapIfNeeded();
      } else {
        const { x, y } = clampXY(state.x - e.deltaX, state.y - e.deltaY);
        state.x = x;
        state.y = y;
        applyTransform();
      }
    }
  }, { passive: false });

  // ─── Helpers ────────────────────────────────────────────────────
  function pinchDist(pts) {
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pinchMid(pts) {
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    };
  }

  // ─── Public API ─────────────────────────────────────────────────
  return {
    getState: () => state,
    setTransform: (x, y, scale) => {
      const ns = clampScale(scale);
      state.scale = ns;

      if (wrapEnabled) {
        state.x = x;
        state.y = y;
      } else {
        const { x: cx, y: cy } = clampXY(x, y, ns);
        state.x = cx;
        state.y = cy;
      }
      applyTransform();
      checkThreshold();
    },
    updateBounds:    (newBounds)  => { bounds = newBounds; },
    setScaleLimits:  (min, max)   => { MIN_SCALE = min; MAX_SCALE = max; },
  };
}

export function centerCanvas(viewport, canvas) {
  const vw    = viewport.clientWidth;
  const vh    = viewport.clientHeight;
  const cw    = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvas-width')  || '6000');
  const ch    = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvas-height') || '4000');
  const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--initial-scale') || '0.65');

  const x = (vw - cw * scale) / 2;
  const y = (vh - ch * scale) / 2;

  // Write directly so something is visible before setTransform is called
  canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;

  return { x, y, scale };
}

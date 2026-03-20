import { projects, industries } from './data.js';
import { renderCards, animateIntro } from './cards.js';
import { initCanvas } from './canvas.js';
import { initFilter }  from './filter.js';
import { initNav }     from './nav.js';
import { initOverlay, initNavPrompt } from './overlay.js';
import { initProximity } from './proximity.js';
import { initDrift }   from './drift.js';
import { enterPage, leavePage } from './transition.js';

document.addEventListener('DOMContentLoaded', () => {
  enterPage();
  const viewport = document.getElementById('viewport');
  const canvas   = document.getElementById('canvas');

  if (!viewport || !canvas) {
    console.error('[Carnevale] Missing #viewport or #canvas element.');
    return;
  }

  // ── Square grid layout ────────────────────────────────────────────
  const CARD_W   = 300;
  const CARD_GAP = 32;
  const CARD_PAD = 10;  // card CSS padding (border-box), all sides
  const IMG_H    = Math.round((CARD_W - 2 * CARD_PAD) * 0.75); // 210px actual
  const LABEL_H  = 52;  // label block estimate (pad-top + title + gap + meta)
  const CARD_H   = CARD_PAD + IMG_H + LABEL_H + CARD_PAD;      // 282px
  const CELL_W   = CARD_W   + CARD_GAP;                        // 332px
  const CELL_H   = CARD_H   + CARD_GAP;                        // 314px
  const COLS     = Math.ceil(Math.sqrt(projects.length));       // e.g. 10
  const ROWS     = Math.ceil(projects.length / COLS);           // 9 (not 10) — no empty last row
  const TOTAL    = COLS * ROWS;
  const PAD      = 160;                                         // padding around grid

  // Build a fully-filled grid (cyclic fill to avoid empty trailing slots).
  // Filler cards are marked so filter modes can skip them.
  const gridProjects = Array.from({ length: TOTAL }, (_, i) => ({
    ...projects[i % projects.length],
    x:      PAD + (i % COLS) * CELL_W,
    y:      PAD + Math.floor(i / COLS) * CELL_H,
    width:  CARD_W,
    filler: i >= projects.length,
  }));

  // Single tile dimensions — must equal the card-grid period (COLS×CELL_W, ROWS×CELL_H)
  // so adjacent tiles share exactly CARD_GAP between them (seamless tiling).
  // PAD is used for card positions within the tile but NOT added to tile size.
  const TILE_W = COLS * CELL_W;
  const TILE_H = ROWS * CELL_H;

  // 3×3 canvas: centre tile at [TILE_W, TILE_H] + 8 surrounding ghost copies
  canvas.style.width  = `${TILE_W * 3}px`;
  canvas.style.height = `${TILE_H * 3}px`;

  // 1. Render real cards in the centre tile
  renderCards(canvas, gridProjects, TILE_W, TILE_H, false);
  animateIntro(canvas);

  // 2. Render 8 ghost tiles (image-only, pointer-events: none)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 1) continue;
      renderCards(canvas, gridProjects, col * TILE_W, row * TILE_H, true);
    }
  }

  // 3. Canvas bounds — full 3×3 extent
  const bounds = { minX: 0, minY: 0, maxX: TILE_W * 3, maxY: TILE_H * 3 };

  // 4. Init pan/wrap
  const canvasCtrl = initCanvas(viewport, canvas, bounds, { tileW: TILE_W, tileH: TILE_H });

  // 5. Centre viewport on the centre tile
  const initX = viewport.clientWidth  / 2 - TILE_W * 1.5;
  const initY = viewport.clientHeight / 2 - TILE_H * 1.5;
  canvasCtrl.setTransform(initX, initY, 1.0);

  // 6. Proximity effects
  const proximity = initProximity(viewport, canvasCtrl.getState);
  proximity.start();

  // 7. Auto-drift
  initDrift(viewport, canvasCtrl);

  // 8. Filter bar
  initFilter(projects, industries, canvas, viewport, canvasCtrl);

  // Re-cache card positions after layout transitions
  document.addEventListener('layout:changed', () => proximity.cacheCards());

  // Navigate to project page when a card is tapped (not dragged)
  viewport.addEventListener('canvas:tap', (e) => {
    const card = e.detail.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    if (id) sessionStorage.setItem('selectedProjectId', id);
    leavePage(id ? `project.html?project=${encodeURIComponent(id)}` : 'project.html');
  });

  // 9. Nav
  const nav = initNav();

  // 10. Overlay
  let showOverlayFn = null;
  initOverlay(industries, (showFn) => { showOverlayFn = showFn; });
  if (showOverlayFn) showOverlayFn();

  // 11. Nav prompt (re-open search inside the full-screen menu)
  initNavPrompt(
    {
      input:    document.getElementById('nav-prompt-input'),
      dropdown: document.getElementById('nav-prompt-autocomplete'),
      micBtn:   document.getElementById('nav-prompt-mic'),
    },
    industries,
    nav ? nav.close : null
  );
});

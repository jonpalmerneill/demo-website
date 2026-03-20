const IDLE_TIMEOUT = 5000;  // ms of inactivity before drift starts
const MIN_DIST     = 250;   // min canvas-px per waypoint
const MAX_DIST     = 500;   // max canvas-px per waypoint
const MIN_DUR      = 9;     // min seconds to reach a waypoint
const MAX_DUR      = 15;    // max seconds to reach a waypoint

import { prefersLessMotion } from './motion.js';

export function initDrift(viewport, canvasCtrl) {
  const getState = canvasCtrl.getState;

  let idleTimer    = null;
  let driftTween   = null;
  let isDrifting   = false;
  let filterActive = false;
  const proxy      = { x: 0, y: 0 };

  // Stop drift when a layout mode is activated; re-arm when it's cleared
  document.addEventListener('filter:activate', (e) => {
    filterActive = !!e.detail?.mode;
    stopDrift();
    clearTimeout(idleTimer);
    if (!filterActive) idleTimer = setTimeout(startDrift, IDLE_TIMEOUT);
  });

  // Stop/restart when the visitor toggles Less Motion
  document.addEventListener('motionpreference:change', (e) => {
    if (e.detail.lessMotion) {
      stopDrift();
      clearTimeout(idleTimer);
    } else if (!filterActive) {
      idleTimer = setTimeout(startDrift, IDLE_TIMEOUT);
    }
  });

  // ─── Waypoint loop ────────────────────────────────────────────
  function nextWaypoint() {
    if (!isDrifting) return;

    // Always start each leg from the real (clamped) canvas position
    const { x, y, scale } = getState();
    proxy.x = x;
    proxy.y = y;

    const angle   = Math.random() * Math.PI * 2;
    const dist    = MIN_DIST + Math.random() * (MAX_DIST - MIN_DIST);
    const dur     = MIN_DUR  + Math.random() * (MAX_DUR  - MIN_DUR);

    driftTween = gsap.to(proxy, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      duration: dur,
      ease: 'sine.inOut',
      onUpdate() {
        if (!isDrifting) return;
        canvasCtrl.setTransform(proxy.x, proxy.y, scale);
      },
      onComplete: nextWaypoint,
    });
  }

  // ─── Start / stop ─────────────────────────────────────────────
  function startDrift() {
    if (isDrifting || prefersLessMotion()) return;
    isDrifting = true;
    nextWaypoint();
  }

  function stopDrift() {
    if (!isDrifting) return;
    isDrifting = false;
    if (driftTween) {
      driftTween.kill();
      driftTween = null;
    }
  }

  // ─── Idle timer ───────────────────────────────────────────────
  function resetIdle() {
    stopDrift();
    clearTimeout(idleTimer);
    if (!filterActive) idleTimer = setTimeout(startDrift, IDLE_TIMEOUT);
  }

  // Any deliberate interaction resets the clock
  viewport.addEventListener('pointerdown', resetIdle);
  viewport.addEventListener('wheel',       resetIdle, { passive: true });

  // Begin drifting immediately on load; interaction stops it and restarts after idle timeout
  startDrift();
}

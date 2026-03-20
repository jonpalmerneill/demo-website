const MAX_ROTATE  = 12;    // degrees
const LERP_ON     = 0.09;  // how quickly tilt builds during motion
const LERP_OFF    = 0.055; // how slowly it settles back to flat
const WHEEL_DECAY = 0.84;

export function initDistortion(viewport, getState) {
  const wrap = document.getElementById('canvas-distort');
  if (!wrap) return;

  // Apply perspective to the element itself — avoids the compositor overhead
  // of perspective on a parent, while still giving true 3-D foreshortening
  gsap.set(wrap, { transformPerspective: 900 });

  const setRotX = gsap.quickSetter(wrap, 'rotationX', 'deg');
  const setRotY = gsap.quickSetter(wrap, 'rotationY', 'deg');

  let rotX = 0, rotY = 0;
  let wVelX = 0, wVelY = 0;

  viewport.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;
    wVelX = -e.deltaX * 0.025;
    wVelY = -e.deltaY * 0.025;
  }, { passive: true });

  gsap.ticker.add(() => {
    const { velX, velY, isDragging } = getState();

    // Go dormant when nothing is happening and tilt has settled
    const idle = !isDragging && !velX && !velY
               && Math.abs(wVelX) < 0.01 && Math.abs(wVelY) < 0.01;
    if (idle && Math.abs(rotX) < 0.01 && Math.abs(rotY) < 0.01) return;

    const dX = isDragging ? velX : 0;
    const dY = isDragging ? velY : 0;
    const vX = dX + wVelX;
    const vY = dY + wVelY;

    wVelX *= WHEEL_DECAY;
    wVelY *= WHEEL_DECAY;
    if (Math.abs(wVelX) < 0.01) wVelX = 0;
    if (Math.abs(wVelY) < 0.01) wVelY = 0;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // Horizontal drag → rotate on Y axis (leading edge recedes)
    // Vertical drag   → rotate on X axis (inverted: leading edge recedes)
    const tRotY = clamp( vX * 0.20, -MAX_ROTATE, MAX_ROTATE);
    const tRotX = clamp(-vY * 0.14, -MAX_ROTATE, MAX_ROTATE);

    const moving = Math.abs(vX) > 0.1 || Math.abs(vY) > 0.1;
    const alpha  = moving ? LERP_ON : LERP_OFF;

    rotX += (tRotX - rotX) * alpha;
    rotY += (tRotY - rotY) * alpha;

    setRotX(rotX);
    setRotY(rotY);
  });
}

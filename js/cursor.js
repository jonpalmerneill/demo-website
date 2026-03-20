const INTERACTIVE = 'a, button, input, label, [role="button"], .card, #overlay';

export function initCursor() {
  // Skip on touch / coarse-pointer devices (phones, tablets)
  if (window.matchMedia('(pointer: coarse)').matches) return;

  document.documentElement.classList.add('custom-cursor');

  const el = document.createElement('div');
  el.id = 'cursor';
  // Start off-screen so it doesn't flash in the corner before first mousemove
  el.style.left = '-100px';
  el.style.top  = '-100px';
  document.body.appendChild(el);

  // Direct position — no lag on a small precision cursor
  document.addEventListener('mousemove', (e) => {
    el.style.left = e.clientX + 'px';
    el.style.top  = e.clientY + 'px';
  }, { passive: true });

  // Disappear when pointer leaves the window
  document.addEventListener('mouseleave', () => el.style.opacity = '0');
  document.addEventListener('mouseenter', () => el.style.opacity = '1');

  // Fill when over any interactive element
  document.addEventListener('mouseover', (e) => {
    el.classList.toggle('is-active', !!e.target.closest(INTERACTIVE));
  });
}

export function initNav() {
  const logo     = document.getElementById('nav-logo');
  const logoIntro = document.getElementById('nav-logo-intro');
  const menu    = document.getElementById('nav-menu');
  const items   = menu ? menu.querySelectorAll('.nav__item') : [];
  const footer  = menu ? menu.querySelector('.nav__footer') : null;
  const prompt  = menu ? menu.querySelector('.nav__prompt') : null;

  if (!logo || !menu) return { close: () => {} };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isOpen = false;
  menu.setAttribute('aria-hidden', 'true');

  function openMenu() {
    if (isOpen) return;
    isOpen = true;
    menu.classList.add('is-open');
    menu.removeAttribute('aria-hidden');
    logo.setAttribute('aria-expanded', 'true');

    if (reducedMotion) {
      gsap.set(menu, { clipPath: 'inset(0 0 0% 0)' });
      gsap.set([...items, footer, prompt].filter(Boolean), { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline();

    // Reveal panel with clip-path wipe
    tl.fromTo(
      menu,
      { clipPath: 'inset(0 0 100% 0)' },
      { clipPath: 'inset(0 0 0% 0)', duration: 0.6, ease: 'power3.inOut' }
    );

    // Prompt fades in
    if (prompt) {
      tl.fromTo(
        prompt,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
        '-=0.3'
      );
    }

    // Stagger nav items in
    tl.fromTo(
      items,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.07,
        ease: 'power3.out',
      },
      '-=0.3'
    );

    // Footer fade in
    if (footer) {
      tl.fromTo(
        footer,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' },
        '-=0.3'
      );
    }
  }

  function closeMenu() {
    if (!isOpen) return;
    isOpen = false;
    logo.setAttribute('aria-expanded', 'false');

    if (reducedMotion) {
      gsap.set(menu, { clipPath: 'inset(0 0 100% 0)' });
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        menu.classList.remove('is-open');
        menu.setAttribute('aria-hidden', 'true');
      },
    });

    // Fade out items first
    tl.to([...items, footer, prompt].filter(Boolean), {
      opacity: 0,
      y: -15,
      duration: 0.25,
      stagger: 0.04,
      ease: 'power2.in',
    });

    // Clip panel away
    tl.to(
      menu,
      { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'power3.inOut' },
      '-=0.1'
    );
  }

  // ── C logo toggles menu ───────────────────────────────────────
  logo.addEventListener('click', () => {
    if (isOpen) closeMenu();
    else openMenu();
  });

  // ── Intro wordmark → C logo on first interaction ──────────────
  if (logoIntro) {
    let transitioned = false;

    function transitionToEmblem() {
      if (transitioned) return;
      transitioned = true;

      gsap.to(logoIntro, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => logoIntro.remove(),
      });
      gsap.to(logo, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
        delay: 0.15,
      });
    }

    // Clicking the intro pill opens the menu and triggers the transition
    logoIntro.addEventListener('click', () => {
      transitionToEmblem();
      if (isOpen) closeMenu();
      else openMenu();
    });

    // Also trigger on gallery interaction or overlay dismiss
    const viewport = document.getElementById('viewport');
    if (viewport) {
      viewport.addEventListener('pointerdown', transitionToEmblem, { once: true, passive: true });
    }

    const overlayDismiss = document.getElementById('overlay-dismiss');
    if (overlayDismiss) overlayDismiss.addEventListener('click', transitionToEmblem, { once: true });
  }

  // Close with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeMenu();
  });

  // Close when clicking a nav item
  items.forEach((item) => {
    item.addEventListener('click', closeMenu);
  });

  // ── Theme toggle ──────────────────────────────────────────────
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const html  = document.documentElement;
    const label = themeToggle.querySelector('.theme-toggle__label');

    // Restore saved preference
    if (localStorage.getItem('theme') !== 'dark') {
      html.dataset.theme = 'light';
      label.textContent  = 'Light Mode';
    }

    themeToggle.addEventListener('click', () => {
      const isLight = html.dataset.theme === 'light';

      function applyTheme() {
        if (isLight) {
          html.removeAttribute('data-theme');
          label.textContent = 'Dark Mode';
          localStorage.setItem('theme', 'dark');
        } else {
          html.dataset.theme = 'light';
          label.textContent  = 'Light Mode';
          localStorage.setItem('theme', 'light');
        }
      }

      if (reducedMotion) {
        applyTheme();
        return;
      }

      const flashBg = isLight ? '#000000' : '#ffffff';
      const flash = document.createElement('div');
      flash.style.cssText = `position:fixed;inset:0;z-index:9000;pointer-events:none;background:${flashBg};opacity:0`;
      document.body.appendChild(flash);

      gsap.to(flash, {
        opacity: 1,
        duration: 0.18,
        ease: 'power2.in',
        onComplete() {
          applyTheme();
          gsap.to(flash, {
            opacity: 0,
            duration: 0.28,
            ease: 'power2.out',
            onComplete: () => flash.remove(),
          });
        },
      });
    });
  }

  // ── Less Motion toggle ────────────────────────────────────────
  const lessMotionCheckbox = document.getElementById('less-motion-checkbox');
  if (lessMotionCheckbox) {
    // Restore saved state
    if (localStorage.getItem('less-motion') === 'on') {
      lessMotionCheckbox.checked = true;
    }

    lessMotionCheckbox.addEventListener('change', () => {
      const enabled = lessMotionCheckbox.checked;
      if (enabled) {
        document.documentElement.classList.add('is-less-motion');
        localStorage.setItem('less-motion', 'on');
      } else {
        document.documentElement.classList.remove('is-less-motion');
        localStorage.setItem('less-motion', 'off');
      }
      document.dispatchEvent(new CustomEvent('motionpreference:change', {
        detail: { lessMotion: enabled },
      }));
    });
  }

  return { close: closeMenu };
}

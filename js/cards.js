function isVideo(url) {
  return url && url.endsWith('.mp4');
}

function mediaElement(project, w, h) {
  if (isVideo(project.image)) {
    const poster = project.poster ? `poster="${project.poster}"` : '';
    return `<video
        class="card__image"
        autoplay muted loop playsinline
        ${poster}
        width="${w}"
        height="${h}"
      ><source src="${project.image}" type="video/mp4"></video>`;
  }
  return `<img
      class="card__image"
      src="${project.image}"
      alt="${project.title} — ${project.client}"
      loading="lazy"
      width="${w}"
      height="${h}"
      draggable="false"
    />`;
}

export function renderCards(canvas, projects, offsetX = 0, offsetY = 0, ghost = false) {
  projects.forEach((project) => {
    const card = document.createElement('article');

    if (ghost) {
      card.className = 'card card--ghost';
      card.dataset.ghost = 'true';
      card.setAttribute('aria-hidden', 'true');
      card.style.pointerEvents = 'none';
    } else {
      card.className = 'card' + (project.featured ? ' card--featured' : '');
      card.dataset.id = project.id;
      card.dataset.industries = JSON.stringify(project.industries);
      if (project.filler) card.dataset.filler = 'true';
    }

    const w = project.width;
    const h = Math.round(w * 0.75);

    card.style.left  = `${project.x + offsetX}px`;
    card.style.top   = `${project.y + offsetY}px`;
    card.style.width = `${w}px`;

    if (ghost) {
      // Ghost cards: static image only — no video (avoids autoplay quota issues)
      const src = project.poster || (isVideo(project.image) ? null : project.image);
      card.innerHTML = src
        ? `<div class="card__image-wrap"><img class="card__image" src="${src}" alt="" loading="lazy" width="${w}" height="${h}" draggable="false" /></div>`
        : `<div class="card__image-wrap"></div>`;
    } else {
      card.innerHTML = `
        <div class="card__image-wrap">
          ${mediaElement(project, w, h)}
        </div>
        <div class="card__label">
          <p class="card__title">${project.title}</p>
          <p class="card__meta">${project.client}</p>
        </div>
      `;
    }

    canvas.appendChild(card);
  });
}

import { prefersLessMotion } from './motion.js';

export function animateIntro(canvas) {
  const cards = Array.from(canvas.querySelectorAll('.card:not(.card--ghost)'));

  if (prefersLessMotion()) return;

  // Shuffle so cards float in from varied positions across the canvas
  cards.sort(() => Math.random() - 0.5);

  cards.forEach((card) => {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 100 + Math.random() * 140; // 100–240 px in canvas-space

    gsap.from(card, {
      x:        Math.cos(angle) * dist,
      y:        Math.sin(angle) * dist,
      opacity:  0,
      scale:    0.78,
      filter:   'blur(18px)',
      duration: 1.0 + Math.random() * 0.5,
      delay:    0.05 + Math.random() * 0.55,
      ease:     'power3.out',
      clearProps: 'filter',   // clean up inline filter after animation
    });
  });
}

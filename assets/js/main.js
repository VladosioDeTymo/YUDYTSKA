/* =========================================================================
   main.js — interface behaviour: links, menu, lightbox, discography,
   the YouTube facade, and the first-visit intro.
   ========================================================================= */

import { LINKS, WATCH_URL, YT_ID } from './config.js';
import { initMotion, reduced } from './motion.js';
import { initTransitions } from './transitions.js';

const { gsap } = window;

/* =========================================================================
   Links — the markup carries `data-link="instagram"`, config.js carries the URL
   ========================================================================= */
function applyLinks() {
  document.querySelectorAll('[data-link]').forEach((el) => {
    const key = el.dataset.link;
    if (key === 'email') {
      el.href = `mailto:${LINKS.email}`;
      return;
    }
    if (key === 'watch') {
      el.href = WATCH_URL;
      return;
    }
    if (LINKS[key]) el.href = LINKS[key];
  });

  document.querySelectorAll('[data-email-text]').forEach((el) => {
    el.textContent = LINKS.email;
  });

  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

/* =========================================================================
   Mobile menu
   ========================================================================= */
function initMenu() {
  const burger = document.querySelector('[data-burger]');
  const menu = document.querySelector('[data-menu]');
  if (!burger || !menu) return;

  const focusable = () => [...menu.querySelectorAll('a[href], button')]
    .filter((el) => el.offsetParent !== null);

  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('is-locked', open);

    if (open) {
      focusable()[0]?.focus({ preventScroll: true });
    } else {
      burger.focus({ preventScroll: true });
    }
  };

  burger.addEventListener('click', () => {
    setOpen(burger.getAttribute('aria-expanded') !== 'true');
  });

  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  // Escape closes; Tab is trapped inside while open.
  document.addEventListener('keydown', (e) => {
    if (!menu.classList.contains('is-open')) return;

    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab') return;

    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  setOpen(false);
}

/* =========================================================================
   Lightbox
   ========================================================================= */
function initLightbox() {
  const triggers = [...document.querySelectorAll('[data-lightbox]')];
  if (!triggers.length) return;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Перегляд фотографії');
  box.hidden = true;
  box.innerHTML = `
    <button class="lightbox__close" type="button" aria-label="Закрити перегляд">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18"/>
      </svg>
    </button>
    <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Попереднє фото">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
        <path d="M15 5l-7 7 7 7"/>
      </svg>
    </button>
    <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Наступне фото">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
        <path d="M9 5l7 7-7 7"/>
      </svg>
    </button>
    <figure class="lightbox__stage">
      <img alt="">
      <figcaption></figcaption>
    </figure>`;
  document.body.append(box);

  const img = box.querySelector('img');
  const cap = box.querySelector('figcaption');
  const closeBtn = box.querySelector('.lightbox__close');
  const prevBtn = box.querySelector('.lightbox__nav--prev');
  const nextBtn = box.querySelector('.lightbox__nav--next');

  let index = 0;
  let opener = null;

  const show = (i) => {
    index = (i + triggers.length) % triggers.length;
    const trigger = triggers[index];
    const source = trigger.querySelector('img');

    img.src = trigger.dataset.lightbox || source?.src || '';
    img.alt = source?.alt || '';
    cap.textContent = trigger.dataset.caption || source?.alt || '';

    if (!reduced) {
      gsap.fromTo(img,
        { opacity: 0, scale: 0.97 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
    }
  };

  const open = (i, from) => {
    opener = from;
    box.hidden = false;
    document.body.classList.add('is-locked');
    show(i);

    // Flush styles so the fade has a start value, then reveal synchronously.
    // A requestAnimationFrame here can be throttled or dropped, which would
    // leave the dialog open but fully transparent and still trapping focus.
    void box.offsetWidth;
    box.classList.add('is-open');

    closeBtn.focus({ preventScroll: true });
  };

  const close = () => {
    box.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    const finish = () => { box.hidden = true; opener?.focus({ preventScroll: true }); };
    reduced ? finish() : setTimeout(finish, 280);
  };

  triggers.forEach((trigger, i) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      open(i, trigger);
    });

    // The triggers are divs with role="button", so Enter and Space have to be
    // wired up by hand to match what a real button would do.
    trigger.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      open(i, trigger);
    });
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => show(index - 1));
  nextBtn.addEventListener('click', () => show(index + 1));
  box.addEventListener('click', (e) => { if (e.target === box) close(); });

  document.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'Tab') {
      // Keep focus among the four controls inside the dialog.
      const items = [closeBtn, prevBtn, nextBtn];
      const pos = items.indexOf(document.activeElement);
      e.preventDefault();
      const next = e.shiftKey ? pos - 1 : pos + 1;
      items[(next + items.length) % items.length].focus();
    }
  });
}

/* =========================================================================
   Discography accordion
   ========================================================================= */
function initDiscography() {
  const rows = [...document.querySelectorAll('[data-disc-row]')];
  if (!rows.length) return;

  rows.forEach((row) => {
    const btn = row.querySelector('[data-disc-toggle]');
    const panel = row.querySelector('[data-disc-panel]');
    if (!btn || !panel) return;

    const setOpen = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      row.classList.toggle('is-open', open);

      // Animating max-height is a layout property, so height is driven
      // through a transform-free but GPU-cheap grid-rows trick in CSS;
      // JS only flips the class and reports the new size to ScrollTrigger.
      panel.hidden = false;
      if (!reduced) setTimeout(() => window.ScrollTrigger?.refresh(), 460);
    };

    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      rows.forEach((other) => {
        if (other === row) return;
        other.classList.remove('is-open');
        other.querySelector('[data-disc-toggle]')?.setAttribute('aria-expanded', 'false');
      });
      setOpen(!open);
    });
  });

  // Open the newest release by default.
  rows[0].querySelector('[data-disc-toggle]')?.click();
}

/* =========================================================================
   YouTube facade

   The iframe is only injected on click, so the page loads with zero
   third-party requests. Until YT_ID is filled in, the block links out
   to the channel instead.
   ========================================================================= */
function initVideo() {
  const player = document.querySelector('[data-video]');
  if (!player) return;

  if (!YT_ID) {
    player.dataset.state = 'link-only';
    return;
  }

  const btn = player.querySelector('[data-video-play]');
  btn?.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${YT_ID}?autoplay=1&rel=0&modestbranding=1`;
    frame.title = 'YUDYTSKA — «Ідеальні вони» (офіційний кліп)';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    frame.allowFullscreen = true;
    frame.loading = 'lazy';
    player.append(frame);
    player.dataset.state = 'playing';
  });
}

/* =========================================================================
   First-visit intro
   ========================================================================= */
function runIntro() {
  const intro = document.querySelector('[data-intro]');

  const dismiss = () => {
    intro?.remove();
    window.__introPlayed = true;
    document.body.classList.remove('is-locked');
  };

  if (!intro) { window.__introPlayed = true; return Promise.resolve(); }

  // Once per session, and never when motion is reduced.
  if (reduced || sessionStorage.getItem('yudytska:intro') === '1') {
    dismiss();
    return Promise.resolve();
  }

  sessionStorage.setItem('yudytska:intro', '1');
  document.body.classList.add('is-locked');

  const letters = intro.querySelectorAll('.intro__word span');
  const rule = intro.querySelector('.intro__rule');

  return new Promise((resolve) => {
    gsap.timeline({
      onComplete: () => { dismiss(); resolve(); },
    })
      .to(rule, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' })
      .to(letters, { yPercent: 0, duration: 1, stagger: 0.045, ease: 'expo.out' }, 0.25)
      .to(intro, { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' }, '+=0.35')
      .set(intro, { display: 'none' });
  });
}

/* =========================================================================
   Boot
   ========================================================================= */
function boot() {
  // If the animation libraries failed to load (offline, blocked CDN), fall back
  // to the no-JS presentation rather than leaving the page hidden at opacity 0.
  if (!window.gsap || !window.ScrollTrigger) {
    document.documentElement.className = 'no-js';
    applyLinks();
    initMenu();
    return;
  }

  applyLinks();
  initMenu();
  initLightbox();
  initDiscography();
  initVideo();

  runIntro();
  initMotion();
  initTransitions();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

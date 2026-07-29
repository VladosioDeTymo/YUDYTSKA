/* =========================================================================
   motion.js — the animation engine.

   Everything here obeys three rules:
     1. Only `transform` and `opacity` are animated.
     2. `will-change` is set before an animation and cleared after it.
     3. Under `prefers-reduced-motion: reduce` animations are removed
        entirely, not merely shortened.
   ========================================================================= */

const { gsap, ScrollTrigger, Lenis } = window;

// Guarded so a blocked CDN throws nothing at import time — main.js checks for
// the same globals and falls back to the no-JS presentation.
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EASE = 'power3.out';

/* -------------------------------------------------------------------------
   will-change bookkeeping
   Leaving will-change on permanently promotes every element to its own
   compositor layer, which is exactly how mobile Safari runs out of memory.
   ------------------------------------------------------------------------- */
const lift = (el) => { el.style.willChange = 'transform, opacity'; };
const drop = (el) => { el.style.willChange = 'auto'; };

function animate(targets, vars) {
  const list = gsap.utils.toArray(targets);
  list.forEach(lift);
  return gsap.to(list, {
    ...vars,
    onComplete() {
      list.forEach(drop);
      vars.onComplete?.call(this);
    },
  });
}

/* =========================================================================
   Smooth scroll
   ========================================================================= */
export let lenis = null;

function initSmoothScroll() {
  if (reduced || typeof Lenis === 'undefined') return;

  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.6,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* =========================================================================
   Line splitting

   Hand-rolled rather than pulled from a plugin: it keeps the dependency
   surface small and produces exactly the markup the CSS masks expect —
   an overflow-hidden line wrapping a translatable inner span.
   ========================================================================= */
function splitLines(el) {
  if (el.dataset.split === 'done') return [...el.querySelectorAll('.line-inner')];

  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.textContent = '';

  // Stage 1: one span per word so we can read their vertical positions.
  const words = text.split(' ').map((word) => {
    const span = document.createElement('span');
    span.textContent = word;
    span.style.display = 'inline-block';
    el.append(span, document.createTextNode(' '));
    return span;
  });

  // Stage 2: group words that share a baseline into lines.
  const lines = [];
  let current = null;
  let lastTop = null;

  words.forEach((span) => {
    const top = Math.round(span.offsetTop);
    if (lastTop === null || Math.abs(top - lastTop) > 2) {
      current = [];
      lines.push(current);
      lastTop = top;
    }
    current.push(span.textContent);
  });

  // Stage 3: rebuild as masked lines.
  el.textContent = '';
  const inners = lines.map((wordsInLine) => {
    const line = document.createElement('span');
    line.className = 'line';
    const inner = document.createElement('span');
    inner.className = 'line-inner';
    inner.textContent = wordsInLine.join(' ');
    line.append(inner);
    el.append(line);
    return inner;
  });

  el.dataset.split = 'done';
  return inners;
}

/* =========================================================================
   Reveals
   ========================================================================= */
function initTextReveals() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    if (reduced) { gsap.set(el, { opacity: 1 }); return; }

    const inners = splitLines(el);
    gsap.set(el, { opacity: 1 });
    gsap.set(inners, { yPercent: 108 });

    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => animate(inners, {
        yPercent: 0,
        duration: 1.05,
        ease: 'expo.out',
        stagger: 0.075,
      }),
    });
  });
}

function initBlockReveals() {
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (reduced) { gsap.set(el, { opacity: 1, y: 0 }); return; }

    const delay = parseFloat(el.dataset.reveal) || 0;
    gsap.set(el, { opacity: 0, y: 30 });

    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => animate(el, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        delay,
        ease: EASE,
      }),
    });
  });
}

/* Photographs settle: the frame wipes open while the image de-zooms. */
function initFigureReveals() {
  document.querySelectorAll('.fig').forEach((fig) => {
    const img = fig.querySelector('img');
    if (!img) return;

    if (reduced) {
      gsap.set(fig, { clipPath: 'none' });
      gsap.set(img, { scale: 1 });
      return;
    }

    gsap.set(fig, { clipPath: 'inset(0% 0% 100% 0%)' });

    ScrollTrigger.create({
      trigger: fig,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        lift(img);
        gsap.timeline({ onComplete: () => drop(img) })
          .to(fig, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out' })
          .to(img, { scale: 1, duration: 1.5, ease: 'expo.out' }, 0);
      },
    });
  });
}

/* =========================================================================
   Hero
   ========================================================================= */
function initHero() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const media = hero.querySelector('[data-hero-media]');
  const content = hero.querySelector('[data-hero-content]');

  // Entrance.
  const tl = gsap.timeline({ delay: window.__introPlayed ? 0.15 : 0.9 });

  if (!reduced) {
    if (media) {
      gsap.set(media, { scale: 1.18 });
      tl.to(media, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0);
    }
    const rise = hero.querySelectorAll('[data-hero-rise]');
    gsap.set(rise, { opacity: 0, y: 40 });
    tl.to(rise, { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, ease: 'expo.out' }, 0.25);
  } else {
    gsap.set(hero.querySelectorAll('[data-hero-rise]'), { opacity: 1, y: 0 });
    if (media) gsap.set(media, { scale: 1 });
  }

  if (reduced) return;

  // Scroll-linked parallax: the photograph drifts slower than the copy.
  gsap.to(media, {
    yPercent: 14,
    scale: 1.08,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });

  if (content) {
    gsap.to(content, {
      yPercent: -18,
      opacity: 0,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 30%', scrub: true },
    });
  }
}

/* A soft gold light that trails the pointer across the hero. */
function initSpotlight(mm) {
  mm.add('(pointer: fine)', () => {
    const spot = document.querySelector('[data-spotlight]');
    if (!spot || reduced) return;

    let tx = 50, ty = 40, cx = 50, cy = 40, raf = null;

    const onMove = (e) => {
      const r = spot.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      spot.style.setProperty('--mx', `${cx}%`);
      spot.style.setProperty('--my', `${cy}%`);
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.1
        ? requestAnimationFrame(loop)
        : null;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); if (raf) cancelAnimationFrame(raf); };
  });
}

/* =========================================================================
   Pointer flourishes — desktop only
   ========================================================================= */
function initCursor(mm) {
  mm.add('(pointer: fine)', () => {
    if (reduced) return;

    const dot = document.createElement('div');
    dot.className = 'cursor';
    dot.setAttribute('aria-hidden', 'true');
    document.body.append(dot);

    const xTo = gsap.quickTo(dot, 'x', { duration: 0.42, ease: 'power3' });
    const yTo = gsap.quickTo(dot, 'y', { duration: 0.42, ease: 'power3' });

    const onMove = (e) => {
      dot.classList.add('is-active');
      xTo(e.clientX);
      yTo(e.clientY);
    };

    const hot = 'a, button, [data-magnetic], .disc__row, .fig--zoom';
    const onOver = (e) => { if (e.target.closest(hot)) dot.classList.add('is-hot'); };
    const onOut  = (e) => { if (e.target.closest(hot)) dot.classList.remove('is-hot'); };
    const onLeave = () => dot.classList.remove('is-active');

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('pointerleave', onLeave);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('pointerleave', onLeave);
      dot.remove();
    };
  });
}

function initMagnetic(mm) {
  mm.add('(pointer: fine)', () => {
    if (reduced) return;

    const cleanups = [];

    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.35;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });

      const move = (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const reset = () => { xTo(0); yTo(0); };

      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', reset);
      cleanups.push(() => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', reset);
        gsap.set(el, { x: 0, y: 0 });
      });
    });

    return () => cleanups.forEach((fn) => fn());
  });
}

/* Cover art that tips toward the pointer. */
function initTilt(mm) {
  mm.add('(pointer: fine)', () => {
    if (reduced) return;

    const cleanups = [];

    document.querySelectorAll('[data-tilt]').forEach((el) => {
      const max = parseFloat(el.dataset.tilt) || 9;
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });

      const move = (e) => {
        const r = el.getBoundingClientRect();
        rx((0.5 - (e.clientY - r.top) / r.height) * max * 2);
        ry(((e.clientX - r.left) / r.width - 0.5) * max * 2);
      };
      const reset = () => { rx(0); ry(0); };

      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', reset);
      cleanups.push(() => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', reset);
        gsap.set(el, { rotationX: 0, rotationY: 0 });
      });
    });

    return () => cleanups.forEach((fn) => fn());
  });
}

/* =========================================================================
   Counters
   ========================================================================= */
function initCounters() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const render = (v) => { el.textContent = String(Math.round(v)); };

    // The final figure already sits in the markup, so it reads correctly
    // without JS, in print, and under reduced motion. Only zero it out when
    // it is actually going to animate.
    if (reduced) return;

    render(0);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: () => {
        const proxy = { v: 0 };
        gsap.to(proxy, {
          v: target,
          duration: 1.9,
          ease: 'power2.out',
          onUpdate: () => render(proxy.v),
        });
      },
    });
  });
}

/* =========================================================================
   Marquee — speed responds to scroll velocity
   ========================================================================= */
function initMarquee() {
  document.querySelectorAll('[data-marquee]').forEach((wrap) => {
    const track = wrap.querySelector('[data-marquee-track]');
    if (!track) return;

    // Duplicate the content so the loop has no visible seam.
    track.append(...[...track.children].map((n) => {
      const clone = n.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      return clone;
    }));

    if (reduced) return;

    const base = parseFloat(wrap.dataset.marquee) || 28;
    const tween = gsap.to(track, {
      xPercent: -50,
      duration: base,
      ease: 'none',
      repeat: -1,
    });

    ScrollTrigger.create({
      trigger: wrap,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        // Scrolling hard speeds the ribbon up and flips it with direction.
        const boost = gsap.utils.clamp(0.4, 4, 1 + Math.abs(self.getVelocity()) / 900);
        gsap.to(tween, { timeScale: boost * (self.direction || 1), duration: 0.5, overwrite: true });
      },
    });
  });
}

/* =========================================================================
   Pinned horizontal gallery — desktop; a snap carousel on small screens
   ========================================================================= */
function initHorizontal(mm) {
  mm.add('(min-width: 901px)', () => {
    const section = document.querySelector('[data-horizontal]');
    if (!section || reduced) return;

    const track = section.querySelector('[data-horizontal-track]');
    if (!track) return;

    const distance = () => track.scrollWidth - section.clientWidth;

    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });

    // Cards lean into the direction of travel.
    const cards = track.querySelectorAll('[data-horizontal-card]');
    const skew = gsap.quickTo(cards, 'skewX', { duration: 0.6, ease: 'power3' });
    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${distance()}`,
      onUpdate: (self) => skew(gsap.utils.clamp(-8, 8, self.getVelocity() / -260)),
    });

    return () => { tween.scrollTrigger?.kill(); tween.kill(); st.kill(); gsap.set(track, { x: 0 }); };
  });
}

/* =========================================================================
   Split panels — the "2 in 1" vocal / saxophone reveal
   ========================================================================= */
function initPanels() {
  const section = document.querySelector('[data-panels]');
  if (!section) return;

  const left = section.querySelector('[data-panel-left]');
  const right = section.querySelector('[data-panel-right]');
  if (!left || !right) return;

  if (reduced) { gsap.set([left, right], { xPercent: 0, opacity: 1 }); return; }

  gsap.set(left, { xPercent: -14 });
  gsap.set(right, { xPercent: 14 });

  gsap.timeline({
    scrollTrigger: { trigger: section, start: 'top 78%', end: 'bottom 60%', scrub: 1 },
  })
    .to(left,  { xPercent: 0, ease: 'none' }, 0)
    .to(right, { xPercent: 0, ease: 'none' }, 0);
}

/* =========================================================================
   Navigation behaviour
   ========================================================================= */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  let last = window.scrollY;

  const update = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-lifted', y > 40);

    // Never hide the bar while the mobile menu is open.
    const menuOpen = document.body.classList.contains('is-locked');
    nav.classList.toggle('is-hidden', !menuOpen && y > 220 && y > last);

    last = y;
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* =========================================================================
   Boot
   ========================================================================= */
export function initMotion() {
  const mm = gsap.matchMedia();

  initSmoothScroll();
  initNav();
  initHero();
  initTextReveals();
  initBlockReveals();
  initFigureReveals();
  initCounters();
  initMarquee();
  initPanels();

  initSpotlight(mm);
  initCursor(mm);
  initMagnetic(mm);
  initTilt(mm);
  initHorizontal(mm);

  // Fonts change line breaks, which changes every split and every pin length.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());

  return mm;
}

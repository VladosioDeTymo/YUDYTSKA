/* =========================================================================
   transitions.js — velvet curtain between pages.

   Internal links are intercepted, the curtain sweeps up, and only then does
   navigation happen. On the way back in, the curtain sweeps off the top.
   Disabled entirely under reduced motion, and never applied to modified
   clicks (new tab, download, external host, anchors).
   ========================================================================= */

import { reduced } from './motion.js';

const { gsap } = window;
const DURATION = 0.62;

function makeCurtain() {
  const el = document.createElement('div');
  el.className = 'curtain';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="curtain__mark">YUDYTSKA</span>';
  document.body.append(el);
  return el;
}

/** True when this click should be left alone for the browser to handle. */
function isPlainInternalClick(e, link) {
  if (!link) return false;
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (link.target && link.target !== '_self') return false;
  if (link.hasAttribute('download')) return false;

  const href = link.getAttribute('href');
  if (!href || href.startsWith('#')) return false;

  const url = new URL(href, location.href);
  if (url.origin !== location.origin) return false;
  if (!/\.html?$/.test(url.pathname) && url.pathname !== '/') return false;
  if (url.pathname === location.pathname) return false;

  return true;
}

export function initTransitions() {
  if (reduced) return;

  const curtain = makeCurtain();
  const mark = curtain.querySelector('.curtain__mark');

  // Entering the page: the curtain starts covering and lifts away.
  gsap.set(curtain, { yPercent: 0 });
  gsap.set(mark, { opacity: 0 });
  gsap.to(curtain, {
    yPercent: -100,
    duration: 0.75,
    ease: 'expo.inOut',
    delay: 0.05,
    onComplete: () => gsap.set(curtain, { yPercent: 100 }),
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!isPlainInternalClick(e, link)) return;

    e.preventDefault();
    const href = link.href;

    gsap.timeline()
      .to(curtain, { yPercent: 0, duration: DURATION, ease: 'expo.inOut' })
      .to(mark, { opacity: 1, duration: 0.25 }, '-=0.22')
      .call(() => { location.href = href; });
  });

  // Restoring from the back/forward cache would otherwise leave the page
  // hidden behind a curtain that never lifted.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) gsap.set(curtain, { yPercent: 100 });
  });
}

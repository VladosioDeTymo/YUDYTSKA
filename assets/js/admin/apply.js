/* =========================================================================
   apply.js — writes the merged content onto the page.

   Runs before the animation engine so that split-line reveals are built from
   the final text. When the panel edits something later it calls applyText /
   applyImage directly, which re-splits the element if it had been split.
   ========================================================================= */

import * as store from './store.js';

/* =========================================================================
   Text
   ========================================================================= */

/** Remembers the markup's own text so "revert" has something to go back to. */
const baseText = new Map();

export function originalText(el) {
  const key = el.dataset.edit;
  if (!baseText.has(key)) baseText.set(key, el.textContent.replace(/\s+/g, ' ').trim());
  return baseText.get(key);
}

export function fields() {
  return [...document.querySelectorAll('[data-edit]')];
}

export function imageFields() {
  return [...document.querySelectorAll('[data-edit-img]')];
}

export function fieldByKey(key) {
  return document.querySelector(`[data-edit="${CSS.escape(key)}"]`);
}

/**
 * Sets an element's text.
 *
 * `motion.js` replaces a heading's contents with masked line spans, so writing
 * textContent onto an already-split element would destroy the animation
 * markup. Splitting is therefore reset and redone.
 */
export function applyText(el, text) {
  if (!el) return;
  originalText(el);

  const wasSplit = el.dataset.split === 'done';
  el.textContent = text;

  if (wasSplit) {
    delete el.dataset.split;
    // Re-split on the next frame so layout has settled at the new length.
    requestAnimationFrame(() => {
      window.__yudytskaResplit?.(el);
    });
  }
}

/* =========================================================================
   Images
   ========================================================================= */

/**
 * Swaps the photo in a marked figure.
 *
 * A <picture> serves WebP through <source>, and a <source> always wins over
 * the <img> src — so the sources have to go, otherwise the original photo
 * stays on screen and the change looks like it silently failed.
 */
export function applyImage(wrap, url) {
  if (!wrap || !url) return;

  const img = wrap.querySelector('img');
  if (!img) return;

  const picture = img.closest('picture');
  if (picture) picture.querySelectorAll('source').forEach((s) => s.remove());

  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
  img.src = url;
  img.dataset.editReplaced = 'true';
}

/** Puts back the original markup captured before the first replacement. */
const baseImage = new Map();

export function captureImage(wrap) {
  const slot = wrap.dataset.editImg;
  if (!baseImage.has(slot)) {
    const holder = wrap.querySelector('picture') || wrap.querySelector('img');
    if (holder) baseImage.set(slot, holder.outerHTML);
  }
  return baseImage.get(slot);
}

export function revertImage(wrap) {
  const slot = wrap.dataset.editImg;
  const html = baseImage.get(slot);
  if (!html) return;

  const holder = wrap.querySelector('picture') || wrap.querySelector('img');
  if (holder) holder.outerHTML = html;
}

/* =========================================================================
   Links
   ========================================================================= */

export function applyLinkOverrides(LINKS) {
  for (const key of Object.keys(LINKS)) {
    const custom = store.value('links', key);
    if (custom) LINKS[key] = custom;
  }
  return LINKS;
}

/* =========================================================================
   Boot
   ========================================================================= */

/**
 * Loads both content layers and paints them onto the page.
 * Safe to call on every page; does nothing visible when there is no content.
 */
export async function applyContent() {
  // Capture the markup's own values before anything overwrites them.
  fields().forEach(originalText);
  imageFields().forEach(captureImage);

  await store.loadPublished();
  await store.loadDraft();
  await store.rehydrateImages();

  fields().forEach((el) => {
    const custom = store.value('text', el.dataset.edit);
    if (custom !== undefined && custom !== originalText(el)) applyText(el, custom);
  });

  imageFields().forEach((wrap) => {
    const custom = store.value('images', wrap.dataset.editImg);
    if (custom) applyImage(wrap, custom);
  });
}

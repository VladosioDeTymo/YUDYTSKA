/* =========================================================================
   store.js — content layers and local persistence.

   Three layers, applied in order:
     1. base      — whatever is written in the HTML (always works)
     2. published — assets/data/content.json (what every visitor sees)
     3. draft     — IndexedDB, this browser only (unpublished edits)

   Photos and the GitHub token live in IndexedDB too: photos because base64
   images blow past the ~5 MB localStorage quota, the token because it must
   never touch a file that gets deployed.
   ========================================================================= */

const DB_NAME = 'yudytska-admin';
const DB_VERSION = 1;
const STORE = 'kv';

const K_DRAFT = 'draft';
const K_IMAGES = 'images';
const K_SETTINGS = 'settings';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* =========================================================================
   Published layer
   ========================================================================= */

const EMPTY = { version: 1, text: {}, images: {}, links: {} };

export let published = { ...EMPTY };

/** Loads assets/data/content.json. A missing or broken file is not an error —
 *  the site simply falls back to the content written in the HTML. */
export async function loadPublished(base = '') {
  try {
    const res = await fetch(`${base}assets/data/content.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return published;
    const data = await res.json();
    published = {
      version: data.version ?? 1,
      updated: data.updated,
      text: data.text || {},
      images: data.images || {},
      links: data.links || {},
    };
  } catch {
    /* offline, 404, or malformed JSON — keep the empty layer */
  }
  return published;
}

/* =========================================================================
   Draft layer (this browser only)
   ========================================================================= */

export let draft = { text: {}, images: {}, links: {} };

export async function loadDraft() {
  const stored = await idbGet(K_DRAFT).catch(() => null);
  if (stored) draft = { text: {}, images: {}, links: {}, ...stored };
  return draft;
}

async function persistDraft() {
  await idbSet(K_DRAFT, draft);
}

export function draftCount() {
  return Object.keys(draft.text).length
    + Object.keys(draft.images).length
    + Object.keys(draft.links).length;
}

/** Records an edit, or clears it when the value matches the layer beneath. */
export async function setValue(kind, key, value) {
  const beneath = kind === 'text' ? published.text[key]
    : kind === 'links' ? published.links[key]
      : published.images[key];

  if (value === undefined || value === null || value === beneath) {
    delete draft[kind][key];
  } else {
    draft[kind][key] = value;
  }
  await persistDraft();
}

export async function clearValue(kind, key) {
  delete draft[kind][key];
  if (kind === 'images') await deleteImage(key);
  await persistDraft();
}

export async function clearDraft() {
  draft = { text: {}, images: {}, links: {} };
  await idbSet(K_IMAGES, {});
  await persistDraft();
}

/* =========================================================================
   Merged view — what should actually be on screen
   ========================================================================= */

export function value(kind, key) {
  if (draft[kind][key] !== undefined) return draft[kind][key];
  if (published[kind][key] !== undefined) return published[kind][key];
  return undefined;
}

export function isEdited(kind, key) {
  return draft[kind][key] !== undefined;
}

/* =========================================================================
   Images

   Draft photos are held as Blobs and surfaced as object URLs. Once published
   they become ordinary paths under assets/img/custom/.
   ========================================================================= */

const objectUrls = new Map();

export async function getImages() {
  return (await idbGet(K_IMAGES).catch(() => null)) || {};
}

export async function putImage(slot, blob) {
  const all = await getImages();
  all[slot] = blob;
  await idbSet(K_IMAGES, all);

  // Replace any previous URL for this slot so the old blob can be collected.
  if (objectUrls.has(slot)) URL.revokeObjectURL(objectUrls.get(slot));
  const url = URL.createObjectURL(blob);
  objectUrls.set(slot, url);

  draft.images[slot] = url;
  await persistDraft();
  return url;
}

export async function deleteImage(slot) {
  const all = await getImages();
  delete all[slot];
  await idbSet(K_IMAGES, all);

  if (objectUrls.has(slot)) {
    URL.revokeObjectURL(objectUrls.get(slot));
    objectUrls.delete(slot);
  }
}

/** Object URLs die with the page, so they are rebuilt from IndexedDB on load. */
export async function rehydrateImages() {
  const all = await getImages();
  for (const [slot, blob] of Object.entries(all)) {
    if (!(blob instanceof Blob)) continue;
    const url = URL.createObjectURL(blob);
    objectUrls.set(slot, url);
    draft.images[slot] = url;
  }
  return draft.images;
}

export async function imageBlob(slot) {
  const all = await getImages();
  return all[slot] || null;
}

/* =========================================================================
   Settings — repo coordinates and the GitHub token.
   Deliberately IndexedDB and nothing else: never a file, never the repo.
   ========================================================================= */

const DEFAULT_SETTINGS = { owner: '', repo: '', branch: 'main', token: '' };

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...((await idbGet(K_SETTINGS).catch(() => null)) || {}) };
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await idbSet(K_SETTINGS, next);
  return next;
}

export async function forgetToken() {
  await saveSettings({ token: '' });
}

export async function wipeAll() {
  await idbDel(K_DRAFT);
  await idbDel(K_IMAGES);
  await idbDel(K_SETTINGS);
  draft = { text: {}, images: {}, links: {} };
}

/** Builds the object that gets published. Draft photos are excluded — the
 *  publisher swaps in real repository paths once the files are uploaded. */
export function buildPayload() {
  return {
    version: (published.version || 1) + 1,
    updated: new Date().toISOString(),
    text: { ...published.text, ...draft.text },
    links: { ...published.links, ...draft.links },
    images: { ...published.images },
  };
}

/* =========================================================================
   github.js — publishing through the GitHub Contents API.

   The token is supplied by the panel from IndexedDB and is never written to
   any file in the repository. Nothing here persists it.
   ========================================================================= */

import * as store from './store.js';

const API = 'https://api.github.com';
const CONTENT_PATH = 'assets/data/content.json';
const IMG_DIR = 'assets/img/custom';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Turns an API failure into something a non-developer can act on. */
async function explain(res) {
  let detail = '';
  try { detail = (await res.json()).message || ''; } catch { /* no body */ }

  switch (res.status) {
    case 401:
      return 'Токен недійсний або протермінований. Створіть новий і вставте його в налаштуваннях.';
    case 403:
      return 'Токен не має права запису. Потрібен доступ «Contents: Read and write» саме до цього репозиторію.';
    case 404:
      return 'Репозиторій не знайдено. Перевірте власника та назву в налаштуваннях (і що токен бачить цей репозиторій).';
    case 409:
    case 422:
      return 'Файл на GitHub змінився з іншого пристрою. Перезавантажте сторінку й опублікуйте ще раз.';
    default:
      return `GitHub повернув помилку ${res.status}. ${detail}`;
  }
}

/* Base64 for UTF-8 text — btoa alone throws on Cyrillic. */
function encodeText(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function encodeBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  const CHUNK = 0x8000; // avoids "too many arguments" on large photos
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Short content hash, so a replaced photo never reuses a cached filename. */
async function shortHash(buffer) {
  const digest = await crypto.subtle.digest('SHA-1', buffer);
  return [...new Uint8Array(digest)].slice(0, 4)
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* =========================================================================
   Requests
   ========================================================================= */

export async function checkConnection({ owner, repo, branch, token }) {
  if (!owner || !repo) throw new Error('Вкажіть власника та назву репозиторію.');
  if (!token) throw new Error('Вставте GitHub-токен.');

  const res = await fetch(`${API}/repos/${owner}/${repo}/branches/${branch || 'main'}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await explain(res));

  return { ok: true, message: `З'єднання працює: ${owner}/${repo} (${branch || 'main'})` };
}

async function getSha(path, { owner, repo, branch, token }) {
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    { headers: headers(token) },
  );
  if (res.status === 404) return null;      // first publish; the file does not exist yet
  if (!res.ok) throw new Error(await explain(res));
  return (await res.json()).sha;
}

async function putFile(path, base64, message, cfg) {
  const sha = await getSha(path, cfg);

  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: base64,
      branch: cfg.branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) throw new Error(await explain(res));
  return res.json();
}

/* =========================================================================
   Publish
   ========================================================================= */

/**
 * Uploads any replaced photos, then the content file that points at them.
 * `onStep(done, total, label)` drives the progress readout in the panel.
 */
export async function publish(onStep = () => {}) {
  const cfg = await store.getSettings();
  if (!cfg.owner || !cfg.repo) throw new Error('Спершу заповніть налаштування репозиторію.');
  if (!cfg.token) throw new Error('Спершу вставте GitHub-токен у налаштуваннях.');
  cfg.branch = cfg.branch || 'main';

  const payload = store.buildPayload();
  const slots = Object.keys(store.draft.images);
  const total = slots.length + 1;
  let done = 0;

  for (const slot of slots) {
    const blob = await store.imageBlob(slot);
    if (!blob) continue;

    onStep(done, total, `Завантажую фото: ${slot}`);

    const buffer = await blob.arrayBuffer();
    const path = `${IMG_DIR}/${slot}-${await shortHash(buffer)}.jpg`;

    await putFile(path, encodeBytes(buffer), `Оновлено фото: ${slot}`, cfg);
    payload.images[slot] = path;
    done++;
  }

  onStep(done, total, 'Зберігаю тексти та посилання');
  const result = await putFile(
    CONTENT_PATH,
    encodeText(JSON.stringify(payload, null, 2)),
    'Оновлено вміст сайту через панель редагування',
    cfg,
  );
  done++;
  onStep(done, total, 'Готово');

  // The draft is now the published state, so start clean.
  store.published = payload;
  await store.clearDraft();

  return {
    commitUrl: result?.commit?.html_url,
    message: 'Опубліковано. GitHub Pages оновить сайт приблизно за хвилину.',
  };
}

/** Always-available fallback: download the file and upload it by hand. */
export function exportFile() {
  const payload = store.buildPayload();

  // Draft photos are blob: URLs that only exist in this browser, so they are
  // not valid in an exported file. Say so rather than writing a dead link.
  const localOnly = Object.keys(store.draft.images);
  for (const slot of localOnly) delete payload.images[slot];

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'content.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return localOnly;
}

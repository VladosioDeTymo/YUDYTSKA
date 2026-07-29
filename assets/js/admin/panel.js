/* =========================================================================
   panel.js — the editing interface.

   Fields are discovered from the page itself: every [data-edit] element is a
   text field, every [data-edit-img] is a photo slot. The markup is the
   schema, so adding a field later means adding one attribute.
   ========================================================================= */

import * as store from './store.js';
import * as apply from './apply.js';
import { publish, exportFile, checkConnection } from './github.js';

const PAGES = [
  { file: 'index.html', label: 'Головна' },
  { file: 'about.html', label: 'Про мене' },
  { file: 'music.html', label: 'Музика' },
  { file: 'live.html', label: 'Виступи' },
  { file: 'press.html', label: 'Медіа' },
];

const LINK_FIELDS = [
  { key: 'instagram', label: 'Instagram', hint: 'Повне посилання на профіль' },
  { key: 'youtube', label: 'YouTube', hint: 'Посилання на канал' },
  { key: 'facebook', label: 'Facebook', hint: 'Посилання на сторінку' },
  { key: 'spotify', label: 'Spotify', hint: 'Посилання на профіль артиста' },
  { key: 'telegram', label: 'Telegram', hint: 'Посилання на профіль' },
  { key: 'email', label: 'Пошта', hint: 'Тільки адреса, без mailto:' },
  { key: 'ytId', label: 'ID кліпу «Ідеальні вони»', hint: 'З youtu.be/ABC123 → ABC123' },
];

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;

let root = null;
let view = 'page';        // 'page' | 'links' | 'photos' | 'settings'
let query = '';

const currentPage = () => {
  const name = location.pathname.split('/').pop() || 'index.html';
  return PAGES.find((p) => p.file === name) || PAGES[0];
};

const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* =========================================================================
   Field discovery
   ========================================================================= */

function textFields() {
  return apply.fields().map((el) => {
    const section = el.closest('[data-edit-section]');
    return {
      el,
      key: el.dataset.edit,
      label: el.dataset.editLabel || el.dataset.edit,
      group: section?.dataset.editSection || 'Інше',
      original: apply.originalText(el),
      long: (el.dataset.editLabel || '').length > 0 && el.tagName === 'P',
    };
  });
}

function photoFields() {
  return apply.imageFields().map((wrap) => ({
    wrap,
    slot: wrap.dataset.editImg,
    label: wrap.dataset.editLabel || wrap.dataset.editImg,
    group: wrap.closest('[data-edit-section]')?.dataset.editSection || 'Інше',
  }));
}

function matches(field) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (field.label || '').toLowerCase().includes(q)
    || (field.original || '').toLowerCase().includes(q);
}

/* =========================================================================
   Photo processing — shrink in the browser before anything is stored
   ========================================================================= */

async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  return { blob, w, h };
}

const kb = (bytes) => `${Math.round(bytes / 1024)} КБ`;

/* =========================================================================
   Rendering
   ========================================================================= */

function renderSidebar() {
  const page = currentPage();
  const counts = {};
  for (const key of Object.keys(store.draft.text)) {
    const p = key.split('.')[0];
    counts[p] = (counts[p] || 0) + 1;
  }

  const pageItems = PAGES.map((p) => {
    const slug = p.file.replace('.html', '');
    const n = counts[slug] || 0;
    const active = p.file === page.file && view === 'page';
    return `<button class="ap-nav__item${active ? ' is-active' : ''}" data-goto="${p.file}">
      <span>${p.label}</span>${n ? `<span class="ap-nav__badge">${n}</span>` : ''}
    </button>`;
  }).join('');

  const globals = [
    ['links', 'Посилання'],
    ['photos', 'Фото'],
    ['settings', 'Публікація'],
  ].map(([v, label]) => `
    <button class="ap-nav__item${view === v ? ' is-active' : ''}" data-view="${v}">
      <span>${label}</span>
    </button>`).join('');

  return `
    <p class="ap-nav__title">Сторінки</p>
    ${pageItems}
    <p class="ap-nav__title">Загальне</p>
    ${globals}`;
}

function renderTextFields() {
  const fields = textFields().filter(matches);
  if (!fields.length) {
    return `<p class="ap-empty">${query ? 'Нічого не знайдено.' : 'На цій сторінці немає редагованих полів.'}</p>`;
  }

  const groups = new Map();
  for (const f of fields) {
    if (!groups.has(f.group)) groups.set(f.group, []);
    groups.get(f.group).push(f);
  }

  return [...groups].map(([group, list]) => `
    <section class="ap-group">
      <h3 class="ap-group__title">${escapeHtml(group)}</h3>
      ${list.map((f) => {
        const val = store.value('text', f.key) ?? f.original;
        const edited = store.isEdited('text', f.key);
        const multiline = val.length > 90;
        return `
        <div class="ap-field${edited ? ' is-edited' : ''}" data-key="${escapeHtml(f.key)}">
          <div class="ap-field__head">
            <label class="ap-field__label" for="f-${escapeHtml(f.key)}">${escapeHtml(f.label)}</label>
            ${edited ? `<button class="ap-revert" type="button" data-revert="${escapeHtml(f.key)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M4 10h9a5 5 0 1 1-5 5"/><path d="M4 5v5h5"/>
              </svg>Повернути</button>` : ''}
          </div>
          ${multiline
            ? `<textarea class="ap-input" id="f-${escapeHtml(f.key)}" rows="3" data-text="${escapeHtml(f.key)}">${escapeHtml(val)}</textarea>`
            : `<input class="ap-input" id="f-${escapeHtml(f.key)}" type="text" data-text="${escapeHtml(f.key)}" value="${escapeHtml(val)}">`}
        </div>`;
      }).join('')}
    </section>`).join('');
}

function renderPhotos() {
  const fields = photoFields().filter((f) => !query || f.label.toLowerCase().includes(query.toLowerCase()));
  if (!fields.length) {
    return `<p class="ap-empty">На цій сторінці немає фото. Відкрийте потрібну сторінку в списку зліва.</p>`;
  }

  return `
    <section class="ap-group">
      <h3 class="ap-group__title">Фото цієї сторінки</h3>
      <p class="ap-note">Нове фото автоматично зменшується до 1920px і стискається — важкі знімки з телефона завантажувати можна.</p>
      <div class="ap-photos">
        ${fields.map((f) => {
          const custom = store.value('images', f.slot);
          const edited = store.isEdited('images', f.slot);
          const img = f.wrap.querySelector('img');
          const src = custom || img?.currentSrc || img?.src || '';
          return `
          <figure class="ap-photo${edited ? ' is-edited' : ''}">
            <div class="ap-photo__frame">
              <img src="${escapeHtml(src)}" alt="" loading="lazy">
              ${edited ? '<span class="ap-photo__tag">Замінено</span>' : ''}
            </div>
            <figcaption>${escapeHtml(f.label)}</figcaption>
            <div class="ap-photo__actions">
              <button class="ap-btn ap-btn--sm" type="button" data-photo="${escapeHtml(f.slot)}">Замінити</button>
              ${edited ? `<button class="ap-btn ap-btn--sm ap-btn--quiet" type="button" data-photo-revert="${escapeHtml(f.slot)}">Повернути</button>` : ''}
            </div>
            <p class="ap-photo__meta" data-meta="${escapeHtml(f.slot)}"></p>
          </figure>`;
        }).join('')}
      </div>
    </section>`;
}

function renderLinks() {
  return `
    <section class="ap-group">
      <h3 class="ap-group__title">Посилання та кліп</h3>
      <p class="ap-note">Ці значення діють на всіх сторінках одразу.</p>
      ${LINK_FIELDS.map((f) => {
        const current = store.value('links', f.key) ?? '';
        const edited = store.isEdited('links', f.key);
        return `
        <div class="ap-field${edited ? ' is-edited' : ''}">
          <div class="ap-field__head">
            <label class="ap-field__label" for="l-${f.key}">${f.label}</label>
            ${edited ? `<button class="ap-revert" type="button" data-revert-link="${f.key}">Повернути</button>` : ''}
          </div>
          <input class="ap-input" id="l-${f.key}" type="text" data-link-key="${f.key}"
                 value="${escapeHtml(current)}" placeholder="${escapeHtml(f.hint)}">
          <p class="ap-hint">${escapeHtml(f.hint)}</p>
        </div>`;
      }).join('')}
    </section>`;
}

function renderSettings(settings) {
  return `
    <section class="ap-group">
      <h3 class="ap-group__title">Публікація на сайт</h3>
      <p class="ap-note">
        Токен зберігається <b>тільки у цьому браузері</b> й ніколи не потрапляє у файли сайту.
        Не вводьте його на чужому чи спільному комп'ютері.
      </p>

      <div class="ap-field">
        <label class="ap-field__label" for="s-owner">Власник репозиторію</label>
        <input class="ap-input" id="s-owner" type="text" data-setting="owner"
               value="${escapeHtml(settings.owner)}" placeholder="напр. vladislavtimosuk">
      </div>
      <div class="ap-field">
        <label class="ap-field__label" for="s-repo">Назва репозиторію</label>
        <input class="ap-input" id="s-repo" type="text" data-setting="repo"
               value="${escapeHtml(settings.repo)}" placeholder="напр. YUDYTSKA">
      </div>
      <div class="ap-field">
        <label class="ap-field__label" for="s-branch">Гілка</label>
        <input class="ap-input" id="s-branch" type="text" data-setting="branch"
               value="${escapeHtml(settings.branch || 'main')}">
      </div>
      <div class="ap-field">
        <label class="ap-field__label" for="s-token">GitHub-токен</label>
        <input class="ap-input" id="s-token" type="password" data-setting="token"
               value="${escapeHtml(settings.token)}" placeholder="github_pat_…" autocomplete="off">
        <p class="ap-hint">
          GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
          Оберіть <b>тільки цей репозиторій</b> і право <b>Contents: Read and write</b>. Більше нічого.
        </p>
      </div>

      <div class="ap-row">
        <button class="ap-btn" type="button" data-check>Перевірити з'єднання</button>
        <button class="ap-btn ap-btn--quiet" type="button" data-forget>Забути токен</button>
      </div>
      <p class="ap-status" data-check-status role="status"></p>
    </section>

    <section class="ap-group">
      <h3 class="ap-group__title">Небезпечна зона</h3>
      <p class="ap-note">Скидає всі незбережені зміни в цьому браузері. Опубліковане не чіпає.</p>
      <button class="ap-btn ap-btn--danger" type="button" data-reset>Скасувати всі зміни</button>
    </section>`;
}

/* =========================================================================
   Main render
   ========================================================================= */

async function render() {
  const settings = await store.getSettings();
  const n = store.draftCount();

  let body;
  if (view === 'links') body = renderLinks();
  else if (view === 'photos') body = renderPhotos();
  else if (view === 'settings') body = renderSettings(settings);
  else body = renderTextFields();

  root.querySelector('.ap-nav').innerHTML = renderSidebar();
  root.querySelector('.ap-body').innerHTML = body;
  root.querySelector('[data-draft-count]').textContent = n
    ? `Незбережених змін: ${n}`
    : 'Змін немає';
  root.querySelector('[data-draft-count]').dataset.on = n ? 'yes' : 'no';
  root.querySelector('[data-title]').textContent = view === 'page'
    ? currentPage().label
    : ({ links: 'Посилання', photos: 'Фото', settings: 'Публікація' })[view];
}

/* =========================================================================
   Events
   ========================================================================= */

const liveText = debounce((key, value) => {
  // The page is updated first and storage second. Writing to IndexedDB can be
  // delayed by the browser, and typing must never appear to do nothing while
  // that settles.
  const el = apply.fieldByKey(key);
  if (el) apply.applyText(el, value);

  // setValue records the change synchronously and only the write to storage
  // is deferred, so the counter below is already up to date.
  const saving = store.setValue('text', key, value);

  const badge = root.querySelector('[data-draft-count]');
  const n = store.draftCount();
  badge.textContent = n ? `Незбережених змін: ${n}` : 'Змін немає';
  badge.dataset.on = n ? 'yes' : 'no';

  saving.catch(() => {
    const out = root.querySelector('[data-publish-status]');
    if (out) {
      out.textContent = 'Не вдалося зберегти чернетку в цьому браузері. Опублікуйте зміни, щоб не втратити їх.';
      out.dataset.kind = 'bad';
    }
  });
}, 250);

function wire() {
  const body = root.querySelector('.ap-body');

  // Text and link inputs.
  body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.text) {
      if (t.tagName === 'TEXTAREA') {
        t.style.height = 'auto';
        t.style.height = `${t.scrollHeight}px`;
      }
      liveText(t.dataset.text, t.value);
      t.closest('.ap-field')?.classList.add('is-edited');
    }
    if (t.dataset.linkKey) store.setValue('links', t.dataset.linkKey, t.value.trim());
    if (t.dataset.setting) store.saveSettings({ [t.dataset.setting]: t.value.trim() });
  });

  body.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // Revert one text field.
    if (btn.dataset.revert) {
      const key = btn.dataset.revert;
      await store.clearValue('text', key);
      const el = apply.fieldByKey(key);
      if (el) apply.applyText(el, apply.originalText(el));
      render();
      return;
    }

    if (btn.dataset.revertLink) {
      await store.clearValue('links', btn.dataset.revertLink);
      render();
      return;
    }

    // Replace a photo.
    if (btn.dataset.photo) {
      const slot = btn.dataset.photo;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        const meta = root.querySelector(`[data-meta="${CSS.escape(slot)}"]`);
        if (meta) meta.textContent = 'Обробляю…';

        try {
          const { blob, w, h } = await shrink(file);
          const url = await store.putImage(slot, blob);
          const wrap = document.querySelector(`[data-edit-img="${CSS.escape(slot)}"]`);
          apply.applyImage(wrap, url);
          render();
          const after = root.querySelector(`[data-meta="${CSS.escape(slot)}"]`);
          if (after) after.textContent = `${w}×${h} · ${kb(file.size)} → ${kb(blob.size)}`;
        } catch {
          if (meta) meta.textContent = 'Не вдалося обробити це зображення.';
        }
      };
      input.click();
      return;
    }

    if (btn.dataset.photoRevert) {
      const slot = btn.dataset.photoRevert;
      await store.clearValue('images', slot);
      apply.revertImage(document.querySelector(`[data-edit-img="${CSS.escape(slot)}"]`));
      render();
      return;
    }

    // Settings actions.
    if (btn.hasAttribute('data-check')) {
      const out = root.querySelector('[data-check-status]');
      out.textContent = 'Перевіряю…';
      out.dataset.kind = '';
      try {
        const r = await checkConnection(await store.getSettings());
        out.textContent = r.message;
        out.dataset.kind = 'ok';
      } catch (err) {
        out.textContent = err.message;
        out.dataset.kind = 'bad';
      }
      return;
    }

    if (btn.hasAttribute('data-forget')) {
      await store.forgetToken();
      render();
      return;
    }

    if (btn.hasAttribute('data-reset')) {
      if (!confirm('Скасувати всі незбережені зміни? Цю дію не можна відмінити.')) return;
      await store.clearDraft();
      location.reload();
    }
  });

  // Sidebar.
  root.querySelector('.ap-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.view) {
      view = btn.dataset.view;
      query = '';
      root.querySelector('[data-search]').value = '';
      render();
      root.classList.remove('is-nav-open');
      return;
    }

    if (btn.dataset.goto) {
      const file = btn.dataset.goto;
      if (file === currentPage().file) {
        view = 'page';
        render();
        root.classList.remove('is-nav-open');
        return;
      }
      // Drafts live in IndexedDB, so navigating loses nothing.
      location.href = `${file}#admin`;
    }
  });

  // Toolbar.
  root.querySelector('[data-search]').addEventListener('input', (e) => {
    query = e.target.value.trim();
    render();
  });

  root.querySelector('[data-close]').addEventListener('click', closePanel);
  root.querySelector('[data-nav-toggle]').addEventListener('click', () => {
    root.classList.toggle('is-nav-open');
  });

  root.querySelector('[data-peek]').addEventListener('click', () => {
    root.classList.toggle('is-peek');
    const on = root.classList.contains('is-peek');
    root.querySelector('[data-peek]').textContent = on ? 'Показати панель' : 'Переглянути сайт';
  });

  root.querySelector('[data-export]').addEventListener('click', () => {
    const skipped = exportFile();
    if (skipped.length) {
      alert(`Файл завантажено.\n\nУвага: замінені фото (${skipped.length}) не потрапляють у цей файл — вони існують лише у вашому браузері. Щоб опублікувати фото, скористайтеся кнопкою «Опублікувати».`);
    }
  });

  root.querySelector('[data-publish]').addEventListener('click', async () => {
    const btn = root.querySelector('[data-publish]');
    const out = root.querySelector('[data-publish-status]');

    if (!store.draftCount()) {
      out.textContent = 'Немає що публікувати.';
      out.dataset.kind = '';
      return;
    }

    btn.disabled = true;
    out.dataset.kind = '';
    try {
      const r = await publish((done, total, label) => {
        out.textContent = `${label} (${done}/${total})`;
      });
      out.textContent = r.message;
      out.dataset.kind = 'ok';
      render();
    } catch (err) {
      out.textContent = err.message;
      out.dataset.kind = 'bad';
    } finally {
      btn.disabled = false;
    }
  });

  root.querySelector('[data-logout]').addEventListener('click', async () => {
    if (!confirm('Вийти з панелі та забути токен на цьому пристрої?')) return;
    await store.forgetToken();
    sessionStorage.removeItem('yudytska:admin');
    closePanel();
  });

  document.addEventListener('keydown', (e) => {
    if (root && !root.hidden && e.key === 'Escape' && !root.classList.contains('is-peek')) {
      closePanel();
    }
  });
}

/* =========================================================================
   Shell
   ========================================================================= */

function build() {
  const el = document.createElement('div');
  el.className = 'ap';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Панель редагування сайту');

  el.innerHTML = `
    <header class="ap-top">
      <button class="ap-icon" type="button" data-nav-toggle aria-label="Розділи">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16"/>
        </svg>
      </button>
      <div class="ap-top__id">
        <span class="ap-top__mark">YUDYTSKA</span>
        <span class="ap-top__page" data-title></span>
      </div>
      <span class="ap-chip" data-draft-count data-on="no">Змін немає</span>
      <button class="ap-icon ap-icon--end" type="button" data-close aria-label="Закрити панель">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
    </header>

    <div class="ap-main">
      <nav class="ap-nav" aria-label="Розділи панелі" data-lenis-prevent></nav>
      <div class="ap-content">
        <div class="ap-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>
          </svg>
          <input type="search" data-search placeholder="Пошук по полях…" aria-label="Пошук по полях">
        </div>
        <div class="ap-body" data-lenis-prevent></div>
      </div>
    </div>

    <footer class="ap-actions">
      <p class="ap-status" data-publish-status role="status"></p>
      <div class="ap-actions__row">
        <button class="ap-btn ap-btn--primary" type="button" data-publish>Опублікувати</button>
        <button class="ap-btn" type="button" data-export>Експорт</button>
        <button class="ap-btn ap-btn--quiet" type="button" data-peek>Переглянути сайт</button>
        <button class="ap-btn ap-btn--quiet" type="button" data-logout>Вийти</button>
      </div>
    </footer>`;

  document.body.append(el);
  return el;
}

export async function openPanel() {
  if (!root) {
    root = build();
    wire();
  }

  root.hidden = false;
  void root.offsetWidth;
  root.classList.add('is-open');
  document.body.classList.add('is-locked');

  // Lenis keeps driving the page behind the panel otherwise.
  window.__yudytskaLenis?.stop?.();

  view = 'page';
  await render();
}

export function closePanel() {
  if (!root) return;
  root.classList.remove('is-open', 'is-peek', 'is-nav-open');
  document.body.classList.remove('is-locked');
  window.__yudytskaLenis?.start?.();

  setTimeout(() => { root.hidden = true; }, 260);

  if (location.hash === '#admin') {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

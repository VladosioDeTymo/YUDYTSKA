/* =========================================================================
   gate.js — the footer gear, the code screen, and lazy-loading of the panel.

   The code is client-side, so it is a guard against accidental edits rather
   than against a determined stranger. The real barrier is the GitHub token,
   which lives only in this browser: without it nothing can be published, even
   by someone who gets past this screen.
   ========================================================================= */

const CODE = '2283';
const MAX_TRIES = 3;
const LOCK_MS = 30_000;

const SESSION_KEY = 'yudytska:admin';
const TRIES_KEY = 'yudytska:admin-tries';
const LOCK_KEY = 'yudytska:admin-locked-until';

let panelPromise = null;

function loadPanel() {
  if (!panelPromise) {
    panelPromise = Promise.all([
      import('./panel.js'),
      loadStyles(),
    ]).then(([m]) => m);
  }
  return panelPromise;
}

/* The stylesheet covers the code screen as well as the panel, so it has to be
   in place before the dialog is shown — otherwise the keypad renders as bare
   unstyled markup at the bottom of the page. */
let stylesPromise = null;
const ensureStyles = () => (stylesPromise ||= loadStyles());

function loadStyles() {
  return new Promise((resolve) => {
    if (document.querySelector('link[data-admin-css]')) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/admin.css';
    link.dataset.adminCss = '';
    link.onload = resolve;
    link.onerror = resolve;
    document.head.append(link);
  });
}

/* =========================================================================
   Lockout
   ========================================================================= */
const lockedFor = () => {
  const until = Number(sessionStorage.getItem(LOCK_KEY) || 0);
  return Math.max(0, until - Date.now());
};

function registerFailure() {
  const tries = Number(sessionStorage.getItem(TRIES_KEY) || 0) + 1;
  sessionStorage.setItem(TRIES_KEY, String(tries));

  if (tries >= MAX_TRIES) {
    sessionStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MS));
    sessionStorage.setItem(TRIES_KEY, '0');
    return true;
  }
  return false;
}

/* =========================================================================
   Code screen
   ========================================================================= */
function buildDialog() {
  const el = document.createElement('div');
  el.className = 'gate';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Вхід до панелі редагування');

  el.innerHTML = `
    <div class="gate__card">
      <button class="gate__close" type="button" aria-label="Закрити">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>

      <p class="gate__eyebrow">Панель редагування</p>
      <h2 class="gate__title">Введіть код</h2>

      <div class="gate__dots" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>

      <label class="visually-hidden" for="gate-code">Код доступу</label>
      <input class="gate__input" id="gate-code" type="text" inputmode="numeric"
             autocomplete="off" maxlength="4" pattern="[0-9]*"
             aria-describedby="gate-msg">

      <div class="gate__pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-key="${n}">${n}</button>`).join('')}
        <button type="button" data-key="clear" aria-label="Очистити">C</button>
        <button type="button" data-key="0">0</button>
        <button type="button" data-key="back" aria-label="Стерти">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
            <path d="M9 5h11v14H9L3 12z"/><path d="M13 9.5l4 5M17 9.5l-4 5"/>
          </svg>
        </button>
      </div>

      <p class="gate__msg" id="gate-msg" role="status"></p>
    </div>`;

  document.body.append(el);
  return el;
}

export function initGate() {
  const trigger = document.querySelector('[data-admin-open]');
  if (!trigger) return;

  let dialog = null;
  let input = null;
  let msg = null;
  let lockTimer = null;

  const paintDots = () => {
    const n = input.value.length;
    dialog.querySelectorAll('.gate__dots span').forEach((d, i) => {
      d.classList.toggle('is-on', i < n);
    });
  };

  const setMsg = (text, kind = '') => {
    msg.textContent = text;
    msg.dataset.kind = kind;
  };

  const openPanel = async () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setMsg('Відкриваю…');
    try {
      const panel = await loadPanel();
      close();
      panel.openPanel();
    } catch {
      setMsg('Не вдалося завантажити панель. Перезавантажте сторінку.', 'bad');
    }
  };

  const submit = () => {
    if (lockedFor() > 0) return;

    if (input.value === CODE) {
      sessionStorage.setItem(TRIES_KEY, '0');
      openPanel();
      return;
    }

    input.value = '';
    paintDots();
    dialog.querySelector('.gate__card').classList.remove('is-wrong');
    void dialog.offsetWidth;
    dialog.querySelector('.gate__card').classList.add('is-wrong');

    if (registerFailure()) startLockCountdown();
    else setMsg('Невірний код', 'bad');
  };

  function startLockCountdown() {
    const tick = () => {
      const left = Math.ceil(lockedFor() / 1000);
      if (left <= 0) {
        clearInterval(lockTimer);
        lockTimer = null;
        setMsg('');
        input.disabled = false;
        return;
      }
      setMsg(`Забагато спроб. Зачекайте ${left} с`, 'bad');
      input.disabled = true;
    };
    clearInterval(lockTimer);
    tick();
    lockTimer = setInterval(tick, 250);
  }

  const close = () => {
    dialog.hidden = true;
    dialog.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    trigger.focus({ preventScroll: true });
  };

  const open = async () => {
    await ensureStyles();

    if (!dialog) {
      dialog = buildDialog();
      input = dialog.querySelector('.gate__input');
      msg = dialog.querySelector('.gate__msg');

      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 4);
        paintDots();
        setMsg('');
        if (input.value.length === 4) submit();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });

      dialog.querySelector('.gate__pad').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || input.disabled) return;
        const k = btn.dataset.key;

        if (k === 'clear') input.value = '';
        else if (k === 'back') input.value = input.value.slice(0, -1);
        else if (input.value.length < 4) input.value += k;

        paintDots();
        setMsg('');
        if (input.value.length === 4) submit();
      });

      dialog.querySelector('.gate__close').addEventListener('click', close);
      dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
      document.addEventListener('keydown', (e) => {
        if (!dialog.hidden && e.key === 'Escape') close();
      });
    }

    dialog.hidden = false;
    void dialog.offsetWidth;
    dialog.classList.add('is-open');
    document.body.classList.add('is-locked');

    input.value = '';
    input.disabled = false;
    paintDots();
    setMsg('');
    if (lockedFor() > 0) startLockCountdown();

    // Focus without summoning the on-screen keyboard on touch devices, where
    // the built-in keypad is the nicer way in.
    if (matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
    else dialog.querySelector('.gate__close').focus({ preventScroll: true });
  };

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    // Already signed in this session — skip straight to the panel.
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      loadPanel().then((p) => p.openPanel()).catch(() => open());
      return;
    }
    open();
  });

  // Reopen automatically after switching pages from inside the panel.
  if (location.hash === '#admin' && sessionStorage.getItem(SESSION_KEY) === '1') {
    loadPanel().then((p) => p.openPanel()).catch(() => {});
  }
}

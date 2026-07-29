/* =========================================================================
   config.js — single source of truth for links and image metadata.
   Change things here, not in the markup.
   ========================================================================= */

/* -------------------------------------------------------------------------
   ⚙️  ПОСИЛАННЯ НА КЛІП «ІДЕАЛЬНІ ВОНИ»
   Встав сюди ID відео з YouTube і все запрацює автоматично.
   З https://youtu.be/dQw4w9WgXcQ  →  ID це 'dQw4w9WgXcQ'
   З https://www.youtube.com/watch?v=dQw4w9WgXcQ  →  теж 'dQw4w9WgXcQ'

   Поки тут порожній рядок, блок кліпу показує обкладинку синглу
   з кнопкою на YouTube-канал. Сайт при цьому повністю робочий.
   ------------------------------------------------------------------------- */
export const YT_ID = '';

export const LINKS = {
  instagram: 'https://www.instagram.com/alena__the_wise_24?igsh=MTF3cXBwcGExMm5pbA==',
  youtube:   'https://youtube.com/@yudytska_music?si=O2h5riVGBftrVos2',
  facebook:  'https://www.facebook.com/share/1GkhVJE7Gs/?mibextid=wwXIfr',
  spotify:   'https://open.spotify.com/artist/0RB1OhSPT4uSuSHk7KcUBI?si=-WP6_XF_QmShZxMnJsckPw&utm_source=copylink',
  telegram:  'https://t.me/alyona_singer_ua',
  email:     'yudytska.music@gmail.com',
};

/** Watch URL for the music video — falls back to the channel until YT_ID is set. */
export const WATCH_URL = YT_ID
  ? `https://www.youtube.com/watch?v=${YT_ID}`
  : LINKS.youtube;

export const PRESS = [
  {
    outlet: 'Музична Ліга',
    title: 'YUDYTSKA: без продюсера, без великих бюджетів',
    note:  'Про те, як незалежний проєкт будується без лейблу й інвесторів.',
    url:   'https://mliga.com.ua/yudytskabez-продюсера-без-великих-бюджетів/',
  },
  {
    outlet: 'Рідний Київ',
    title: 'Без продюсера, без великих бюджетів, але з мрією, яка стала справою життя',
    note:  'Історія повернення в Україну та розмова про власні пісні.',
    url:   'https://kyiv.ridna.ua/2026/07/yudytska-bezprodiusera-bez-velykykh-biudzhetiv-ale-z-mriieiuiaka-stala-spravoiu-zhyttia/',
  },
  {
    outlet: 'Акценти',
    title: 'Феномен без продюсерів та мільйонів: як дівчина з Чернігівщини підкорила елітні сцени світу',
    note:  'Мальдіви, ОАЕ, Туреччина, Єгипет — і чому вона повернулася додому.',
    url:   'https://akcenty.ua/lifestyle/79590fenomen-bez-prodyuseriv-ta-milyoniv-yak-prostadivchina-z-chernigivshchini-yudytska-pidkorilaelitni-sceni-svitu-ta-chomu-vona-povernulasya-vukrajinu',
  },
  {
    outlet: 'Радіо Фреш Україна',
    title: 'YUDYTSKA — «Ідеальні вони»',
    note:  'Прем’єра синглу в радіоефірі.',
    url:   'https://rfu.in.ua/2026/07/28/yudytska-%D1%96%D0%B4%D0%B5%D0%B0%D0%BB%D1%8C%D0%BD%D1%96%D0%B2%D0%BE%D0%BD%D0%B8%D1%81%D0%B8%D0%BD%D0%B3%D0%BB-2026/',
  },
  {
    outlet: 'Love Ukraine Radio',
    title: 'YUDYTSKA презентувала сингл «Ідеальні вони» — пісню про те, що стається, коли ми припиняємо грати в ординарність',
    note:  'Рецензія на реліз і розмова про його задум.',
    url:   'https://loveukraineradio.online/yudytskaprezentuvala-syngl-idealni-vony-pisnyu-pro-teshcho-stayetsya-koly-my-prypynyayemo-hraty-vhordist/',
  },
];

export const RADIO = [
  {
    title: '«Ідеальні вони» на Love Ukraine Radio',
    note:  'Сторінка пісні в ротації станції',
    url:   'https://loveukraineradio.online/songs/yudytskaidealni-vony/',
  },
  {
    title: 'Слухати онлайн-етер',
    note:  'Пряма трансляція Love Ukraine Radio',
    url:   'https://loveukraineradio.online/',
  },
  {
    title: 'Анонс у соцмережах',
    note:  'Публікація про реліз в Instagram',
    url:   'https://www.instagram.com/p/Dap8AuARs8M/',
  },
];

export const DISCOGRAPHY = [
  {
    n: '01',
    title: 'Ідеальні вони',
    year: '2026',
    genre: 'Pop / R&B',
    cover: 'cover-idealni-vony',
    text: 'Чуттєва історія про ті моменти в стосунках, коли стає забагато шумних слів та гордості. Нагадування про те, як важливо вчасно зупинитися, відкинути образи та повернути справжню щирість. Офіційний кліп знімався в Києві.',
  },
  {
    n: '02',
    title: 'Раз у житті',
    year: '2025',
    genre: 'Балада',
    cover: 'portrait-close',
    text: 'Особлива авторська балада, написана спеціально до власного весілля. Найінтимніша пісня в доробку — про те, що трапляється раз у житті.',
  },
  {
    n: '03',
    title: 'Де ти',
    year: '2025',
    genre: 'Pop',
    cover: 'editorial-leather',
    text: 'Дебютний авторський сингл, що поклав початок сольному проєкту YUDYTSKA. Перший крок, з якого почалося все інше.',
  },
];

/* Dominant colour per image — painted behind the photo so the layout never
   flashes empty while the file downloads. Sampled from the 640px derivative. */
export const TONE = {
  'bts-camera':         '#5A5A57',
  'bts-crew':           '#746864',
  'bts-metro':          '#373333',
  'bts-monitor':        '#868786',
  'cover-idealni-vony': '#5D5C64',
  'duo-black-gold':     '#6B5547',
  'duo-daylight':       '#8A817F',
  'duo-hall':           '#5E5051',
  'editorial-leather':  '#8B8780',
  'editorial-street':   '#474D51',
  'hero-velvet':        '#2A262D',
  'live-gold-dress':    '#978A79',
  'live-piano':         '#68644F',
  'live-pink':          '#565553',
  'live-rooftop':       '#727477',
  'live-terrace':       '#414848',
  'portrait-close':     '#414140',
};

/* Intrinsic dimensions of the 1280px derivative, used for width/height
   attributes so images reserve their space and never shift the layout. */
export const DIMS = {
  'bts-camera':         [1280, 960],
  'bts-crew':           [1280, 960],
  'bts-metro':          [720, 1280],
  'bts-monitor':        [866, 1280],
  'cover-idealni-vony': [1280, 1280],
  'duo-black-gold':     [923, 1280],
  'duo-daylight':       [960, 1280],
  'duo-hall':           [1024, 1280],
  'editorial-leather':  [962, 1280],
  'editorial-street':   [960, 1280],
  'hero-velvet':        [1032, 1280],
  'live-gold-dress':    [960, 1280],
  'live-piano':         [960, 1280],
  'live-pink':          [960, 1280],
  'live-rooftop':       [699, 1280],
  'live-terrace':       [816, 1280],
  'portrait-close':     [722, 1280],
};

export const LIVE_GALLERY = [
  { slug: 'live-terrace',    caption: 'Літня тераса, Чернігів' },
  { slug: 'live-pink',       caption: 'Live-сет просто неба' },
  { slug: 'live-rooftop',    caption: 'Рooftop-виступ із саксофоном' },
  { slug: 'live-gold-dress', caption: 'Вечірня програма' },
  { slug: 'live-piano',      caption: 'Камерний формат біля роялю' },
  { slug: 'editorial-street',caption: 'Київ, зйомка кліпу' },
];

export const BTS_GALLERY = [
  { slug: 'bts-metro',   caption: 'Метро, знімальний день' },
  { slug: 'bts-monitor', caption: 'На моніторі — кадр із кліпу' },
  { slug: 'bts-camera',  caption: 'Між дублями' },
  { slug: 'bts-crew',    caption: 'Знімальна група, Київ' },
];

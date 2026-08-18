// Путь: menu-extra.js
// Достраивает меню «Правка» (инструменты), «Вид» (темы) и «Помощь» (инструкция).
// Не зависит от классов разметки меню и запускается сам при импорте.
import { uiMode, setUIModePref, setTouchPref } from './ui-mode.js';
import { HEADER_ICONS } from './ui-icons.js';

let built = false;

export function initMenuExtra() {
  if (built) return;
  built = true;
  injectStyles();
  buildMenus();
  bindHelp();
  makeTapMenus();
  iconizeHeader();
  // все выпадашки «Правка/Вид/Помощь» получают родной класс меню «Файл» —
  // фон, рамка, шрифт и hover становятся идентичными автоматически
  document.querySelectorAll('.mx-drop').forEach(d => d.classList.add('dropdown-content'));
}

function injectStyles() {
  if (document.getElementById('mx-styles')) return;
  const st = document.createElement('style');
  st.id = 'mx-styles';
  st.textContent = `
    .mx-item{ position:relative; cursor:pointer; }
    .mx-drop{ display:none; position:absolute; top:100%; left:0; min-width:230px; background:#2d2d2d; border:1px solid #444; border-radius:0 0 6px 6px; z-index:3000; box-shadow:0 8px 18px rgba(0,0,0,.5); }
    .mx-item.mx-open .mx-drop{ display:block;}
    .mx-head{ padding:4px 14px 2px; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:1px; cursor:default; white-space:nowrap; text-align:left;}
    .mx-div{ height:1px; background:#444; margin:4px 0;}
    .mx-on::before{ content:'✓ '; color:#00ff99;}
    .mx-drop div{ text-align:left; }
    .mx-ico{ display:inline-block; }
    .mx-drop, .mx-drop div{ text-align:left; }
    .mx-drop div{ padding:8px 14px; }
    .mx-item.mx-open .mx-drop{ display:block; }
    .mx-ico svg{ width:18px; height:18px; fill:currentColor; vertical-align:-3px; }
    .header-panel .mx-txt{ display:none; }
    .header-panel .mx-item{ position:relative; }
    .logo{ font-size:13px; letter-spacing:0; }
    .logo .mx-ico svg{ width:16px; height:16px; }
    .logo-txt{ color:#00ff99; font-weight:bold; }
    body[data-ui="phone"] .header-panel{ gap:6px; padding:0 8px; }
    body[data-ui="phone"] .menu-btn{ padding:9px 10px; }
    .mx-item.mx-open .mx-drop{ display:block; }
  `;
  document.head.appendChild(st);
}

// ---------- поиск пунктов меню по их собственному тексту ----------
function ownText(el) {
  let s = '';
  for (const n of el.childNodes) if (n.nodeType === 3) s += n.textContent;
  return s.trim();
}

function findByOwnText(label) {
  let best = null;
  document.querySelectorAll('body *').forEach(el => {
    const own = ownText(el);
    if (own === label || (own.startsWith(label) && own.length < label.length + 12)) {
      if (!best || el.textContent.length <= best.textContent.length) best = el;
    }
  });
  return best;
}

function ensureDrop(item) {
  item.classList.add('mx-item');
  item.style.position = 'relative';
  let drop = item.querySelector('.mx-drop');
  if (!drop) {
    // переиспользуем старый выпадающий блок любой классности
    drop = Array.from(item.children).find(c => c.tagName === 'DIV') || null;
    if (drop) drop.className = 'mx-drop';
  }
  if (!drop) {
    drop = document.createElement('div');
    drop.className = 'mx-drop';
    item.appendChild(drop);
  }
  return drop;
}

function buildMenus() {
  const edit = findByOwnText('Правка');
  if (edit) {
    ensureDrop(edit).innerHTML = `
      <div data-tool-goto="rotate">Поворот</div>
      <div data-tool-goto="size">Размер</div>
      <div data-tool-goto="perspective">Перспектива</div>
      <div data-tool-goto="grid">Решётка</div>
      <div data-tool-goto="crop">Обрезка</div>
      <div data-tool-goto="color">Цвет</div>
      <div data-tool-goto="marker">Маркер</div>`;
    bindTools();
    iconize(edit, 'edit');
  }



  const view = findByOwnText('Вид');
  if (view) {
    ensureDrop(view).innerHTML = `
      <div class="mx-head">Тема</div>
      <div id="menu-theme-light">Светлая</div>
      <div id="menu-theme-dark">Тёмная</div>
      <div class="mx-div"></div>
      <div class="mx-head">Устройство</div>
      <div data-ui-mode="auto">Авто</div>
      <div data-ui-mode="desktop">ПК</div>
      <div data-ui-mode="tablet">Планшет</div>
      <div data-ui-mode="phone">Смартфон</div>
      <div class="mx-div"></div>
      <div class="mx-head">Сенсор</div>
      <div id="menu-touch-toggle">Сенсор: —</div>`;
    bindThemes();
    bindUIMode();
    iconize(view, 'view');
  }

  if (!document.getElementById('menu-help-item')) {
    const help = document.createElement('div');
    help.id = 'menu-help-item';
    help.className = 'menu-btn mx-item'; // те же классы, что у «Файл» — единый шрифт и отступы
    help.innerHTML = `<div class="mx-drop"><div id="menu-help">Инструкция по использованию</div></div>`;
    view.insertAdjacentElement('afterend', help);
    iconize(help, 'help', 'Помощь');
  }
}

// ---------- Правка: быстрый переход к инструменту ----------
function bindTools() {
  document.querySelectorAll('[data-tool-goto]').forEach(el => {
    el.addEventListener('click', () => {
      const btn = document.querySelector(`.tool-btn[data-tool="${el.getAttribute('data-tool-goto')}"]`);
      if (btn) btn.click();
    });
  });
}

// ---------- Вид: темы ----------
function bindThemes() {
  document.getElementById('menu-theme-light')?.addEventListener('click', () => {
    document.body.classList.add('light-theme'); // стили светлой темы добавим позже
    setStatus('Светлая тема — в разработке: каркас переключения уже работает.');
    refreshViewMarks();
  });
  document.getElementById('menu-theme-dark')?.addEventListener('click', () => {
    document.body.classList.remove('light-theme');
    setStatus('Тёмная тема активна.');
    refreshViewMarks();
  });
}

//---------- Вид: устройство и сенсор ----------
function bindUIMode() {
  document.querySelectorAll('[data-ui-mode]').forEach(el => {
    el.addEventListener('click', () => {
      setUIModePref(el.getAttribute('data-ui-mode'));
      refreshViewMarks();
      setStatus('Вид: интерфейс — ' + el.innerText + '.');
    });
  });
  document.getElementById('menu-touch-toggle')?.addEventListener('click', () => {
    setTouchPref(uiMode.touch ? 'off' : 'on');
    refreshViewMarks();
    setStatus(uiMode.touch ? 'Вид: сенсор включён.' : 'Вид: сенсор выключен.');
  });
  refreshViewMarks();
}

function refreshViewMarks() {
  document.querySelectorAll('[data-ui-mode]').forEach(el => {
    el.classList.toggle('mx-on', el.getAttribute('data-ui-mode') === uiMode.prefMode);
  });
  const t = document.getElementById('menu-touch-toggle');
  if (t) {
    t.innerText = uiMode.touch ? 'Сенсор: есть' : 'Сенсор: нет';
    t.classList.toggle('mx-on', uiMode.touch);
  }
  const light = document.body.classList.contains('light-theme');
  document.getElementById('menu-theme-light')?.classList.toggle('mx-on', light);
  document.getElementById('menu-theme-dark')?.classList.toggle('mx-on', !light);
}

// Меню открываются ТАПОМ; открытие одного закрывает ВСЕ остальные (включая «Файл»)
function makeTapMenus() {
  const tops = Array.from(document.querySelectorAll('.mx-item'));
  const closeFileDrop = () => {
    const fd = document.getElementById('file-dropdown');
    if (fd) fd.style.display = 'none';
  };
  tops.forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.mx-drop')) return;
      const wasOpen = item.classList.contains('mx-open');
      tops.forEach(t => t.classList.remove('mx-open'));
      closeFileDrop();
      if (!wasOpen) { refreshViewMarks(); item.classList.add('mx-open'); }
      e.stopPropagation();
    });
    item.querySelector('.mx-drop')?.addEventListener('click', (e) => {
      if (e.target.closest('div:not(.mx-head):not(.mx-div)')) item.classList.remove('mx-open');
    });
  });
  document.addEventListener('click', () => tops.forEach(t => t.classList.remove('mx-open')));
}

// ---------- Помощь: окно с инструкцией ----------
function bindHelp() {
  if (!document.getElementById('help-overlay')) {
    const ov = document.createElement('div');
    ov.id = 'help-overlay';
    ov.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:2000; align-items:center; justify-content:center;';
    ov.innerHTML = `
      <div style="width:min(780px, 94vw); max-height:88vh; overflow:auto; background:#252525; border:1px solid #00ff99; border-radius:10px; padding:20px 26px; color:#eee; font-size:13px; line-height:1.55;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:10px;">
          <div style="font-size:18px; font-weight:bold; color:#00ff99;">Инструкция по использованию редактора</div>
          <button id="help-close" style="background:#3c3c3c; border:1px solid #555; color:#fff; border-radius:6px; padding:5px 12px; cursor:pointer; flex:0 0 auto;">Закрыть ✕</button>
        </div>
        ${HELP_TEXT}
      </div>`;
    document.body.appendChild(ov);
  }

  document.getElementById('menu-help')?.addEventListener('click', () => {
    const ov = document.getElementById('help-overlay');
    if (ov) ov.style.display = 'flex';
  });
  document.getElementById('help-close')?.addEventListener('click', () => {
    const ov = document.getElementById('help-overlay');
    if (ov) ov.style.display = 'none';
  });
  document.getElementById('help-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });
}

// Текст кнопки заворачиваем в .mx-txt, перед ним вставляем .mx-ico.
// Выпадашка (.mx-drop) остаётся нетронутой — убираем только текстовые узлы.
function iconize(btn, key, label) {
  if (!btn || btn.dataset.iconized) return;
  btn.dataset.iconized = '1';
  const txt = label || ownText(btn).trim();
  if (!btn.title) btn.title = txt;
  for (const n of Array.from(btn.childNodes)) if (n.nodeType === 3) btn.removeChild(n);
  const ico = document.createElement('span');
  ico.className = 'mx-ico';
  ico.innerHTML = HEADER_ICONS[key];
  const t = document.createElement('span');
  t.className = 'mx-txt';
  t.textContent = txt;
  btn.prepend(ico, t);
}

function iconizeHeader() {
  iconize(document.getElementById('file-menu-btn'), 'file');
  const logo = document.querySelector('.logo');
  if (logo && !logo.dataset.iconized) {
    logo.dataset.iconized = '1';
    const t = logo.textContent.trim();
    logo.textContent = '';
    const ico = document.createElement('span'); ico.className = 'mx-ico'; ico.innerHTML = HEADER_ICONS.logo;
    const tx = document.createElement('span'); tx.className = 'logo-txt'; tx.textContent = 'SuDOCX';
    logo.append(ico, tx);
  }
}

function setStatus(text) {
  const el = document.getElementById('status-message');
  if (el) el.innerText = text;
}

// ---------- текст инструкции ----------
const HELP_TEXT = `
<h3 style="color:#00ff99; margin:14px 0 6px;">Общие принципы</h3>
<ul style="margin:0 0 10px 18px; padding:0;">
  <li>Загрузите фото кнопкой «Выбрать файл изображения» или «Файл → Открыть».</li>
  <li>Колесо мыши — масштаб к курсору. Кнопки сверху: «−»/«+» — зум, «1:1» — пиксель в пиксель, «100%» — вписать документ вместе с рамкой выравнивания в окно.</li>
  <li>Перемещение картинки: <b>средняя кнопка мыши</b> или <b>Space + ЛКМ</b> — в любом инструменте; ЛКМ — в инструментах без рисования.</li>
  <li>Верх панели свойств — глобальные настройки для всех инструментов: направляющая рамка (видимость, портрет/ландшафт, «Оригинал/А4»), размер маркеров, якоря и линии строк.</li>
  <li>Синие якоря и векторы показывают исходное положение маркеров до ваших смещений; красные линии — направляющие по строкам.</li>
  <li>Каждый инструмент правит неразрушающе: результат виден сразу, но вшивается в документ только кнопкой «Применить». «Сброс» отменяет правки инструмента.</li>
</ul>

<h3 style="color:#00ff99; margin:14px 0 6px;">Файл</h3>
<ul style="margin:0 0 10px 18px; padding:0;">
  <li>«Открыть» — загрузка нового фото; «Очистить редактор» — полный сброс холста.</li>
</ul>

<h3 style="color:#00ff99; margin:14px 0 6px;">Правка → инструменты</h3>
<ul style="margin:0 0 10px 18px; padding:0;">
  <li><b>Поворот.</b> Кнопки −90°/180°/+90° и ползунок точной подгонки наклона строк (−45…+45°). «Применить» фиксирует поворот в пиксели.</li>
  <li><b>Размер.</b> Пресеты или точный размер в px; пунктирная рамка на холсте — превью нового размера. Алгоритмы: ступенчатый (смартфон), билинейный, Ланцош (макс. качество). «Применить» меняет размер документа.</li>
  <li><b>Перспектива.</b> В режиме настройки расставьте маркеры по углам искажённого листа (рамку можно тянуть за стороны), затем «Режим: Живое Искажение» для предпросмотра и «Применить» — документ выпрямится.</li>
  <li><b>Решётка.</b> «Задать решётку (Мышью)» — выделите область; тяните зелёные маркеры, чтобы гнуть бумагу. «Смещение границ» расширяет зону эффекта за выделение, «Радиус сглаживания» — мягкость краёв. Типы деформации: Прямоугольник / Радиус от маркера / Лист (TPS). «Применить» запекает изгиб.</li>
  <li><b>Обрезка.</b> Рамка с ручками: тяните стороны и углы, значения дублируются в полях. «Применить» обрезает документ.</li>
  <li><b>Цвет.</b> Пять независимых слоёв, накладываются друг на друга: 1) выравнивание освещённости, 2) Улучшенный OCR (ЧБ), 3) оттенки серого, 4) яркость/контраст/гамма, 5) ретушь-кисть. «Без эффектов» — сравнение до/после; «Применить» запекает и выключает все слои (новый цикл); «Сброс» возвращает исходное.</li>
  <li><b>Маркер.</b> «Замазывание (Цензор)»: чёрный/серый/белый или «фон рядом» — умная ретушь, растворяющая текст в бумаге. «Выделение»: 12 неоновых цветов, текст остаётся читаемым (multiply). Формы кисти: круг / вертикальный прямоугольник / квадрат. «Связанные линии» — два клика дают идеально ровную линию (режим одноразовый; Shift — разово при выключенном). «Показать без штрихов» — сравнение. ЛКМ рисует; средняя кнопка / Space / тумблер «ЛКМ: двигает» — панорамирование.</li>
</ul>

<h3 style="color:#00ff99; margin:14px 0 6px;">Вид</h3>
<ul style="margin:0 0 10px 18px; padding:0;">
  <li>«Тёмный» / «Светлый» — переключение темы (светлая в разработке, каркас уже работает).</li>
</ul>

<h3 style="color:#00ff99; margin:14px 0 6px;">Экспорт</h3>
<ul style="margin:0 0 10px 18px; padding:0;">
  <li>Вкладка «Экспорт» → «Сохранить» — выгрузка результата в JPG. Перед сохранением нажмите «Применить» во всех инструментах, где были правки: незапечённые эффекты в файл не попадают.</li>
</ul>

<h3 style="color:#00ff99; margin:14px 0 6px;">Горячие клавиши и жесты</h3>
<ul style="margin:0 0 10px 18px; padding:0;">
  <li>Space + ЛКМ или средняя кнопка мыши — панорамирование в любом инструменте.</li>
  <li>Колесо мыши — зум к курсору.</li>
  <li>Shift + клик в «Маркере» — разовая связанная линия; Escape — отменить ожидающую точку.</li>
</ul>
`;

// автозапуск: достаточно строки import в editor.js
initMenuExtra();

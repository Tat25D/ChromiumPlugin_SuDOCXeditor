// Путь: tool-file.js
// Имя сохранения + конструктор шаблона имени (порядок частей фиксирован).

let loadedBaseName = '';
let lastLeaf = 0;
let lastPage = 0;

export function initFileTool() {
  ['file-part-vol', 'file-part-leaf', 'file-part-page', 'file-part-title', 'file-part-date', 'file-part-note']
    .forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        updatePreview();
      });
    });

  document.getElementById('file-assemble')?.addEventListener('click', () => {
    const name = buildName();
    if (!name) return;
    const inp = document.getElementById('file-save-name');
    if (inp) inp.value = name;
  });

  document.getElementById('file-name-reset')?.addEventListener('click', () => {
    const inp = document.getElementById('file-save-name');
    if (inp) inp.value = loadedBaseName;
  });

  buildQuickButtons();
  updatePreview();
}

// Вызывается editor.js при загрузке фото: имя = имя файла без расширения
export function setDefaultFileName(name) {
  loadedBaseName = (name || '').replace(/\.[^.]+$/, '');
  const inp = document.getElementById('file-save-name');
  if (inp) inp.value = loadedBaseName;
}

export function getSaveFileName() {
  const inp = document.getElementById('file-save-name');
  return inp && inp.value.trim() ? inp.value.trim() : '';
}

// Вызывается tool-export.js после сохранения: запоминаем номера для подсказок
export function rememberSavedNumbers() {
  const leaf = parseInt(document.getElementById('file-part-leaf')?.value) || 0;
  const page = parseInt(document.getElementById('file-part-page')?.value) || 0;
  if (leaf > 0) lastLeaf = leaf;
  if (page > 0) lastPage = page;
  buildQuickButtons();
}

// Том1 Л102 Стр2 Название 2026.07.10 Пометка
function buildName() {
  const parts = [];
  const vol = val('file-part-vol');   if (vol)   parts.push('Том' + vol);
  const leaf = val('file-part-leaf'); if (leaf)  parts.push('Л' + leaf);
  const page = val('file-part-page'); if (page)  parts.push('Стр' + page);
  const title = val('file-part-title'); if (title) parts.push(title);
  const date = val('file-part-date');   if (date)  parts.push(date);
  const note = val('file-part-note');   if (note)  parts.push(note);
  return parts.join(' ');
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function updatePreview() {
  const el = document.getElementById('file-preview');
  if (el) el.innerText = buildName() || '—';
}

// Кнопки с наиболее вероятными номерами листа и страницы
function buildQuickButtons() {
  const leafBox = document.getElementById('file-leaf-quick');
  if (leafBox) {
    const cur = parseInt(val('file-part-leaf')) || 0;
    const base = lastLeaf || cur || 1;
    leafBox.innerHTML = '';
    [base, base + 1, base + 2].forEach(n => leafBox.appendChild(quickBtn(n, 'file-part-leaf')));
  }
  const pageBox = document.getElementById('file-page-quick');
  if (pageBox) {
    const cur = parseInt(val('file-part-page')) || 0;
    const opts = [];
    [lastPage, lastPage + 1, cur, cur + 1, 1, 2].forEach(n => {
      if (n > 0 && !opts.includes(n)) opts.push(n);
    });
    pageBox.innerHTML = '';
    opts.slice(0, 4).forEach(n => pageBox.appendChild(quickBtn(n, 'file-part-page')));
  }
}

function quickBtn(n, targetId) {
  const b = document.createElement('button');
  b.innerText = String(n);
  b.title = 'Подставить ' + n;
  b.style.cssText = 'padding:4px 9px; background:#3c3c3c; border:1px solid #555; color:#fff; border-radius:4px; cursor:pointer;';
  b.addEventListener('click', () => {
    const inp = document.getElementById(targetId);
    if (inp) { inp.value = n; updatePreview(); }
  });
  return b;
}

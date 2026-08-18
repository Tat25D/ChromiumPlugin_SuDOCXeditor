import { state, centerImage } from './state.js';
import { drawScene } from './renderer.js';
import { initCamera } from './camera.js';
import { initRotateTool, resetRotateSettings } from './tool-rotate.js';
import { initSizeTool, updateSizeInterface } from './tool-size.js';
import { initPerspectiveTool, updatePerspectiveInterface } from './tool-perspective.js';
import { initCropTool, updateCropInterface } from './tool-crop.js';
import { initFileTool, setDefaultFileName } from './tool-file.js';
import { initExportTool } from './tool-export.js';

// Подключаем новые зарезервированные модули
import { initGridTool, resetGridToolState } from './tool-grid.js';
import { initColorTool } from './tool-color.js';
import { initMarkerTool, resetMarkerToolState } from './tool-marker.js';
import { initGlobalUI, setGlobalFileInfo } from './global-ui.js';
import { initMenuExtra } from './menu-extra.js';
import { uiMode } from './ui-mode.js';
import { loadPartials } from './ui-loader.js';
await loadPartials(); // модули поддерживают top-level await

const workspace = document.getElementById('workspace');
const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const uploadInput = document.getElementById('upload-input');

const fileMenuBtn = document.getElementById('file-menu-btn');
const fileDropdown = document.getElementById('file-dropdown');
const menuOpen = document.getElementById('menu-open-btn');
const menuClear = document.getElementById('menu-clear-btn');
const menuExport = document.getElementById('menu-export-btn');

const infoName = document.getElementById('info-file-name');
const infoSize = document.getElementById('info-file-size');
const infoW = document.getElementById('info-file-w');
const infoH = document.getElementById('info-file-h');
const infoOrient = document.getElementById('info-file-orient');
const mainOpenBtn = document.getElementById('main-open-file-btn');

const statusMsg = document.getElementById('status-message');
const statusZoom = document.getElementById('status-zoom');
const toolNameDisplay = document.getElementById('current-tool-name');

const panels = {
  open: document.getElementById('open-controls'),
  rotate: document.getElementById('rotate-controls'),
  size: document.getElementById('size-controls'),
  perspective: document.getElementById('perspective-controls'),
  grid: document.getElementById('grid-controls'), // Подключено в диспетчер свойств
  crop: document.getElementById('crop-controls'),
  color: document.getElementById('color-controls'), // Подключено в диспетчер свойств
  marker: document.getElementById('marker-controls'), // Подключено в диспетчер свойств
  export: document.getElementById('export-controls'),
  file: document.getElementById('file-controls'),
};

state.render = () => drawScene(ctx, canvas);

initCamera(workspace, canvas, statusZoom, document.getElementById('status-coords'));
initRotateTool();
initSizeTool();
initPerspectiveTool();
initGridTool(); // Запуск
initCropTool();
initColorTool(); // Запуск
initMarkerTool(); // Запуск
  initFileTool();
initExportTool();
initGlobalUI();
initMenuExtra();

fileMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  // открытие «Файл» закрывает меню «Правка/Вид/Помощь»
  document.querySelectorAll('.mx-item.mx-open').forEach(t => t.classList.remove('mx-open'));
  fileDropdown.style.display = (fileDropdown.style.display === 'block') ? 'none' : 'block';
  fileMenuBtn.classList.toggle('active');
});

window.addEventListener('click', () => {
  fileDropdown.style.display = 'none';
  fileMenuBtn.classList.remove('active');
});

menuOpen.addEventListener('click', () => {
  uploadInput.value = '';
  uploadInput.click();
});

menuExport.addEventListener('click', () => {
  document.getElementById('download-btn')?.click();
});

menuClear.addEventListener('click', () => {
  state.img = null;
  state.originalImg = null;
  state.originalWidth = 0;
  state.originalHeight = 0;
  setGlobalFileInfo(null);
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  uploadInput.value = '';

  infoName.innerText = '-- Нет файла --';
  infoSize.innerText = '--';
  infoW.innerText = '0 px';
  infoH.innerText = '0 px';
  infoOrient.innerText = '--';

  statusMsg.innerText = 'Редактор очищен. Загрузите новое изображение.';
  statusZoom.innerText = 'Зум: 100%';

  document.querySelector('.tool-btn[data-tool="open"]')?.click();
  state.render();
});

mainOpenBtn.addEventListener('click', () => {
  uploadInput.value = '';
  uploadInput.click();
});

document.getElementById('main-clear-file-btn')?.addEventListener('click', () => {
  menuClear.click();
});

function updateWorkspaceBounds() {
  state.workspaceWidth = workspace.clientWidth;
  state.workspaceHeight = workspace.clientHeight;
  canvas.width = state.workspaceWidth;
  canvas.height = state.workspaceHeight;
}

window.addEventListener('resize', () => {
  updateWorkspaceBounds();
  state.render();
});
updateWorkspaceBounds();

// --- ИСПРАВЛЕННЫЙ СЛУШАТЕЛЬ ДЛЯ ЗАГРУЗКИ / ПЕРЕЗАПИСИ ФАЙЛА ---
uploadInput.addEventListener('change', (e) => {
  const filesList = e.target.files;
  if (!filesList || filesList.length === 0) return;

  // Берем строго первый файл из массива FileList[0]
  const file = filesList[0];

  statusMsg.innerText = `Загрузка файла: ${file.name}...`;

  // Вычисляем системную информацию о файле
  const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
  infoName.innerText = file.name;
  infoSize.innerText = `${sizeInMB} Мб`;

  // Теперь сюда передается валидный объект File, и браузер больше не упадет
  const objectURL = URL.createObjectURL(file);
  const newImg = new Image();
  newImg.onload = () => {
    state.img = newImg;
    state.originalWidth = newImg.width;
    state.originalHeight = newImg.height;
    setGlobalFileInfo(file.name, newImg.width, newImg.height);

    setDefaultFileName(file.name);

    infoW.innerText = `${newImg.width} px`;
    infoH.innerText = `${newImg.height} px`;
    infoOrient.innerText = (newImg.width >= newImg.height) ? 'Ландшафтная (Альбом)' : 'Портретная (Книжная)';

    resetRotateSettings();
    updateWorkspaceBounds();
    centerImage();

    updateSizeInterface();
    updateCropInterface();
    updatePerspectiveInterface();

    statusMsg.innerText = `Изображение успешно загружено: ${file.name}`;
    statusZoom.innerText = `Зум: ${Math.round(state.zoom * 100)}%`;

    document.querySelector('.tool-btn[data-tool="open"]')?.click();
    state.render();
    URL.revokeObjectURL(objectURL);
  };
  newImg.src = objectURL;
});

// --- ИСПРАВЛЕННЫЙ ДИСПЕТЧЕР: АВТОМАТИЧЕСКИЙ СБРОС ПРИ СМЕНЕ ВКЛАДОК ---
const toolButtons = document.querySelectorAll('.tool-btn');
toolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    // Уход с инструмента = кнопка «Сброс»: всё НЕприменённое обнуляется.
    // Запечённое «Применить» остаётся, т.к. Apply обновил originalCanvas.
    const activeToolBefore = document.querySelector('.tool-btn.active')?.getAttribute('data-tool');
    const RESET_BTN = {
      rotate: 'reset-rotate-btn',
      size: 'reset-size-btn',
      perspective: 'reset-perspective-btn',
      grid: 'reset-grid-btn',
      crop: 'reset-crop-btn',
      color: 'reset-color-btn',
      marker: 'reset-marker-btn'
    };
    const resetId = RESET_BTN[activeToolBefore];
    if (resetId) document.getElementById(resetId)?.click();

    toolButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const toolType = btn.getAttribute('data-tool');
    toolNameDisplay.innerText = btn.innerText.trim();
    statusMsg.innerText = `Выбран инструмент: ${btn.innerText.trim()}`;

    // Перезаписываем опорный снимок истории для нового инструмента
    if (state.img) {
      const backupCanvas = document.createElement('canvas');
      backupCanvas.width = state.img.width;
      backupCanvas.height = state.img.height;
      backupCanvas.getContext('2d').drawImage(state.img, 0, 0);
      state.originalCanvas = backupCanvas;
    }

    for (const key in panels) {
      if (panels[key]) {
        panels[key].style.display = (key === toolType) ? 'flex' : 'none';
      }
    }

    // Страховка: если маркерная панель в HTML задублирована (два id="marker-controls")
    // или лежит вне контейнера с известным id — прячем все копии принудительно
    document.querySelectorAll('[id="marker-controls"]').forEach(el => {
      el.style.display = (toolType === 'marker') ? 'flex' : 'none';
    });

    if (toolType === 'size') updateSizeInterface();
    if (toolType === 'perspective') updatePerspectiveInterface();
    if (toolType === 'crop') updateCropInterface();
    if (toolType !== 'grid') resetGridToolState();
    if (toolType !== 'marker') resetMarkerToolState(); // уход без «Применить» — штрихи обнуляются

    state.render();
  });
});

// Путь: tool-size.js
import { state, centerImage } from './state.js';
import { scaleStepUp, scaleLanczos } from './size/size-math.js';

// ВАЖНО: панель живёт в партиале size/size.html и появляется ПОЗЖЕ оценки модуля,
// поэтому ссылки на элементы берём только внутри initSizeTool()
let widthInput = null, heightInput = null, lockBtn = null, currentDisplay = null, algoSelect = null;

let isLocked = true;
let ratio = 1;

export function initSizeTool() {
  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      isLocked = !isLocked;
      lockBtn.innerText = isLocked ? '🔒' : '';
      lockBtn.style.background = isLocked ? '#00ff99' : '#3c3c3c';
      lockBtn.style.color = isLocked ? '#1e1e1e' : '#fff';
    });
  }

  widthInput = document.getElementById('size-width');
  heightInput = document.getElementById('size-height');
  lockBtn = document.getElementById('size-lock');
  currentDisplay = document.getElementById('size-current-value');
  algoSelect = document.getElementById('size-algorithm-select');

  widthInput?.addEventListener('input', () => {
    if (isLocked && state.img) {
      heightInput.value = Math.round(widthInput.value / ratio);
    }
    if (state.render) state.render(); // живое превью рамки нового размера
  });

  heightInput?.addEventListener('input', () => {
    if (isLocked && state.img) {
      widthInput.value = Math.round(heightInput.value * ratio);
    }
    if (state.render) state.render(); // живое превью рамки нового размера
  });

  // Пресеты размеров
  document.getElementById('preset-mobile')?.addEventListener('click', () => setPreset(1200));
  document.getElementById('preset-desktop')?.addEventListener('click', () => setPreset(2000));
  document.getElementById('preset-ai')?.addEventListener('click', () => setPreset(3500));

  document.getElementById('apply-size-btn')?.addEventListener('click', () => {
    if (!state.img) return;
    bakeSize();
  });

  // СБРОС: мгновенный, синхронный, БЕЗ JPEG-потерь
  document.getElementById('reset-size-btn')?.addEventListener('click', () => {
    if (!state.originalCanvas) return;
    state.img = copyCanvas(state.originalCanvas);
    updateSizeInterface(); // Возвращаем цифры в полях ввода под старый размер
    state.render();
  });
}

function setPreset(targetLongSide) {
  if (!state.img) return;
  if (state.img.width >= state.img.height) {
    widthInput.value = targetLongSide;
    heightInput.value = Math.round(targetLongSide / ratio);
  } else {
    heightInput.value = targetLongSide;
    widthInput.value = Math.round(targetLongSide * ratio);
  }
  if (state.render) state.render(); // превью рамки после пресета
}

export function updateSizeInterface() {
  if (!state.img || !widthInput) return;
  ratio = state.img.width / state.img.height;
  widthInput.value = state.img.width;
  heightInput.value = state.img.height;
  if (currentDisplay) {
    currentDisplay.innerText = `${state.img.width} x ${state.img.height} px`;
  }
}

function bakeSize() {
  const targetW = parseInt(widthInput.value) || state.img.width;
  const targetH = parseInt(heightInput.value) || state.img.height;

  const algo = algoSelect ? algoSelect.value : 'stepup';
  let processedCanvas;

  // Диспетчеризация по выбранному алгоритму
  if (algo === 'lanczos') {
    processedCanvas = scaleLanczos(state.img, targetW, targetH);
  } else if (algo === 'stepup') {
    processedCanvas = scaleStepUp(state.img, targetW, targetH);
  } else {
    // Дефолтный билинейный Canvas проход
    processedCanvas = document.createElement('canvas');
    processedCanvas.width = targetW; processedCanvas.height = targetH;
    const ctx = processedCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.img, 0, 0, targetW, targetH);
  }

  // LOSSLESS: результирующий холст становится документом напрямую (без JPEG)
  state.img = processedCanvas;
  updateSizeInterface();
  centerImage();

  const statusMsg = document.getElementById('status-message');
  if (statusMsg) statusMsg.innerText = `Размер: запечено ${targetW}x${targetH} px (алгоритм "${algo}", без потерь).`;
  state.render();
}

function copyCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

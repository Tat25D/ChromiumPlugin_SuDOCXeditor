// Путь: tool-rotate.js
import { state } from './state.js';

export function initRotateTool() {
  // Шаговые развороты документа по кнопкам (-90, 180, +90)
  document.getElementById('rot-left')?.addEventListener('click', () => {
    if (!state.img) return;
    state.rotateStepAngle = (state.rotateStepAngle - 90) % 360;
    state.render();
  });

  document.getElementById('rot-right')?.addEventListener('click', () => {
    if (!state.img) return;
    state.rotateStepAngle = (state.rotateStepAngle + 90) % 360;
    state.render();
  });

  document.getElementById('rot-half')?.addEventListener('click', () => {
    if (!state.img) return;
    state.rotateStepAngle = (state.rotateStepAngle + 180) % 360;
    state.render();
  });

  // Ползунок точной подгонки угла наклона текстовых строк
  document.getElementById('fine-tune-angle')?.addEventListener('input', (e) => {
    if (!state.img) return;
    state.fineTuneAngle = parseFloat(e.target.value) || 0;
    const displayEl = document.getElementById('angle-value');
    if (displayEl) displayEl.innerText = `${state.fineTuneAngle}°`;
    state.render();
  });

  // Кнопка Применить — окончательно фиксирует поворот бланка в пиксели
  document.getElementById('apply-rotate-btn')?.addEventListener('click', () => {
    if (!state.img) return;
    bakeRotate();
  });

  // СБРОС: стирает пиксели и обнуляет угол; lossless, синхронно
  document.getElementById('reset-rotate-btn')?.addEventListener('click', () => {
    if (!state.originalCanvas) return;

    const sliderEl = document.getElementById('fine-tune-angle');
    const displayEl = document.getElementById('angle-value');
    if (sliderEl) sliderEl.value = 0;
    if (displayEl) displayEl.innerText = '0°';

    state.rotateStepAngle = 0;
    state.fineTuneAngle = 0;

    // Синхронно восстанавливаем пиксели из буфера БЕЗ JPEG-потерь
    state.img = copyCanvas(state.originalCanvas);
    state.render();
  });
}

// Принудительный сброс настроек при загрузке совершенно нового файла
export function resetRotateSettings() {
  state.rotateStepAngle = 0;
  state.fineTuneAngle = 0;
  const sliderEl = document.getElementById('fine-tune-angle');
  const displayEl = document.getElementById('angle-value');
  if (sliderEl) sliderEl.value = 0;
  if (displayEl) displayEl.innerText = '0°';
}

export function applyRotateTransform(ctx) {
  const totalAngle = ((state.rotateStepAngle || 0) + (state.fineTuneAngle || 0)) * Math.PI / 180;
  if (totalAngle !== 0) {
    ctx.rotate(totalAngle);
  }
}

function bakeRotate() {
  const totalAngle = ((state.rotateStepAngle || 0) + (state.fineTuneAngle || 0)) * Math.PI / 180;
  if (totalAngle === 0) return;

  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  const absCos = Math.abs(Math.cos(totalAngle));
  const absSin = Math.abs(Math.sin(totalAngle));
  const newW = Math.round(state.img.width * absCos + state.img.height * absSin);
  const newH = Math.round(state.img.width * absSin + state.img.height * absCos);

  tempCanvas.width = newW;
  tempCanvas.height = newH;

  tempCtx.translate(newW / 2, newH / 2);
  tempCtx.rotate(totalAngle);
  tempCtx.drawImage(state.img, -state.img.width / 2, -state.img.height / 2);

  // LOSSLESS: запечённый холст становится документом напрямую (без JPEG)
  state.img = tempCanvas;

  // Новая опорная точка для кнопки «Сброс»
  const newBackupCanvas = document.createElement('canvas');
  newBackupCanvas.width = tempCanvas.width;
  newBackupCanvas.height = tempCanvas.height;
  newBackupCanvas.getContext('2d').drawImage(tempCanvas, 0, 0);
  state.originalCanvas = newBackupCanvas;

  resetRotateSettings();
  state.render();
}

function copyCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

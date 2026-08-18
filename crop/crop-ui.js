import { state } from '../state.js';
import { cropState, cropFlags } from './crop-state.js';
import { invalidateMargin, getMarginCanvas, updateCropInterface, clearBaseCache } from './crop-margins.js';
import { cropFillState, resetFillStroke } from './crop-fill.js';

let rafPending = false;

export function initCropTool() {
  document.getElementById('crop-extend-toggle')?.addEventListener('click', () => {
    cropState.extend = !cropState.extend;
    if (!cropState.extend && state.img) {
      cropState.x1 = Math.max(0, cropState.x1);
      cropState.y1 = Math.max(0, cropState.y1);
      cropState.x2 = Math.min(state.img.width, cropState.x2);
      cropState.y2 = Math.min(state.img.height, cropState.y2);
    }

    document.getElementById('crop-fill-toggle')?.addEventListener('click', () => {
      cropFillState.enabled = !cropFillState.enabled;
      resetFillStroke();
      updateFillModeUI();
      requestRender();
    });

    document.getElementById('crop-fill-mode')?.addEventListener('change', (e) => {
      cropFillState.mode = e.target.value;
      resetFillStroke();
      updateFillModeUI();
      requestRender();
    });



    updateExtendUI();
    invalidateMargin();
    requestRender();
  });

  document.querySelectorAll('.crop-fswatch').forEach(b => {
    b.addEventListener('click', () => {
      cropState.fillColor = b.getAttribute('data-fcolor');
      updateFSwatchUI();
      updateFillUI();
      invalidateMargin();
      requestRender();
    });
  });

  bindSlider('crop-bg-threshold', 'crop-bg-threshold-value', v => { cropState.bgThreshold = v; }, v => `${v}`);
  bindSlider('crop-grad', 'crop-grad-value', v => { cropState.gradStrength = v; }, v => `${v} %`);
  bindSlider('crop-fill-opacity', 'crop-fill-opacity-value', v => { cropState.fillOpacity = v; }, v => `${v} %`);
  bindSlider('crop-tone', 'crop-tone-value', v => { cropState.tone = v; }, v => `${v}`);
  bindSlider('crop-clean', 'crop-clean-value', v => { cropState.clean = v; }, v => `${v} %`);
  bindSlider('crop-overlap', 'crop-overlap-value', v => { cropState.overlap = v; }, v => `${v} px`);

  // в эконом-режиме поля пересчитываются по отпускании мыши
  window.addEventListener('mouseup', () => {
    if (!cropFlags.interactive) { invalidateMargin(); requestRender(); }
  });

  document.getElementById('apply-crop-btn')?.addEventListener('click', () => bakeCrop());

  document.getElementById('reset-crop-btn')?.addEventListener('click', () => {
    if (!state.originalCanvas) return;
    state.img = copyCanvas(state.originalCanvas);
    clearBaseCache();
    updateCropInterface();
    setStatus('Обрезка: сброшено к исходному состоянию.');
    requestRender();
  });

  updateExtendUI();
  updateFSwatchUI();
  updateFillUI();
  syncCropUI();
  updateFillModeUI();
}

function updateFillModeUI() {
  const b = document.getElementById('crop-fill-toggle');
  if (b) {
    if (cropFillState.enabled) {
      b.innerText = 'Режим заливки: Включен';
      b.style.background = '#ff9900'; b.style.borderColor = '#ff9900'; b.style.color = '#1e1e1e';
    } else {
      b.innerText = 'Режим заливки: Выкл';
      b.style.background = '#3c3c3c'; b.style.borderColor = '#555'; b.style.color = '#fff';
    }
  }
  const h = document.getElementById('crop-fill-hint');
  if (h) {
    if (!cropFillState.enabled) h.innerText = 'Включите режим и выберите тип выделения. Цвет берётся из палитры «Заливка полей».';
    else if (cropFillState.mode === 'edge') h.innerText = 'Край: две точки линии. Зальётся сторона, обращённая ОТ центра листа.';
    else if (cropFillState.mode === 'poly') h.innerText = 'Ломаная: ЛКМ ставит точки, ПКМ — замкнуть и залить. Escape — отмена.';
    else h.innerText = 'Прямоугольник: тяните ЛКМ, отпустите — область зальётся.';
  }
}

// Выставляет ползунки и подписи из дефолтов cropState
function syncCropUI() {
  const set = (id, val, fmtId, fmt) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
    const v = document.getElementById(fmtId);
    if (v) v.innerText = fmt(val);
  };
  set('crop-bg-threshold', cropState.bgThreshold, 'crop-bg-threshold-value', v => `${v}`);
  set('crop-clean', cropState.clean, 'crop-clean-value', v => `${v} %`);
  set('crop-overlap', cropState.overlap, 'crop-overlap-value', v => `${v} px`);
  set('crop-grad', cropState.gradStrength, 'crop-grad-value', v => `${v} %`);
  set('crop-tone', cropState.tone, 'crop-tone-value', v => `${v}`);
  set('crop-fill-opacity', cropState.fillOpacity, 'crop-fill-opacity-value', v => `${v} %`);
}

function bindSlider(id, valueId, setter, fmt) {
  const el = document.getElementById(id);
  const val = document.getElementById(valueId);
  el?.addEventListener('input', (e) => {
    const v = parseInt(e.target.value) || 0;
    setter(v);
    if (val) val.innerText = fmt(v);
    if (cropFlags.interactive) { invalidateMargin(); requestRender(); }
  });
  el?.addEventListener('change', () => { invalidateMargin(); requestRender(); });
}

function bakeCrop() {
  if (!state.img) return;
  // Целые пиксели: иначе drawImage с дробным смещением интерполирует
  // всё изображение и каждая обрезка слегка «мылит» картинку
  const x1 = Math.round(Math.min(cropState.x1, cropState.x2));
  const y1 = Math.round(Math.min(cropState.y1, cropState.y2));
  const x2 = Math.round(Math.max(cropState.x1, cropState.x2));
  const y2 = Math.round(Math.max(cropState.y1, cropState.y2));
  const fw = x2 - x1, fh = y2 - y1;
  if (fw < 8 || fh < 8) return;

  // снапим рамку к целым пикселям, чтобы превью и запекание совпадали
  cropState.x1 = x1; cropState.y1 = y1; cropState.x2 = x2; cropState.y2 = y2;
  invalidateMargin();

  const base = state.originalCanvas || state.img;
  const out = document.createElement('canvas');
  out.width = fw; out.height = fh;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false; // копирование 1:1 без интерполяции

  // база первая, поля поверх — так захват кромки перекрывает тёмную окантовку
  ctx.drawImage(base, -x1, -y1);
  const margin = getMarginCanvas();
  if (margin) ctx.drawImage(margin, 0, 0);

  state.img = out;
  state.originalCanvas = copyCanvas(out);
  clearBaseCache();
  updateCropInterface();
  setStatus(`Обрезка: применено (${fw}x${fh} px).`);
  requestRender();
}

function updateExtendUI() {
  const b = document.getElementById('crop-extend-toggle');
  if (!b) return;
  if (cropState.extend) {
    b.innerText = 'Наращивать: Вкл';
    b.style.background = '#007acc'; b.style.borderColor = '#007acc';
  } else {
    b.innerText = 'Наращивать: Выкл';
    b.style.background = '#3c3c3c'; b.style.borderColor = '#555';
  }
}

function updateFSwatchUI() {
  document.querySelectorAll('.crop-fswatch').forEach(b => {
    const on = b.getAttribute('data-fcolor') === cropState.fillColor;
    b.style.outline = on ? '2px solid #00ff99' : 'none';
  });
}

function updateFillUI() {
  const isBg = cropState.fillColor === 'bg';
  ['crop-bg-threshold', 'crop-grad', 'crop-tone', 'crop-clean'].forEach(id => {
    const s = document.getElementById(id);
    if (s) { s.disabled = !isBg; s.style.opacity = isBg ? '1' : '0.35'; }
  });
}

function requestRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (state.render) state.render();
  });
}

function copyCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function setStatus(text) {
  const el = document.getElementById('status-message');
  if (el) el.innerText = text;
}

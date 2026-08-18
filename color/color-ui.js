// Путь: color-ui.js
// Вся привязка DOM инструмента «Цвет».
import { state } from '../state.js';
import { colorState, LAYER_SLIDERS, LAYER_BUTTONS } from './color-state.js';
import { getColorPreviewCanvas, invalidateColorCache, requestColorRender } from './color-preview.js';
import { clearBrushStrokes, brushUndo, brushRedo, getHistoryCounts } from './color-brush.js';

// Базовый снимок на начало работы с инструментом «Цвет».
// «Применить» его НЕ перезаписывает — точка сброса стабильна.
let colorBaseline = null;

export function colorToolEntered() {
  if (!state.img) { colorBaseline = null; return; }
  colorBaseline = copyCanvas(state.img);
}

export function initColorTool() {
  Object.keys(LAYER_BUTTONS).forEach(key => bindToggle(LAYER_BUTTONS[key], key));

  bindSlider('color-level-strength', 'color-level-strength-value', v => { colorState.levelStrength = v; }, v => `${v}%`);
  bindSlider('color-level-block', 'color-level-block-value', v => { colorState.levelBlock = v; }, v => `${v} px`);
  bindSlider('color-level-target', 'color-level-target-value', v => { colorState.levelTarget = v; }, v => `${v}`);
  bindSlider('color-level-depth', 'color-level-depth-value', v => { colorState.levelDepth = v / 10; }, v => `x${(v / 10).toFixed(1)}`);
  bindSlider('color-level-color', 'color-level-color-value', v => { colorState.levelColor = v; }, v => `${v}%`);

  bindSlider('color-ocr-window', 'color-ocr-window-value', v => { colorState.ocrWindow = v; }, v => `${v} px`);

  const sensEl = document.getElementById('color-ocr-sens');
  const sensVal = document.getElementById('color-ocr-sens-value');
  sensEl?.addEventListener('input', () => {
    const v = sliderToSens(parseInt(sensEl.value) || 0);
    colorState.ocrSens = v;
    if (sensVal) sensVal.innerText = `${v}%`;
    if (!colorState.interactive) return;
    invalidateColorCache();
    requestColorRender();
  });

  bindSlider('color-ocr-strength', 'color-ocr-strength-value', v => { colorState.ocrStrength = v; }, v => `${v}%`);
  bindSlider('color-gray-strength', 'color-gray-strength-value', v => { colorState.grayStrength = v; }, v => `${v}%`);

  bindSlider('color-bc-strength', 'color-bc-strength-value', v => { colorState.bcStrength = v; }, v => `${v}%`);
  bindSlider('color-bc-bright', 'color-bc-bright-value', v => { colorState.bcBright = v; }, v => `${v}`);
  bindSlider('color-bc-contrast', 'color-bc-contrast-value', v => { colorState.bcContrast = v; }, v => `${v}`);
  bindSlider('color-bc-gamma', 'color-bc-gamma-value', v => { colorState.bcGamma = v / 100; }, v => (v / 100).toFixed(2));

  bindSlider('color-brush-radius', 'color-brush-radius-value', v => { colorState.brushRadius = v; }, v => `${v} px`);
  bindSlider('color-brush-strength', 'color-brush-strength-value', v => { colorState.brushStrength = v; }, v => `${v}%`);
  bindSlider('color-brush-threshold', 'color-brush-threshold-value', v => { colorState.brushThreshold = v; }, v => `${v}`);
  bindSlider('color-brush-protect', 'color-brush-protect-value', v => { colorState.brushProtect = v; }, v => `${v}`);
  bindSlider('color-brush-history-max', 'color-brush-history-max-value', v => { colorState.brushHistoryMax = v; }, v => `${v}`);

  document.getElementById('color-brush-mode')?.addEventListener('change', (e) => {
    colorState.brushMode = e.target.value;
  });

  document.getElementById('color-brush-clear')?.addEventListener('click', () => {
    clearBrushStrokes();
    invalidateColorCache();
    requestColorRender();
    updateHistoryUI();
    setStatus('Кисть: все штрихи удалены.');
  });

  document.getElementById('color-brush-undo')?.addEventListener('click', () => {
    if (brushUndo()) { invalidateColorCache(); requestColorRender(); updateHistoryUI(); }
  });
  document.getElementById('color-brush-redo')?.addEventListener('click', () => {
    if (brushRedo()) { invalidateColorCache(); requestColorRender(); updateHistoryUI(); }
  });

  document.getElementById('color-toggle-interactive')?.addEventListener('click', (e) => {
    colorState.interactive = !colorState.interactive;
    if (colorState.interactive) {
      e.target.innerText = 'Интерактивно: Включен';
      e.target.style.background = '#ff3333';
      e.target.style.borderColor = '#ff3333';
    } else {
      e.target.innerText = 'Интерактивно: Выключен (экономия)';
      e.target.style.background = '#3c3c3c';
      e.target.style.borderColor = '#555';
    }
    invalidateColorCache();
    requestColorRender();
  });

  // после отпускания мыши: в эконом-режиме пересчитываем превью,
  // а кнопки Undo/Redo обновляем ВСЕГДА — иначе они остаются тусклыми
  window.addEventListener('mouseup', () => {
    if (!colorState.brushOn) return;
    if (!colorState.interactive) {
      invalidateColorCache();
      requestColorRender();
    }
    updateHistoryUI();
  });

  // «Без эффектов»: сравнение с оригиналом
  document.getElementById('color-bypass-btn')?.addEventListener('click', () => {
    colorState.bypass = !colorState.bypass;
    updateBypassUI();
    if (state.render) state.render();
  });

  // Применить: запекание + новый цикл (все слои выключаются)
  document.getElementById('apply-color-btn')?.addEventListener('click', () => {
    if (!state.img) return;
    const result = getColorPreviewCanvas();
    if (!result) return;
    state.img = copyCanvas(result);
    state.originalCanvas = copyCanvas(result);
    clearBrushStrokes();
    turnAllLayersOff();
    invalidateColorCache();
    updateHistoryUI();
    setStatus('Цвет: слои запечены в документ и отключены. Новый цикл обработки.');
    if (state.render) state.render();
  });

  // Сброс: картинка возвращается к состоянию НА НАЧАЛО работы с инструментом
  document.getElementById('reset-color-btn')?.addEventListener('click', () => {
    const base = colorBaseline || state.originalCanvas;
    if (!base) return;
    state.img = copyCanvas(base);
    state.originalCanvas = copyCanvas(base);
    clearBrushStrokes();
    turnAllLayersOff();
    invalidateColorCache();
    updateHistoryUI();
    setStatus('Цвет: сброшено к состоянию на начало работы с инструментом.');
    if (state.render) state.render();
  });

  updateLayerUI();
  updateBypassUI();
  syncColorUI();
  updateHistoryUI();
}

function turnAllLayersOff() {
  colorState.levelOn = false;
  colorState.ocrOn = false;
  colorState.grayOn = false;
  colorState.bcOn = false;
  colorState.brushOn = false;
  colorState.bypass = false;
  updateLayerUI();
  updateBypassUI();
}

function bindToggle(id, key) {
  document.getElementById(id)?.addEventListener('click', () => {
    colorState[key] = !colorState[key];
    updateLayerUI();
    invalidateColorCache();
    requestColorRender();
  });
}

// parseFloat — чтобы работал шаг 0.5 у «Силы кисти»
function bindSlider(id, valueId, setter, fmt) {
  const el = document.getElementById(id);
  const val = document.getElementById(valueId);
  el?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value) || 0;
    setter(v);
    if (val) val.innerText = fmt(v);
    if (!colorState.interactive) return; // вслепую — пересчёт по Применить/тумблерам
    invalidateColorCache();
    requestColorRender();
  });
}

function updateLayerUI() {
  for (const key in LAYER_BUTTONS) {
    const btn = document.getElementById(LAYER_BUTTONS[key]);
    if (!btn) continue;
    const on = colorState[key];
    btn.innerText = on ? 'Слой: Включен' : 'Слой: Выкл';
    btn.style.background = on ? '#007acc' : '#3c3c3c';
    btn.style.borderColor = on ? '#007acc' : '#555';
    (LAYER_SLIDERS[key] || []).forEach(sid => {
      const s = document.getElementById(sid);
      if (s) { s.disabled = !on; s.style.opacity = on ? '1' : '0.35'; }
    });
  }
  const modeSel = document.getElementById('color-brush-mode');
  if (modeSel) { modeSel.disabled = !colorState.brushOn; modeSel.style.opacity = colorState.brushOn ? '1' : '0.35'; }
  const clearBtn = document.getElementById('color-brush-clear');
  if (clearBtn) { clearBtn.disabled = !colorState.brushOn; clearBtn.style.opacity = colorState.brushOn ? '1' : '0.35'; }
  const ws = document.getElementById('workspace');
  if (ws) ws.style.cursor = colorState.brushOn ? 'crosshair' : '';
  updateHistoryUI();
}

function updateBypassUI() {
  const btn = document.getElementById('color-bypass-btn');
  if (!btn) return;
  if (colorState.bypass) {
    btn.innerText = 'Без эффектов: Вкл (оригинал)';
    btn.style.background = '#b8860b';
    btn.style.borderColor = '#b8860b';
  } else {
    btn.innerText = 'Без эффектов: Выкл';
    btn.style.background = '#3c3c3c';
    btn.style.borderColor = '#555';
  }
}

function updateHistoryUI() {
  const c = getHistoryCounts();
  const u = document.getElementById('color-brush-undo');
  const r = document.getElementById('color-brush-redo');
  if (u) { u.disabled = !colorState.brushOn || c.undo === 0; u.style.opacity = u.disabled ? '0.35' : '1'; }
  if (r) { r.disabled = !colorState.brushOn || c.redo === 0; r.style.opacity = r.disabled ? '0.35' : '1'; }
}

function syncColorUI() {
  const set = (id, val, fmtId, fmt) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
    const v = document.getElementById(fmtId);
    if (v) v.innerText = fmt(val);
  };
  set('color-level-strength', colorState.levelStrength, 'color-level-strength-value', v => `${v}%`);
  set('color-level-block', colorState.levelBlock, 'color-level-block-value', v => `${v} px`);
  set('color-level-target', colorState.levelTarget, 'color-level-target-value', v => `${v}`);
  set('color-level-depth', Math.round(colorState.levelDepth * 10), 'color-level-depth-value', v => `x${(v / 10).toFixed(1)}`);
  set('color-level-color', colorState.levelColor, 'color-level-color-value', v => `${v}%`);
  set('color-ocr-window', colorState.ocrWindow, 'color-ocr-window-value', v => `${v} px`);

  const se = document.getElementById('color-ocr-sens');
  if (se) se.value = sensToSlider(colorState.ocrSens);
  const sv = document.getElementById('color-ocr-sens-value');
  if (sv) sv.innerText = `${colorState.ocrSens}%`;

  set('color-ocr-strength', colorState.ocrStrength, 'color-ocr-strength-value', v => `${v}%`);
  set('color-gray-strength', colorState.grayStrength, 'color-gray-strength-value', v => `${v}%`);
  set('color-bc-strength', colorState.bcStrength, 'color-bc-strength-value', v => `${v}%`);
  set('color-bc-bright', colorState.bcBright, 'color-bc-bright-value', v => `${v}`);
  set('color-bc-contrast', colorState.bcContrast, 'color-bc-contrast-value', v => `${v}`);
  set('color-bc-gamma', Math.round(colorState.bcGamma * 100), 'color-bc-gamma-value', v => (v / 100).toFixed(2));
  set('color-brush-radius', colorState.brushRadius, 'color-brush-radius-value', v => `${v} px`);
  set('color-brush-strength', colorState.brushStrength, 'color-brush-strength-value', v => `${v}%`);
  set('color-brush-threshold', colorState.brushThreshold, 'color-brush-threshold-value', v => `${v}`);
  set('color-brush-protect', colorState.brushProtect, 'color-brush-protect-value', v => `${v}`);
  set('color-brush-history-max', colorState.brushHistoryMax, 'color-brush-history-max-value', v => `${v}`);
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

// Логарифмическая шкала чувствительности: 0..45, дефолт 3
function sliderToSens(s) { return Math.round(Math.pow(46, s / 100) - 1); }
function sensToSlider(v) { return Math.round(100 * Math.log(v + 1) / Math.log(46)); }

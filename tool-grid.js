// Путь: tool-grid.js
import { state } from './state.js';
import { generateWarpGridPoints, hasAnyOffset, renderWarpedDocument } from './grid/grid-math.js';
import { updatePresetButtonsUI, updateInteractiveButtonUI } from './grid/grid-ui.js';

const QUALITY_PRESETS = {
  draft:  { cell: 32, ss: 1, maxCells: 1500 },
  normal: { cell: 16, ss: 1, maxCells: 3000 },
  high:   { cell: 8,  ss: 2, maxCells: 9000 },
  ultra:  { cell: 6,  ss: 2, maxCells: 20000 }
};

const MARKER_SIZES = {
  small:  { marker: 4,  anchor: 2,   hit: 10 },
  medium: { marker: 8,  anchor: 3.5, hit: 18 },
  large:  { marker: 14, anchor: 5,   hit: 30 }
};

export function getMarkerMetrics() {
  return MARKER_SIZES[state.markerSize] || MARKER_SIZES.medium;
}

let previewCache = null;
let previewDirty = true;
let lastBase = null;
let lastLight = null;

export function invalidateGridCache() { previewDirty = true; }

let rafPending = false;
export function requestGridRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (state.render) state.render();
  });
}

export function getGridPreviewCanvas() {
  if (!state.img || !state.gridPoints || !state.gridRect) return null;
  const base = state.originalCanvas || state.img;
  const light = state.isDraggingGridPoint; // во время тяги — черновик
  if (base !== lastBase || light !== lastLight) previewDirty = true;
  if (!previewDirty && previewCache) return previewCache;

  const q = light ? QUALITY_PRESETS.draft : (QUALITY_PRESETS[state.gridQuality] || QUALITY_PRESETS.normal);
  previewCache = renderWarpedDocument(base, state.gridPoints, state.gridSize, state.gridRect, {
    mode: state.gridMode,
    radiusAction: state.gridRadiusAction,
    radiusSmooth: state.gridRadiusSmooth,
    expand: state.gridRectExpand || 0,
    cell: q.cell, maxCells: q.maxCells, ss: q.ss
  });
  lastBase = base;
  lastLight = light;
  previewDirty = false;
  return previewCache;
}

function sliderToRadius(s) { return Math.round(Math.pow(501, s / 100) - 1); }
function radiusToSlider(v) { return Math.round(100 * Math.log(v + 1) / Math.log(501)); }

export function initGridTool() {
  const sliderAction = document.getElementById('grid-radius-action');
  const displayAction = document.getElementById('grid-radius-action-value');
  const sliderSmooth = document.getElementById('grid-radius-smooth');
  const displaySmooth = document.getElementById('grid-radius-smooth-value');
  const btnDefine = document.getElementById('grid-btn-define');

  const modeSelect = document.getElementById('grid-mode-select');
  const qualitySelect = document.getElementById('grid-quality-select');

  if (sliderSmooth) {
    sliderSmooth.value = state.gridRadiusSmooth;
    if (displaySmooth) displaySmooth.innerText = `${state.gridRadiusSmooth} px`;
  }

  sliderAction?.addEventListener('input', (e) => {
    const v = parseInt(e.target.value) || 0;
    if (state.gridMode === 'radial') {
      state.gridRadiusAction = sliderToRadius(v);
      if (displayAction) displayAction.innerText = `${state.gridRadiusAction} px`;
    } else {
      state.gridRectExpand = v;
      if (displayAction) displayAction.innerText = `${v} px`;
    }
    invalidateGridCache();
    requestGridRender();
  });

  sliderSmooth?.addEventListener('input', (e) => {
    state.gridRadiusSmooth = parseInt(e.target.value) || 0;
    if (displaySmooth) displaySmooth.innerText = `${state.gridRadiusSmooth} px`;
    invalidateGridCache();
    requestGridRender();
  });

  modeSelect?.addEventListener('change', (e) => {
    state.gridMode = e.target.value;
    applyModeUI();
    invalidateGridCache();
    requestGridRender();
  });

  qualitySelect?.addEventListener('change', (e) => {
    state.gridQuality = e.target.value;
    invalidateGridCache();
    requestGridRender();
  });

  ['small', 'medium', 'large'].forEach(key => {
    document.getElementById('grid-marker-' + key)?.addEventListener('click', () => {
      state.markerSize = key;
      updateMarkerSizeUI();
      if (state.render) state.render();
    });
  });

  document.getElementById('grid-toggle-anchors')?.addEventListener('click', (e) => {
    state.gridShowAnchors = !state.gridShowAnchors;
    if (state.gridShowAnchors) {
      e.target.innerText = 'Якоря: Включены';
      e.target.style.background = '#007acc';
      e.target.style.borderColor = '#007acc';
    } else {
      e.target.innerText = 'Якоря: Выключены';
      e.target.style.background = '#3c3c3c';
      e.target.style.borderColor = '#555';
    }
    if (state.render) state.render();
  });

  document.getElementById('grid-toggle-lines')?.addEventListener('click', (e) => {
    state.gridShowLines = !state.gridShowLines;
    if (state.gridShowLines) {
      e.target.innerText = 'Линии строк: Включены';
      e.target.style.background = '#ff3333';
      e.target.style.borderColor = '#ff3333';
    } else {
      e.target.innerText = 'Включить горизонтальные линии (Выкл)';
      e.target.style.background = '#3c3c3c';
      e.target.style.borderColor = '#555';
    }
    if (state.render) state.render();
  });

  document.getElementById('grid-preset-3')?.addEventListener('click', (e) => {
    updatePresetButtonsUI(e.target);
    state.gridSize = 3;
    rebuildGridFromRect('Пресет 3x3: сетка перестроена, смещения узлов сброшены.');
  });

  document.getElementById('grid-preset-4')?.addEventListener('click', (e) => {
    updatePresetButtonsUI(e.target);
    state.gridSize = 4;
    rebuildGridFromRect('Пресет 4x4: сетка перестроена, смещения узлов сброшены.');
  });

  btnDefine?.addEventListener('click', () => {
    if (!state.img) return;
    state.isGridDefining = true;
    state.gridPoints = null;
    state.gridRect = null;
    state.gridActivePoint = null;
    invalidateGridCache();
    btnDefine.innerText = 'Выделите область на картинке...';
    btnDefine.style.background = '#00ff99';
    btnDefine.style.color = '#1e1e1e';
    setDefiningCursor(true);
    if (state.render) state.render();
  });

  document.getElementById('apply-grid-btn')?.addEventListener('click', () => {
    if (!state.img || !state.gridPoints) return;
    if (!hasAnyOffset(state.gridPoints, state.gridSize)) {
      setStatus('Решётка: нет деформаций для запекания. Сначала потяните за узлы.');
      return;
    }
    bakeMeshWarp();
  });

  document.getElementById('reset-grid-btn')?.addEventListener('click', () => {
    if (!state.originalCanvas) return;
    state.img = copyCanvas(state.originalCanvas);
    resetGridToolState();
    setStatus('Решётка: деформации отменены, изображение восстановлено.');
    if (state.render) state.render();
  });

  applyModeUI();
  updateMarkerSizeUI();
}

function applyModeUI() {
  const radial = state.gridMode === 'radial';
  const free = state.gridMode === 'free';
  const sliderAction = document.getElementById('grid-radius-action');
  const sliderSmooth = document.getElementById('grid-radius-smooth');
  const labelAction = document.getElementById('grid-action-label');
  const displayAction = document.getElementById('grid-radius-action-value');

  if (sliderAction) {
    sliderAction.disabled = free; // в свободной трансформации границ нет
    sliderAction.style.opacity = free ? '0.35' : '1';
    if (radial) {
      sliderAction.min = 0; sliderAction.max = 100; sliderAction.step = 1;
      sliderAction.value = radiusToSlider(state.gridRadiusAction);
      if (labelAction) labelAction.innerText = 'Радиус действия эффекта (лог.):';
      if (displayAction) displayAction.innerText = `${state.gridRadiusAction} px`;
    } else {
      sliderAction.min = 0; sliderAction.max = 300; sliderAction.step = 5;
      sliderAction.value = state.gridRectExpand || 0;
      if (labelAction) labelAction.innerText = 'Смещение границ (расширение эффекта):';
      if (displayAction) displayAction.innerText = `${state.gridRectExpand || 0} px`;
    }
  }
  if (sliderSmooth) {
    sliderSmooth.disabled = free;
    sliderSmooth.style.opacity = free ? '0.35' : '1';
  }
}

function updateMarkerSizeUI() {
  ['small', 'medium', 'large'].forEach(key => {
    const b = document.getElementById('grid-marker-' + key);
    if (!b) return;
    const on = state.markerSize === key;
    b.className = on ? 'action-btn' : '';
    b.style.background = on ? '#007acc' : '#3c3c3c';
    b.style.borderColor = on ? '#007acc' : '#555';
  });
}

function rebuildGridFromRect(msg) {
  if (state.gridRect) {
    state.gridPoints = generateWarpGridPoints(state.gridRect, state.gridSize);
    state.gridActivePoint = null;
    invalidateGridCache();
    if (msg) setStatus(msg);
  }
  if (state.render) state.render();
}

export function completeGridDefine() {
  const btnDefine = document.getElementById('grid-btn-define');
  state.isGridDefining = false;
  setDefiningCursor(false);

  if (!state.img || !state.gridDefStart || !state.gridDefEnd) {
    resetDefineButton(btnDefine);
    return;
  }

  const W = state.img.width, H = state.img.height;
  const x1 = clamp(Math.min(state.gridDefStart.x, state.gridDefEnd.x), 0, W);
  const y1 = clamp(Math.min(state.gridDefStart.y, state.gridDefEnd.y), 0, H);
  const x2 = clamp(Math.max(state.gridDefStart.x, state.gridDefEnd.x), 0, W);
  const y2 = clamp(Math.max(state.gridDefStart.y, state.gridDefEnd.y), 0, H);

  if (x2 - x1 < 15 || y2 - y1 < 15) {
    setStatus('Решётка: область слишком мала. Выделите повреждённую зону крупнее.');
    resetDefineButton(btnDefine);
    state.gridDefStart = null;
    state.gridDefEnd = null;
    if (state.render) state.render();
    return;
  }

  // Решётка — ТОЧНО по выделению пользователя
  state.gridRect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  state.gridPoints = generateWarpGridPoints(state.gridRect, state.gridSize);
  state.gridActivePoint = null;
  invalidateGridCache();

  if (btnDefine) {
    btnDefine.innerText = 'Решётка создана. Тяните за узлы!';
    btnDefine.style.background = '#007acc';
    btnDefine.style.color = '#fff';
  }
  setStatus(`Решётка ${state.gridSize}x${state.gridSize} создана по выделению. Тяните ЗЕЛЁНЫЕ маркеры.`);
  if (state.render) state.render();
}

export function checkGridHandles(imgX, imgY) {
  if (!state.gridPoints) return false;
  const radius = getMarkerMetrics().hit / state.zoom;

  let best = null, bestDist = Infinity;
  for (let r = 0; r < state.gridSize; r++) {
    for (let c = 0; c < state.gridSize; c++) {
      const pt = state.gridPoints[r][c];
      const gx = pt.x + (pt.offsetX || 0);
      const gy = pt.y + (pt.offsetY || 0);
      const d = Math.hypot(imgX - gx, imgY - gy);
      if (d < bestDist) { bestDist = d; best = { r, c }; }
    }
  }
  if (best && bestDist <= radius) {
    state.gridActivePoint = best;
    return true;
  }
  return false;
}

function bakeMeshWarp() {
  const preview = getGridPreviewCanvas();
  if (!preview) return;

  const q = QUALITY_PRESETS[state.gridQuality] || QUALITY_PRESETS.normal;
  const ss = q.ss || 1;
  const base = state.originalCanvas || state.img;
  const W = base.width, H = base.height;

  const pc = preview.canvas || preview;
  const ox = preview.ox || 0, oy = preview.oy || 0;

  let finalCanvas;
  if (preview.free) {
    // legacy-ветка свободной трансформации: документ = сам оверлей
    finalCanvas = pc;
    if (ss > 1) {
      const dn = document.createElement('canvas');
      dn.width = Math.max(1, Math.round(pc.width / ss));
      dn.height = Math.max(1, Math.round(pc.height / ss));
      const dctx = dn.getContext('2d');
      dctx.imageSmoothingEnabled = true;
      dctx.imageSmoothingQuality = 'high';
      dctx.drawImage(pc, 0, 0, dn.width, dn.height);
      finalCanvas = dn;
    }
  } else {
    // КОМПОЗИТ ПОЛНОГО ДОКУМЕНТА: база + деформированная область.
    // Без этого запекание обрезало бы картинку по рамке области!
    const full = document.createElement('canvas');
    full.width = Math.round(W * ss);
    full.height = Math.round(H * ss);
    const fctx = full.getContext('2d');
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = 'high';
    fctx.scale(ss, ss);
    fctx.drawImage(base, 0, 0);
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    // оверлей уже отрендерен в ss-масштабе — кладём его 1:1 в его координаты
    fctx.drawImage(pc, Math.round(ox * ss), Math.round(oy * ss));

    finalCanvas = full;
    if (ss > 1) {
      // даунскейл суперсэмплинга до исходного разрешения документа
      const dn = document.createElement('canvas');
      dn.width = W; dn.height = H;
      const dctx = dn.getContext('2d');
      dctx.imageSmoothingEnabled = true;
      dctx.imageSmoothingQuality = 'high';
      dctx.drawImage(full, 0, 0, W, H);
      finalCanvas = dn;
    }
  }

  state.img = finalCanvas;
  state.originalCanvas = copyCanvas(finalCanvas);
  resetGridToolState();
  setStatus(`Решётка: деформация запечена (${finalCanvas.width}x${finalCanvas.height} px, режим "${state.gridMode}").`);
  if (state.render) state.render();
}

export function resetGridToolState() {
  state.isGridDefining = false;
  state.isDraggingGridPoint = false;
  state.gridDefStart = null;
  state.gridDefEnd = null;
  state.gridRect = null;
  state.gridPoints = null;
  state.gridActivePoint = null;
  state.gridGrab = null;
  previewCache = null;
  lastBase = null;
  previewDirty = true;

  resetDefineButton(document.getElementById('grid-btn-define'));
  setDefiningCursor(false);
}

function resetDefineButton(btn) {
  if (btn) {
    btn.innerText = 'Задать решётку (Мышью)';
    btn.style.background = '#3c3c3c';
    btn.style.color = '#fff';
  }
}

function setDefiningCursor(on) {
  const ws = document.getElementById('workspace');
  if (ws) ws.style.cursor = on ? 'crosshair' : '';
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

function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }

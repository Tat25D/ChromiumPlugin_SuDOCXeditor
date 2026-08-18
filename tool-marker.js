// Путь: tool-marker.js
import { state } from './state.js';

const FONT_STACK = {
  times: '"Times New Roman", Times, serif',
  arial: 'Arial, Helvetica, sans-serif',
  courier: '"Courier New", Courier, monospace'
};

export const markerState = {
  mode: 'censor',
  color: '#000000',
  opacity: 100,
  size: 20,
  shape: 'circle',
  linked: false,
  bypass: false,
  textLines: ['', '', ''],
  textSize: 24,
  textColor: '#000000',
  textFont: 'times'
};

let strokes = [];
let currentStroke = null;
let pendingAnchor = null;
let drawing = false;
let rafPending = false;
let cursorPos = null;

let textObjects = [];
let placingText = false;
let dragText = null;

let basePixels = null;
let basePixelsKey = null;
let paperMedianCache = null;
let paperMedianKey = null;

export function isMarkerDrawing() { return drawing; }
export function isMarkerTextDragging() { return !!dragText; }

export function setMarkerCursor(x, y) {
  cursorPos = (x === null || x === undefined) ? null : { x, y };
  requestMarkerRender();
}

export function resetMarkerToolState() {
  strokes = [];
  currentStroke = null;
  pendingAnchor = null;
  drawing = false;
  textObjects = [];
  placingText = false;
  dragText = null;
}

export function initMarkerTool() {
  document.getElementById('marker-mode-censor')?.addEventListener('click', () => setMode('censor'));
  document.getElementById('marker-mode-overlay')?.addEventListener('click', () => setMode('overlay'));
  document.getElementById('marker-mode-text')?.addEventListener('click', () => setMode('text'));

  document.querySelectorAll('.marker-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      markerState.color = btn.getAttribute('data-mcolor');
      updateSwatchUI();
    });
  });

  document.querySelectorAll('.marker-tswatch').forEach(btn => {
    btn.addEventListener('click', () => {
      markerState.textColor = btn.getAttribute('data-tcolor');
      document.querySelectorAll('.marker-tswatch').forEach(b => {
        b.style.outline = (b === btn) ? '2px solid #00ff99' : 'none';
      });
    });
  });

  document.getElementById('marker-size')?.addEventListener('input', (e) => {
    markerState.size = parseInt(e.target.value) || 20;
    const v = document.getElementById('marker-size-value');
    if (v) v.innerText = `${markerState.size} px`;
  });

  document.getElementById('marker-opacity')?.addEventListener('input', (e) => {
    markerState.opacity = parseInt(e.target.value) || 100;
    const v = document.getElementById('marker-opacity-value');
    if (v) v.innerText = `${markerState.opacity} %`;
  });

  ['circle', 'rect', 'square'].forEach(sh => {
    document.getElementById('marker-shape-' + sh)?.addEventListener('click', () => {
      markerState.shape = sh;
      updateShapeUI();
    });
  });

  document.getElementById('marker-linked-toggle')?.addEventListener('click', () => {
    markerState.linked = !markerState.linked;
    pendingAnchor = null;
    updateLinkedUI();
    requestMarkerRender();
  });

  document.getElementById('marker-bypass-btn')?.addEventListener('click', () => {
    markerState.bypass = !markerState.bypass;
    updateBypassMarkerUI();
    if (state.render) state.render();
  });

  [1, 2, 3].forEach(i => {
    document.getElementById('marker-text-' + i)?.addEventListener('input', (e) => {
      markerState.textLines[i - 1] = e.target.value;
      requestMarkerRender();
    });
  });

  document.getElementById('marker-text-size')?.addEventListener('input', (e) => {
    markerState.textSize = parseInt(e.target.value) || 24;
    const v = document.getElementById('marker-text-size-value');
    if (v) v.innerText = `${markerState.textSize} px`;
    requestMarkerRender();
  });

  document.getElementById('marker-text-font')?.addEventListener('change', (e) => {
    markerState.textFont = e.target.value;
    requestMarkerRender();
  });

  document.getElementById('marker-text-insert')?.addEventListener('click', () => {
    if (!markerState.textLines.some(l => l.trim() !== '')) {
      setStatus('Маркер: введите текст для вставки.');
      return;
    }
    placingText = true;
    setStatus('Маркер: кликните по документу, чтобы поставить текст. Escape — отмена.');
    requestMarkerRender();
  });

  document.getElementById('marker-text-remove')?.addEventListener('click', () => {
    textObjects.pop();
    requestMarkerRender();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (placingText) { placingText = false; requestMarkerRender(); }
      if (pendingAnchor) { pendingAnchor = null; requestMarkerRender(); }
    }
  });

  document.getElementById('apply-marker-btn')?.addEventListener('click', () => { bakeMarker(); });

  document.getElementById('reset-marker-btn')?.addEventListener('click', () => {
    if (!state.originalCanvas) return;
    state.img = copyCanvas(state.originalCanvas);
    strokes = []; currentStroke = null; pendingAnchor = null;
    textObjects = []; placingText = false; dragText = null;
    basePixels = null; basePixelsKey = null;
    paperMedianCache = null; paperMedianKey = null;
    setStatus('Маркер: сброшено к исходному состоянию.');
    requestMarkerRender();
  });

  setMode('censor');
  updateShapeUI();
  updateSwatchUI();
  updateLinkedUI();
  updateBypassMarkerUI();
}

function setMode(mode) {
  markerState.mode = mode;
  placingText = false;
  const isC = mode === 'censor', isO = mode === 'overlay', isT = mode === 'text';
  const cBtn = document.getElementById('marker-mode-censor');
  const oBtn = document.getElementById('marker-mode-overlay');
  const tBtn = document.getElementById('marker-mode-text');
  [[cBtn, isC], [oBtn, isO], [tBtn, isT]].forEach(([b, on]) => {
    if (!b) return;
    b.className = on ? 'action-btn' : '';
    b.style.background = on ? '#007acc' : '#3c3c3c';
    b.style.borderColor = on ? '#007acc' : '#555';
  });
  const palC = document.getElementById('marker-palette-censor');
  const palO = document.getElementById('marker-palette-overlay');
  const tp = document.getElementById('marker-text-panel');
  if (palC) palC.style.display = isC ? 'flex' : 'none';
  if (palO) palO.style.display = isO ? 'flex' : 'none';
  if (tp) tp.style.display = isT ? 'flex' : 'none';
  if (!isT) {
    const defOp = isC ? 100 : 50;
    markerState.opacity = defOp;
    const opSlider = document.getElementById('marker-opacity');
    const opVal = document.getElementById('marker-opacity-value');
    if (opSlider) opSlider.value = defOp;
    if (opVal) opVal.innerText = `${defOp} %`;
  }
}

function updateShapeUI() {
  ['circle', 'rect', 'square'].forEach(sh => {
    const b = document.getElementById('marker-shape-' + sh);
    if (!b) return;
    const on = markerState.shape === sh;
    b.className = on ? 'action-btn' : '';
    b.style.background = on ? '#007acc' : '#3c3c3c';
    b.style.borderColor = on ? '#007acc' : '#555';
  });
}

function updateSwatchUI() {
  document.querySelectorAll('.marker-swatch').forEach(b => {
    const on = b.getAttribute('data-mcolor') === markerState.color;
    b.style.outline = on ? '2px solid #00ff99' : 'none';
  });
}

function updateLinkedUI() {
  const b = document.getElementById('marker-linked-toggle');
  if (!b) return;
  if (markerState.linked) {
    b.innerText = 'Включены: 1-й клик — начало, 2-й — линия';
    b.style.background = '#007acc'; b.style.borderColor = '#007acc';
  } else {
    b.innerText = 'Выкл (Shift — временно)';
    b.style.background = '#3c3c3c'; b.style.borderColor = '#555';
  }
}

function updateBypassMarkerUI() {
  const b = document.getElementById('marker-bypass-btn');
  if (!b) return;
  if (markerState.bypass) {
    b.innerText = 'Без штрихов: Вкл (оригинал)';
    b.style.background = '#b8860b'; b.style.borderColor = '#b8860b';
  } else {
    b.innerText = 'Показать без штрихов (до/после)';
    b.style.background = '#3c3c3c'; b.style.borderColor = '#555';
  }
}

// ---------- взаимодействие ----------

export function markerBegin(imgX, imgY, shiftKey) {
  if (!state.img) return false;

  if (markerState.mode === 'text') {
    if (placingText) {
      const lines = markerState.textLines.filter(l => l.trim() !== '');
      if (lines.length) {
        textObjects.push({
          lines, size: markerState.textSize, color: markerState.textColor,
          font: markerState.textFont, x: imgX, y: imgY
        });
      }
      placingText = false;
      requestMarkerRender();
      return true;
    }
    const idx = hitText(imgX, imgY);
    if (idx >= 0) {
      dragText = { index: idx, offX: imgX - textObjects[idx].x, offY: imgY - textObjects[idx].y };
      requestMarkerRender();
      return true;
    }
    return false;
  }

  const linked = markerState.linked || shiftKey;
  if (linked) {
    if (!pendingAnchor) {
      pendingAnchor = { x: imgX, y: imgY };
      requestMarkerRender();
      return true;
    }
    const s = newStroke();
    stampLine(s, pendingAnchor.x, pendingAnchor.y, imgX, imgY);
    strokes.push(s);
    pendingAnchor = null;
    if (markerState.linked) { markerState.linked = false; updateLinkedUI(); }
    requestMarkerRender();
    return true;
  }

  drawing = true;
  currentStroke = newStroke();
  stampAt(currentStroke, imgX, imgY);
  requestMarkerRender();
  return true;
}

export function markerMove(imgX, imgY) {
  if (dragText) {
    const o = textObjects[dragText.index];
    if (o) { o.x = imgX - dragText.offX; o.y = imgY - dragText.offY; requestMarkerRender(); }
    return;
  }
  if (!drawing || !currentStroke) return;
  const s = currentStroke;
  const from = s.last || { x: imgX, y: imgY };
  const dist = Math.hypot(imgX - from.x, imgY - from.y);
  const dims = shapeDims(s);
  const step = Math.max(1, Math.min(dims.w, dims.h) / 3);
  const n = Math.max(1, Math.floor(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    stampAt(s, from.x + (imgX - from.x) * t, from.y + (imgY - from.y) * t);
  }
  requestMarkerRender();
}

export function markerEnd() {
  if (drawing && currentStroke && currentStroke.canvas) strokes.push(currentStroke);
  drawing = false;
  currentStroke = null;
  dragText = null;
  requestMarkerRender();
}

// ---------- текст ----------

let measureCtx = null;
function textDims(o) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  const lh = Math.round(o.size * 1.25);
  measureCtx.font = `${o.size}px ${FONT_STACK[o.font] || FONT_STACK.times}`;
  let w = 0;
  for (const line of o.lines) w = Math.max(w, measureCtx.measureText(line).width);
  return { w: Math.ceil(w), h: lh * o.lines.length, lh };
}

function hitText(x, y) {
  for (let i = textObjects.length - 1; i >= 0; i--) {
    const o = textObjects[i];
    const d = textDims(o);
    if (x >= o.x && x <= o.x + d.w && y >= o.y && y <= o.y + d.h) return i;
  }
  return -1;
}

function drawTextObj(ctx, o, offX, offY, alpha) {
  const d = textDims(o);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = o.color;
  ctx.font = `${o.size}px ${FONT_STACK[o.font] || FONT_STACK.times}`;
  ctx.textBaseline = 'top';
  o.lines.forEach((line, i) => ctx.fillText(line, o.x + offX, o.y + offY + i * d.lh));
  ctx.restore();
}

// ---------- штрихи ----------

function newStroke() {
  return {
    mode: markerState.mode, color: markerState.color, opacity: markerState.opacity / 100,
    shape: markerState.shape, size: markerState.size,
    canvas: null, ox: 0, oy: 0, w: 0, h: 0, last: null
  };
}

function shapeDims(s) {
  if (s.shape === 'rect') return { w: Math.max(4, s.size * 0.6), h: s.size * 2.5 };
  return { w: s.size, h: s.size };
}

function ensureCanvas(s, minX, minY, maxX, maxY) {
  minX = Math.floor(minX); minY = Math.floor(minY);
  maxX = Math.ceil(maxX); maxY = Math.ceil(maxY);
  if (!s.canvas) {
    s.ox = minX; s.oy = minY;
    s.w = Math.max(1, maxX - minX); s.h = Math.max(1, maxY - minY);
    s.canvas = document.createElement('canvas');
    s.canvas.width = s.w; s.canvas.height = s.h;
    return;
  }
  if (minX >= s.ox && minY >= s.oy && maxX <= s.ox + s.w && maxY <= s.oy + s.h) return;
  const nx = Math.min(minX, s.ox), ny = Math.min(minY, s.oy);
  const nw = Math.max(maxX, s.ox + s.w) - nx;
  const nh = Math.max(maxY, s.oy + s.h) - ny;
  const nc = document.createElement('canvas');
  nc.width = nw; nc.height = nh;
  nc.getContext('2d').drawImage(s.canvas, s.ox - nx, s.oy - ny);
  s.canvas = nc; s.ox = nx; s.oy = ny; s.w = nw; s.h = nh;
}

function stampAt(s, x, y) {
  const dims = shapeDims(s);
  const pad = 2;
  ensureCanvas(s, x - dims.w / 2 - pad, y - dims.h / 2 - pad, x + dims.w / 2 + pad, y + dims.h / 2 + pad);
  const ctx = s.canvas.getContext('2d');
  const lx = x - s.ox, ly = y - s.oy;
  ctx.fillStyle = (s.color === 'smart') ? resolveSmartColor(x, y) : s.color;
  if (s.shape === 'circle') {
    ctx.beginPath(); ctx.arc(lx, ly, dims.w / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillRect(lx - dims.w / 2, ly - dims.h / 2, dims.w, dims.h);
  }
  s.last = { x, y };
}

function stampLine(s, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const dims = shapeDims(s);
  const step = Math.max(1, Math.min(dims.w, dims.h) / 3);
  const n = Math.max(1, Math.floor(dist / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    stampAt(s, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
  }
}

// ---------- умный цвет «фон рядом» ----------

function resolveSmartColor(x, y) {
  const bp = getBasePixels();
  if (!bp) return '#F5F2E8';
  const W = bp.width, H = bp.height, d = bp.data;
  const inner = markerState.size * 0.75;
  const outer = markerState.size * 1.4;

  const raw = [];
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    for (const rad of [inner * 0.5, inner, (inner + outer) / 2, outer]) {
      let px = Math.round(x + Math.cos(ang) * rad);
      let py = Math.round(y + Math.sin(ang) * rad);
      // учёт края: проба за границей зеркалится внутрь
      if (px < 0) px = -px;
      if (py < 0) py = -py;
      if (px >= W) px = 2 * (W - 1) - px;
      if (py >= H) py = 2 * (H - 1) - py;
      px = Math.max(0, Math.min(W - 1, px));
      py = Math.max(0, Math.min(H - 1, py));
      const i = (py * W + px) * 4;
      const luma = (d[i] * 2126 + d[i + 1] * 7152 + d[i + 2] * 722) / 10000;
      raw.push([d[i], d[i + 1], d[i + 2], luma]);
    }
  }
  if (raw.length === 0) return '#F5F2E8';

  // Адаптивная отсечка: текст/тени темнее ЛОКАЛЬНОЙ медианы бумаги,
  // поэтому на тёмной (правой) стороне бумага больше не теряется
  raw.sort((a, b) => a[3] - b[3]);
  const med = raw[Math.floor(raw.length / 2)][3];
  const cut = Math.max(24, med * 0.6);
  const keep = raw.filter(s => s[3] >= cut);
  if (keep.length === 0) return '#F5F2E8';

  // центральный квантиль 30–70%: локальная бумага без хвостов
  const lo = Math.floor(keep.length * 0.3);
  const hi = Math.max(lo + 1, Math.ceil(keep.length * 0.7));
  let r = 0, g = 0, b = 0, n = 0;
  for (let k = lo; k < hi; k++) { r += keep[k][0]; g += keep[k][1]; b += keep[k][2]; n++; }
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}

function getPaperMedian(bp) {
  if (paperMedianKey === bp) return paperMedianCache;
  const W = bp.width, H = bp.height, d = bp.data;
  const arr = [];
  const step = Math.max(1, Math.floor(Math.sqrt((W * H) / 50000)));
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      const luma = (d[i] * 2126 + d[i + 1] * 7152 + d[i + 2] * 722) / 10000;
      arr.push([d[i], d[i + 1], d[i + 2], luma]);
    }
  }
  arr.sort((a, b) => a[3] - b[3]);
  const med = arr[Math.floor(arr.length / 2)][3];
  const cut = Math.max(24, med * 0.6);
  const keep = arr.filter(s => s[3] >= cut);
  const src = keep.length ? keep : arr;
  const lo = Math.floor(src.length * 0.1);
  const hi = Math.max(lo + 1, Math.ceil(src.length * 0.5));
  let r = 0, g = 0, b = 0, n = 0;
  for (let k = lo; k < hi; k++) { r += src[k][0]; g += src[k][1]; b += src[k][2]; n++; }
  paperMedianCache = n ? [r / n, g / n, b / n] : [245, 242, 232];
  paperMedianKey = bp;
  return paperMedianCache;
}

function getBasePixels() {
  if (basePixelsKey === state.img) return basePixels;
  if (!state.img) return null;
  const c = document.createElement('canvas');
  c.width = state.img.width; c.height = state.img.height;
  c.getContext('2d').drawImage(state.img, 0, 0);
  basePixels = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  basePixelsKey = state.img;
  return basePixels;
}

// ---------- отрисовка и запекание ----------

export function renderMarkerStrokes(ctx, offX, offY, withGuides) {
  if (withGuides && cursorPos && markerState.mode !== 'text') drawCursorOutline(ctx, offX, offY);
  if (withGuides && markerState.bypass) return;

  const all = currentStroke ? strokes.concat([currentStroke]) : strokes;
  for (const s of all) {
    if (!s.canvas) continue;
    ctx.save();
    ctx.globalAlpha = s.opacity;
    ctx.globalCompositeOperation = s.mode === 'overlay' ? 'multiply' : 'source-over';
    ctx.drawImage(s.canvas, s.ox + offX, s.oy + offY);
    ctx.restore();
  }

  for (const o of textObjects) drawTextObj(ctx, o, offX, offY, 1);

  if (withGuides) {
    if (dragText && textObjects[dragText.index]) {
      const o = textObjects[dragText.index];
      const d = textDims(o);
      ctx.save();
      ctx.strokeStyle = '#00ff99';
      ctx.lineWidth = 1.5 / state.zoom;
      ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
      ctx.strokeRect(o.x + offX - 2, o.y + offY - 2, d.w + 4, d.h + 4);
      ctx.restore();
    }
    if (placingText && cursorPos) {
      const lines = markerState.textLines.filter(l => l.trim() !== '');
      if (lines.length) {
        const tmp = { lines, size: markerState.textSize, color: markerState.textColor, font: markerState.textFont, x: cursorPos.x, y: cursorPos.y };
        drawTextObj(ctx, tmp, offX, offY, 0.55);
        const d = textDims(tmp);
        ctx.save();
        ctx.strokeStyle = 'rgba(0,255,153,0.8)';
        ctx.lineWidth = 1 / state.zoom;
        ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
        ctx.strokeRect(cursorPos.x + offX - 2, cursorPos.y + offY - 2, d.w + 4, d.h + 4);
        ctx.restore();
      }
    }
    if (pendingAnchor) {
      ctx.save();
      ctx.strokeStyle = '#00ff99';
      ctx.lineWidth = 1.5 / state.zoom;
      const ax = pendingAnchor.x + offX, ay = pendingAnchor.y + offY;
      ctx.beginPath(); ctx.arc(ax, ay, 5 / state.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax - 10 / state.zoom, ay); ctx.lineTo(ax + 10 / state.zoom, ay);
      ctx.moveTo(ax, ay - 10 / state.zoom); ctx.lineTo(ax, ay + 10 / state.zoom);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawCursorOutline(ctx, offX, offY) {
  const dims = shapeDims({ shape: markerState.shape, size: markerState.size });
  ctx.save();
  ctx.translate(offX, offY);
  const lw = 1.25 / state.zoom;
  const passes = [
    ['rgba(0,0,0,0.75)', lw * 2.6],
    ['rgba(255,255,255,0.95)', lw]
  ];
  for (const [color, w] of passes) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    if (markerState.shape === 'circle') {
      ctx.arc(cursorPos.x, cursorPos.y, dims.w / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(cursorPos.x - dims.w / 2, cursorPos.y - dims.h / 2, dims.w, dims.h);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function bakeMarker() {
  if (!state.img) return;
  const all = currentStroke ? strokes.concat([currentStroke]) : strokes;
  if (all.length === 0 && textObjects.length === 0) {
    setStatus('Маркер: нет штрихов или текста для запекания.');
    return;
  }
  const c = document.createElement('canvas');
  c.width = state.img.width;
  c.height = state.img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(state.img, 0, 0);
  renderMarkerStrokes(ctx, 0, 0, false);

  state.img = c;
  state.originalCanvas = copyCanvas(c);
  strokes = []; currentStroke = null; pendingAnchor = null;
  textObjects = []; placingText = false; dragText = null;
  basePixels = null; basePixelsKey = null;
  paperMedianCache = null; paperMedianKey = null;
  setStatus('Маркер: штрихи и текст запечены в документ.');
  requestMarkerRender();
}

function requestMarkerRender() {
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

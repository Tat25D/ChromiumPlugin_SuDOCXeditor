// Путь: crop-fill.js
// Встроенная «Заливка» инструмента «Обрезка»: ремонт краёв документа
// перед наращиванием полей. Выделение: 'edge' (линия из 2 точек — заливается
// сторона ОТ центра), 'poly' (ломаная, замыкается ПКМ), 'rect' (прямоугольник).
import { state } from '../state.js';
import { cropState } from './crop-state.js';
import { buildPaperField, sampleFieldAt, clearBaseCache, invalidateMargin } from './crop-margins.js';

export const cropFillState = {
  enabled: false,
  mode: 'edge',
  points: [],
  rectStart: null,
  rectEnd: null,
  draggingRect: false,
  cursor: null
};

export function resetFillStroke() {
  cropFillState.points = [];
  cropFillState.rectStart = null;
  cropFillState.rectEnd = null;
  cropFillState.draggingRect = false;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cropFillState.enabled) {
    resetFillStroke();
    if (state.render) state.render();
  }
});

// ---------- события из camera.js ----------

export function fillClick(imgX, imgY) {
  if (cropFillState.mode === 'edge') {
    if (cropFillState.points.length === 0) {
      cropFillState.points = [{ x: imgX, y: imgY }];
      if (state.render) state.render();
    } else {
      cropFillState.points[1] = { x: imgX, y: imgY };
      const region = buildEdgeRegion();
      if (region) paintRegion(region);
      cropFillState.points = [];
    }
  } else if (cropFillState.mode === 'poly') {
    cropFillState.points.push({ x: imgX, y: imgY });
    if (state.render) state.render();
  }
}

export function fillClosePoly() {
  if (cropFillState.mode !== 'poly') return;
  if (cropFillState.points.length >= 3) {
    const region = buildPolyRegion();
    if (region) paintRegion(region);
  }
  cropFillState.points = [];
}

export function fillStartRect(imgX, imgY) {
  cropFillState.draggingRect = true;
  cropFillState.rectStart = { x: imgX, y: imgY };
  cropFillState.rectEnd = { x: imgX, y: imgY };
}

export function fillMove(imgX, imgY) {
  cropFillState.cursor = { x: imgX, y: imgY };
  if (cropFillState.draggingRect) cropFillState.rectEnd = { x: imgX, y: imgY };
}

export function fillEndRect() {
  if (!cropFillState.draggingRect) return;
  cropFillState.draggingRect = false;
  const region = buildRectRegion();
  if (region) paintRegion(region);
  cropFillState.rectStart = null;
  cropFillState.rectEnd = null;
}

// ---------- регионы: alpha(x,y) с пером ~1px ----------

function buildEdgeRegion() {
  const [A, B] = cropFillState.points;
  if (!A || !B) return null;
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return null;
  const nx = dy / len, ny = -dx / len;
  const W = state.img.width, H = state.img.height;
  const sC = Math.sign(nx * (W / 2 - A.x) + ny * (H / 2 - A.y)) || 1;
  return {
    bbox: { x0: 0, y0: 0, x1: W - 1, y1: H - 1 },
    alpha: (x, y) => {
      const sd = (nx * (x - A.x) + ny * (y - A.y)) * -sC; // >0 — наружная сторона
      return Math.max(0, Math.min(1, (sd + 1.5) / 3));
    }
  };
}

function buildPolyRegion() {
  const pts = cropFillState.points;
  if (pts.length < 3) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const inside = (x, y) => {
    let inn = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inn = !inn;
    }
    return inn;
  };
  return {
    bbox: { x0: x0 - 2, y0: y0 - 2, x1: x1 + 2, y1: y1 + 2 },
    alpha: (x, y) => {
      let hit = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (inside(x + dx, y + dy)) hit++;
      return hit / 9;
    }
  };
}

function buildRectRegion() {
  const a = cropFillState.rectStart, b = cropFillState.rectEnd;
  if (!a || !b) return null;
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  return {
    bbox: { x0: x0 - 2, y0: y0 - 2, x1: x1 + 2, y1: y1 + 2 },
    alpha: (x, y) => {
      const dIn = Math.min(x - x0, x1 - x, y - y0, y1 - y);
      return Math.max(0, Math.min(1, (dIn + 1.5) / 3));
    }
  };
}

// ---------- запекание заливки ----------

function paintRegion(region) {
  if (!state.img) return;
  const W = state.img.width, H = state.img.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  ctx.drawImage(state.img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const data = id.data;

  const isBg = cropState.fillColor === 'bg';
  const field = isBg ? buildPaperField(state.img) : null;
  const tone = cropState.tone;
  let flat = null;
  if (!isBg) {
    if (cropState.fillColor === 'black') flat = [0, 0, 0];
    else if (cropState.fillColor === 'gray') flat = [128, 128, 128];
    else flat = [255, 255, 255];
  }

  const X0 = Math.max(0, Math.floor(region.bbox.x0));
  const X1 = Math.min(W - 1, Math.ceil(region.bbox.x1));
  const Y0 = Math.max(0, Math.floor(region.bbox.y0));
  const Y1 = Math.min(H - 1, Math.ceil(region.bbox.y1));

  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const a = region.alpha(x, y);
      if (a <= 0) continue;

      let r, g, b;
      if (field) {
        const f = sampleFieldAt(field, x, y);
        r = f[0]; g = f[1]; b = f[2];
      } else {
        r = flat[0]; g = flat[1]; b = flat[2];
      }
      const nz = hash2(x, y) * 1.5;
      const i = (y * W + x) * 4;
      data[i]     = data[i]     + (clamp255(r + tone + nz) - data[i])     * a;
      data[i + 1] = data[i + 1] + (clamp255(g + tone + nz) - data[i + 1]) * a;
      data[i + 2] = data[i + 2] + (clamp255(b + tone + nz) - data[i + 2]) * a;
    }
  }
  ctx.putImageData(id, 0, 0);

  state.img = out;
  state.originalCanvas = copyCanvas(out);
  clearBaseCache();
  invalidateMargin();
  setStatus('Заливка применена: край отремонтирован, поля пересчитаются точнее.');
  if (state.render) state.render();
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (((h ^ (h >> 16)) >>> 0) % 1000) / 1000 - 0.5;
}

function clamp255(v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }

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

import { state } from '../state.js';
import { cropState, cropRect } from './crop-state.js';

let marginCache = null, marginKey = '', marginBase = null;
let bpCache = null, bpKey = null;

export function invalidateMargin() { marginCache = null; marginKey = ''; }
export function clearBaseCache() { bpCache = null; bpKey = null; }

export function updateCropInterface() {
  if (!state.img) return;
  cropState.x1 = 0; cropState.y1 = 0;
  cropState.x2 = state.img.width; cropState.y2 = state.img.height;
  cropState.activeHandle = null;
  invalidateMargin();
}

function getBasePixels(base) {
  if (bpKey === base) return bpCache;
  bpCache = base.getContext('2d').getImageData(0, 0, base.width, base.height).data;
  bpKey = base;
  return bpCache;
}

export function getMarginCanvas() {
  if (!state.img) return null;
  const r = cropRect();
  const W = state.img.width, H = state.img.height;
  if (r.x1 >= 0 && r.y1 >= 0 && r.x2 <= W && r.y2 <= H) return null;

  const base = state.originalCanvas || state.img;
  const key = [r.x1, r.y1, r.x2, r.y2, cropState.fillColor, cropState.bgThreshold,
               cropState.gradStrength, cropState.fillOpacity, cropState.tone,                cropState.gradStrength, cropState.fillOpacity, cropState.tone, cropState.clean, cropState.overlap].join('|');
  if (marginCache && key === marginKey && base === marginBase) return marginCache;

  marginCache = buildMargin(base, r);
  marginKey = key;
  marginBase = base;
  return marginCache;
}

function buildMargin(base, r) {
  const W = base.width, H = base.height;
  const px = getBasePixels(base);
  const fw = r.x2 - r.x1, fh = r.y2 - r.y1;
  const canvas = document.createElement('canvas');
  canvas.width = fw; canvas.height = fh;
  const ctx = canvas.getContext('2d');

  const alpha = Math.max(0, Math.min(100, cropState.fillOpacity)) / 100;
  const isBg = cropState.fillColor === 'bg';
  const T = cropState.bgThreshold;
  const gk = cropState.gradStrength / 100;
  const tone = cropState.tone;

  let flatConst = null;
  if (!isBg) {
    if (cropState.fillColor === 'black') flatConst = [0, 0, 0];
    else if (cropState.fillColor === 'gray') flatConst = [128, 128, 128];
    else flatConst = [255, 255, 255];
  }

  const field = isBg ? buildBgFieldPx(px, W, H, T) : null;
  const D = Math.max(32, Math.round(Math.min(W, H) * 0.18));
  const clean = cropState.clean / 100;
  const OV = Math.max(0, Math.round(cropState.overlap || 0)); // захват кромки внутрь оригинала

  const ix0 = -r.x1, iy0 = -r.y1, ix1 = W - r.x1, iy1 = H - r.y1;
  const extT = r.y1 < 0, extB = r.y2 > H, extL = r.x1 < 0, extR = r.x2 > W;

  const strips = [
    ['top',    0, 0, fw, extT ? Math.min(fh, iy0 + OV) : 0],
    ['bottom', 0, extB ? Math.max(0, iy1 - OV) : fh, fw, fh],
    ['left',   0, Math.max(0, iy0), extL ? Math.min(fw, ix0 + OV) : 0, Math.min(fh, iy1)],
    ['right',  extR ? Math.max(0, ix1 - OV) : fw, Math.max(0, iy0), fw, Math.min(fh, iy1)]
  ];

  for (const [side, sx0, sy0, sx1, sy1] of strips) {
    const w = Math.round(sx1 - sx0), h = Math.round(sy1 - sy0);
    if (w <= 0 || h <= 0) continue;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    for (let y = 0; y < h; y++) {
      const gy = sy0 + y + r.y1;
      for (let x = 0; x < w; x++) {

        const gx = sx0 + x + r.x1;
        const j = (y * w + x) * 4;
        const nz = hash2(Math.round(gx), Math.round(gy)) * 2.0;

        // плавный сход «захвата кромки»: внутри оригинала альфа тает от края к OV
        let fade = 1;
        if (OV > 0) {
          let depth = -1;
          if (side === 'top' && gy >= 0) depth = gy;
          else if (side === 'bottom' && gy <= H - 1) depth = (H - 1) - gy;
          else if (side === 'left' && gx >= 0) depth = gx;
          else if (side === 'right' && gx <= W - 1) depth = (W - 1) - gx;
          if (depth >= 0) fade = Math.max(0, 1 - depth / OV);
        }

        if (flatConst) {
          d[j]     = clamp255(flatConst[0] + tone + nz);
          d[j + 1] = clamp255(flatConst[1] + tone + nz);
          d[j + 2] = clamp255(flatConst[2] + tone + nz);
          d[j + 3] = Math.round(255 * alpha * fade);
          continue;
        }

        // зеркальный источник текстуры внутри листа
        const qx = mirrorCoord(gx, W, D);
        const qy = mirrorCoord(gy, H, D);
        const qi = (qy * W + qx) * 4;
        let sr = px[qi], sg = px[qi + 1], sb = px[qi + 2];

        const Fs = sampleField(field, qx, qy, W, H);
        const luma = (sr * 2126 + sg * 7152 + sb * 722) / 10000;
        const FsLuma = (Fs[0] * 2126 + Fs[1] * 7152 + Fs[2] * 722) / 10000;
        // Диапазон ползунка: 0 => текст еле виден (базовая очистка 88%),
        // 1 => остатки текста отсутствуют полностью.
        const strength = 0.88 + 0.12 * clean;
        const dRel = (FsLuma - luma) / Math.max(24, FsLuma);
        let tl = (dRel - 0.01) / 0.09;          // ловим даже бледные полутона букв
        tl = Math.max(0, Math.min(1, tl));
        const flat = Math.max(0, clean - 0.5) * 2; // верхняя половина: растворение полутонов
        const wClean = Math.min(1, Math.max(tl * strength, flat * 0.95));
        if (wClean > 0) {
          sr += (Fs[0] - sr) * wClean;
          sg += (Fs[1] - sg) * wClean;
          sb += (Fs[2] - sb) * wClean;
        }

        const Fp = fieldSmart(field, gx, gy, W, H);
        const src = [sr, sg, sb];
        for (let ch = 0; ch < 3; ch++) {
          const target = Fs[ch] + (Fp[ch] - Fs[ch]) * gk;
          let ratio = target / Math.max(24, Fs[ch]);
          ratio = Math.max(0.5, Math.min(2.5, ratio)); // не затемняем поля
          d[j + ch] = clamp255(src[ch] * ratio + tone + nz);
        }
        d[j + 3] = Math.round(255 * alpha * fade);
      }
    }
    ctx.putImageData(img, Math.round(sx0), Math.round(sy0));
  }
  return canvas;
}

function mirrorCoord(c, size, D) {
  let t;
  if (c < 0) t = -c;
  else if (c >= size) t = c - (size - 1);
  else return Math.max(0, Math.min(size - 1, Math.round(c)));
  const period = 2 * D;
  let m = t % period;
  if (m > D) m = period - m;
  return Math.max(0, Math.min(size - 1, Math.round(m)));
}

function clamp255(v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (((h ^ (h >> 16)) >>> 0) % 1000) / 1000 - 0.5;
}

// Карта освещения: блоки ~32px по «чистым» пикселям; цвет блока — МЕДИАНА
// по яркости (светлый фон за листом и тёмный текст отсекаются как хвосты),
// дырки (стол, плотный текст) достраиваются от соседей.
function buildBgFieldPx(px, W, H, threshold) {
  const smallW = Math.max(8, Math.round(W / 32));
  const smallH = Math.max(8, Math.round(H / 32));
  const bw = Math.max(1, Math.floor(W / smallW));
  const bh = Math.max(1, Math.floor(H / smallH));
  const grid = new Float32Array(smallW * smallH * 3);
  const valid = new Uint8Array(smallW * smallH);

  for (let by = 0; by < smallH; by++) {
    const y0 = by * bh, y1 = Math.min(H, y0 + bh);
    for (let bx = 0; bx < smallW; bx++) {
      const x0 = bx * bw, x1 = Math.min(W, x0 + bw);
      const samples = [];
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * W + x) * 4;
          const luma = (px[i] * 2126 + px[i + 1] * 7152 + px[i + 2] * 722) / 10000;
          if (luma < threshold) continue;
          samples.push([px[i], px[i + 1], px[i + 2], luma]);
        }
      }
      const o = by * smallW + bx;
      if (samples.length > 0) {
        // медиана по яркости: средние 40–60% распределения = чистая бумага
        samples.sort((a, b) => a[3] - b[3]);
        const lo = Math.floor(samples.length * 0.4);
        const hi = Math.max(lo + 1, Math.ceil(samples.length * 0.6));
        let r = 0, g = 0, b = 0, n = 0;
        for (let k = lo; k < hi; k++) {
          r += samples[k][0]; g += samples[k][1]; b += samples[k][2]; n++;
        }
        grid[o * 3] = r / n; grid[o * 3 + 1] = g / n; grid[o * 3 + 2] = b / n;
        valid[o] = 1;
      }
    }
  }

  // дырки (стол, плотный текст) заполняем от валидных соседей
  for (let iter = 0; iter < 10; iter++) {
    let changed = false;
    for (let y = 0; y < smallH; y++) {
      for (let x = 0; x < smallW; x++) {
        const idx = y * smallW + x;
        if (valid[idx]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
        for (const [nx, ny] of nb) {
          if (nx < 0 || ny < 0 || nx >= smallW || ny >= smallH) continue;
          const ni = ny * smallW + nx;
          if (!valid[ni]) continue;
          r += grid[ni * 3]; g += grid[ni * 3 + 1]; b += grid[ni * 3 + 2]; n++;
        }
        if (n > 0) {
          grid[idx * 3] = r / n; grid[idx * 3 + 1] = g / n; grid[idx * 3 + 2] = b / n;
          valid[idx] = 1; changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // если дырки остались (всё изображение тёмное) — светлый фолбэк
  for (let idx = 0; idx < valid.length; idx++) {
    if (!valid[idx]) { grid[idx * 3] = 245; grid[idx * 3 + 1] = 242; grid[idx * 3 + 2] = 232; }
  }

  return { smallW, smallH, grid };
}

function sampleField(f, gx, gy, W, H) {
  const cx = Math.max(0, Math.min(W - 1, gx));
  const cy = Math.max(0, Math.min(H - 1, gy));
  const u = (cx / Math.max(1, W - 1)) * (f.smallW - 1);
  const v = (cy / Math.max(1, H - 1)) * (f.smallH - 1);
  const i = Math.min(f.smallW - 2, Math.max(0, Math.floor(u)));
  const j = Math.min(f.smallH - 2, Math.max(0, Math.floor(v)));
  const du = u - i, dv = v - j;
  const out = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const a = f.grid[(j * f.smallW + i) * 3 + ch];
    const b = f.grid[(j * f.smallW + i + 1) * 3 + ch];
    const c = f.grid[((j + 1) * f.smallW + i) * 3 + ch];
    const d = f.grid[((j + 1) * f.smallW + i + 1) * 3 + ch];
    out[ch] = a + (b - a) * du + (c - a) * dv + (a - b - c + d) * du * dv;
  }
  return out;
}

// Снаружи — линейная экстраполяция градиента освещения от края.
// Опорная точка ВСЕГДА внутри изображения, поэтому градиент корректно
// продолжается со ВСЕХ четырёх сторон (раньше сверху/слева он обнулялся).
function fieldSmart(f, gx, gy, W, H) {
  const m = Math.max(16, Math.min(W, H) * 0.06);
  const cx = Math.max(0, Math.min(W - 1, gx));
  const cy = Math.max(0, Math.min(H - 1, gy));
  const p00 = sampleField(f, cx, cy, W, H);
  const out = [p00[0], p00[1], p00[2]];

  if (gx !== cx) {
    // точка снаружи по X: опора внутри (с противоположной стороны от края)
    const rx = gx < cx ? Math.min(W - 1, cx + m) : Math.max(0, cx - m);
    const pr = sampleField(f, rx, cy, W, H);
    const denom = (cx - rx) || 1;
    for (let ch = 0; ch < 3; ch++) {
      const grad = (p00[ch] - pr[ch]) / denom; // прирост на px в направлении наружу
      out[ch] += grad * (gx - cx);
    }
  }
  if (gy !== cy) {
    // точка снаружи по Y: опора внутри
    const ry = gy < cy ? Math.min(H - 1, cy + m) : Math.max(0, cy - m);
    const pr = sampleField(f, cx, ry, W, H);
    const denom = (cy - ry) || 1;
    for (let ch = 0; ch < 3; ch++) {
      const grad = (p00[ch] - pr[ch]) / denom;
      out[ch] += grad * (gy - cy);
    }
  }
  return out;
}

// Карта бумаги для «Заливки»: освещение с учётом порога тёмных тонов
export function buildPaperField(base) {
  const px = getBasePixels(base);
  const f = buildBgFieldPx(px, base.width, base.height, cropState.bgThreshold);
  f.W = base.width; f.H = base.height;
  return f;
}

export function sampleFieldAt(f, x, y) {
  return sampleField(f, x, y, f.W, f.H);
}

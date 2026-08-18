// Путь: grid-math.js
// Маркеры стоят ТОЧНО на границах выделения пользователя.
// Режимы:
//  'rect'  — бикубический изгиб всей области; эффект полной силы внутри выделения
//            и в зоне «Смещения границ», наружу плавно гаснет («Радиус сглаживания»);
//  'radial'— радиальные эпицентры от смещённых маркеров + то же внешнее перо;
//  'tps'   — thin-plate spline + внешнее перо;
//  'free'  — СВОБОДНАЯ трансформация: без затухания и без ограничения рамкой/картинкой,
//            холст расширяется за исходные границы (края — репликация граничных пикселей).

export function generateWarpGridPoints(rect, gridSize) {
  // Маркеры — точно по рамке выделения
  const points = [];
  for (let r = 0; r < gridSize; r++) {
    const ty = gridSize > 1 ? r / (gridSize - 1) : 0;
    const row = [];
    for (let c = 0; c < gridSize; c++) {
      const tx = gridSize > 1 ? c / (gridSize - 1) : 0;
      row.push({ x: rect.x + rect.w * tx, y: rect.y + rect.h * ty, offsetX: 0, offsetY: 0 });
    }
    points.push(row);
  }
  return points;
}

export function hasAnyOffset(gridPoints, gridSize) {
  if (!gridPoints) return false;
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      if ((gridPoints[r][c].offsetX || 0) !== 0 || (gridPoints[r][c].offsetY || 0) !== 0) return true;
  return false;
}

// ---------- бикубический Катмулл-Ром по маркерам (экстраполяция за решётку) ----------
function crWeights(t) {
  return [
    -0.5 * t * t * t + t * t - 0.5 * t,
    1.5 * t * t * t - 2.5 * t * t + 1,
    -1.5 * t * t * t + 2 * t * t + 0.5 * t,
    0.5 * t * t * t - 0.5 * t * t
  ];
}

function bicubicOffset(gridPoints, n, u, v) {
  u = Math.max(0, Math.min(n - 1, u));
  v = Math.max(0, Math.min(n - 1, v));
  const i = Math.min(Math.floor(u), n - 2);
  const j = Math.min(Math.floor(v), n - 2);
  const wu = crWeights(u - i), wv = crWeights(v - j);
  let dx = 0, dy = 0;
  for (let a = 0; a < 4; a++) {
    const rr = Math.max(0, Math.min(n - 1, j + a - 1));
    for (let b = 0; b < 4; b++) {
      const cc = Math.max(0, Math.min(n - 1, i + b - 1));
      const w = wv[a] * wu[b];
      dx += (gridPoints[rr][cc].offsetX || 0) * w;
      dy += (gridPoints[rr][cc].offsetY || 0) * w;
    }
  }
  return { dx, dy };
}

function makeBicubicField(gridPoints, gridSize, rect) {
  return (x, y) => bicubicOffset(gridPoints, gridSize,
    rect.w > 0 ? ((x - rect.x) / rect.w) * (gridSize - 1) : 0,
    rect.h > 0 ? ((y - rect.y) / rect.h) * (gridSize - 1) : 0);
}

// ---------- радиальный режим ----------
function falloffWeight(dist, radiusAction, radiusSmooth) {
  if (dist <= radiusAction) return 1;
  if (radiusSmooth <= 0) return 0;
  const total = radiusAction + radiusSmooth;
  if (dist >= total) return 0;
  const t = (dist - radiusAction) / radiusSmooth;
  return 0.5 * (1 + Math.cos(Math.PI * t));
}

// ---------- TPS ----------
function solveTpsField(pts) {
  const n = pts.length, m = n + 3;
  const kernel = (r2) => (r2 <= 0 ? 0 : 0.5 * r2 * Math.log(r2));
  const A = [], BX = [], BY = [];
  for (let i = 0; i < m; i++) { A.push(new Array(m).fill(0)); BX.push(0); BY.push(0); }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
      A[i][j] = kernel(dx * dx + dy * dy);
    }
    A[i][n] = 1; A[i][n + 1] = pts[i].x; A[i][n + 2] = pts[i].y;
    A[n][i] = 1; A[n + 1][i] = pts[i].x; A[n + 2][i] = pts[i].y;
    BX[i] = pts[i].dx; BY[i] = pts[i].dy;
  }
  for (let col = 0; col < m; col++) {
    let piv = col;
    for (let r = col + 1; r < m; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-9) return null;
    if (piv !== col) {
      [A[piv], A[col]] = [A[col], A[piv]];
      [BX[piv], BX[col]] = [BX[col], BX[piv]];
      [BY[piv], BY[col]] = [BY[col], BY[piv]];
    }
    for (let r = col + 1; r < m; r++) {
      const k = A[r][col] / A[col][col];
      if (k === 0) continue;
      for (let c2 = col; c2 < m; c2++) A[r][c2] -= k * A[col][c2];
      BX[r] -= k * BX[col]; BY[r] -= k * BY[col];
    }
  }
  const X = new Array(m), Y = new Array(m);
  for (let i = m - 1; i >= 0; i--) {
    let sx = BX[i], sy = BY[i];
    for (let j = i + 1; j < m; j++) { sx -= A[i][j] * X[j]; sy -= A[i][j] * Y[j]; }
    X[i] = sx / A[i][i]; Y[i] = sy / A[i][i];
  }
  return (x, y) => {
    let dx = X[n] + X[n + 1] * x + X[n + 2] * y;
    let dy = Y[n] + Y[n + 1] * x + Y[n + 2] * y;
    for (let i = 0; i < n; i++) {
      const ddx = x - pts[i].x, ddy = y - pts[i].y;
      const w = kernel(ddx * ddx + ddy * ddy);
      dx += X[i] * w; dy += Y[i] * w;
    }
    return { dx, dy };
  };
}

// ---------- внешнее перо: 1 внутри расширенной области, косинусный спад НАРУЖУ ----------
function outerFeather(x, y, effRect, margin) {
  const d = Math.min(x - effRect.x, effRect.x + effRect.w - x, y - effRect.y, effRect.y + effRect.h - y);
  if (d >= 0) return 1;                       // внутри — полная сила
  if (margin <= 0 || -d >= margin) return 0;  // далеко снаружи — ноль
  const t = -d / margin;
  return 0.5 * (1 + Math.cos(Math.PI * t));   // плавный спад наружу
}

export function createDisplacementField(gridPoints, gridSize, rect, opts) {
  const mode = opts.mode || 'rect';
  const expand = Math.max(0, opts.expand || 0);
  const smooth = Math.max(0, opts.radiusSmooth || 0);
  const effRect = { x: rect.x - expand, y: rect.y - expand, w: rect.w + expand * 2, h: rect.h + expand * 2 };

  let inner;
  if (mode === 'radial') {
    inner = (x, y) => {
      let dx = 0, dy = 0;
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const m = gridPoints[r][c];
          const ox = m.offsetX || 0, oy = m.offsetY || 0;
          if (ox === 0 && oy === 0) continue;
          const dist = Math.hypot(x - (m.x + ox), y - (m.y + oy));
          const wgt = falloffWeight(dist, opts.radiusAction || 0, smooth);
          if (wgt <= 0) continue;
          dx += ox * wgt; dy += oy * wgt;
        }
      }
      return { dx, dy };
    };
  } else if (mode === 'tps') {
    const pts = [];
    for (let r = 0; r < gridSize; r++)
      for (let c = 0; c < gridSize; c++)
        pts.push({ x: gridPoints[r][c].x, y: gridPoints[r][c].y,
                   dx: gridPoints[r][c].offsetX || 0, dy: gridPoints[r][c].offsetY || 0 });
    inner = solveTpsField(pts) || makeBicubicField(gridPoints, gridSize, rect);
  } else {
    inner = makeBicubicField(gridPoints, gridSize, rect); // rect и free
  }

  if (mode === 'free') return inner; // без ограничений вообще

  const margin = Math.max(smooth, 2);
  return (x, y) => {
    const d = inner(x, y);
    const ef = outerFeather(x, y, effRect, margin);
    return { dx: d.dx * ef, dy: d.dy * ef };
  };
}

// ---------- база с репликацией краёв (для свободной трансформации) ----------
function makePaddedBase(img, P) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = W + 2 * P; c.height = H + 2 * P;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, P, P);
  ctx.drawImage(img, 0, 0, W, 1, P, 0, W, P);
  ctx.drawImage(img, 0, H - 1, W, 1, P, P + H, W, P);
  ctx.drawImage(img, 0, 0, 1, H, 0, P, P, H);
  ctx.drawImage(img, W - 1, 0, 1, H, P + W, P, P, H);
  ctx.drawImage(img, 0, 0, 1, 1, 0, 0, P, P);
  ctx.drawImage(img, W - 1, 0, 1, 1, P + W, 0, P, P);
  ctx.drawImage(img, 0, H - 1, 1, 1, 0, P + H, P, P);
  ctx.drawImage(img, W - 1, H - 1, 1, 1, P + W, P + H, P, P);
  return c;
}

function computeFreeBBox(fieldAt, cx0, cy0, cx1, cy1) {
  let x0 = cx0, y0 = cy0, x1 = cx1, y1 = cy1;
  const per = 16;
  for (let i = 0; i <= per; i++) {
    const t = i / per;
    const pts = [
      { x: cx0 + (cx1 - cx0) * t, y: cy0 }, { x: cx0 + (cx1 - cx0) * t, y: cy1 },
      { x: cx0, y: cy0 + (cy1 - cy0) * t }, { x: cx1, y: cy0 + (cy1 - cy0) * t }
    ];
    for (const p of pts) {
      const d = fieldAt(p.x, p.y);
      x0 = Math.min(x0, p.x + d.dx); y0 = Math.min(y0, p.y + d.dy);
      x1 = Math.max(x1, p.x + d.dx); y1 = Math.max(y1, p.y + d.dy);
    }
  }
  const pad = 4;
  return { x0: Math.floor(x0 - pad), y0: Math.floor(y0 - pad), x1: Math.ceil(x1 + pad), y1: Math.ceil(y1 + pad) };
}

// ---------- рендер: возвращает ОБЪЕКТ { canvas, ox, oy, free } ----------
export function renderWarpedDocument(img, gridPoints, gridSize, rect, opts) {
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const ss = opts.ss || 1;
  const free = (opts.mode === 'free');

  const field = createDisplacementField(gridPoints, gridSize, rect, opts);

  let srcImg = img, srcOffX = 0, srcOffY = 0, fieldOffX = 0, fieldOffY = 0;
  const P = 64;
  if (free) {
    srcImg = makePaddedBase(img, P);
    srcOffX = P; srcOffY = P; fieldOffX = -P; fieldOffY = -P;
  }
  const fieldAt = (sx, sy) => field(sx + fieldOffX, sy + fieldOffY);

  let rx0, ry0, rx1, ry1;
  if (free) {
    const bb = computeFreeBBox(fieldAt, P, P, P + W, P + H);
    rx0 = bb.x0; ry0 = bb.y0; rx1 = bb.x1; ry1 = bb.y1;
  } else {
    const expand = Math.max(0, opts.expand || 0);
    const margin = Math.max(opts.radiusSmooth || 0, 2);
    rx0 = Math.max(0, rect.x - expand - margin);
    ry0 = Math.max(0, rect.y - expand - margin);
    rx1 = Math.min(W, rect.x + rect.w + expand + margin);
    ry1 = Math.min(H, rect.y + rect.h + expand + margin);
  }

  const RW = Math.max(2, Math.round(rx1 - rx0));
  const RH = Math.max(2, Math.round(ry1 - ry0));

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(RW * ss));
  out.height = Math.max(1, Math.round(RH * ss));
  const ctx = out.getContext('2d');
  ctx.scale(ss, ss);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const cell = opts.cell || 16;
  let nX = Math.max(2, Math.round(RW / cell));
  let nY = Math.max(2, Math.round(RH / cell));
  const maxCells = opts.maxCells || 3000;
  if (nX * nY > maxCells) {
    const k = Math.sqrt(maxCells / (nX * nY));
    nX = Math.max(2, Math.floor(nX * k));
    nY = Math.max(2, Math.floor(nY * k));
  }
  const xs = new Array(nX + 1), ys = new Array(nY + 1);
  for (let i = 0; i <= nX; i++) xs[i] = rx0 + ((rx1 - rx0) * i) / nX;
  for (let j = 0; j <= nY; j++) ys[j] = ry0 + ((ry1 - ry0) * j) / nY;

  const cols = nX + 1, rows = nY + 1;
  const disp = new Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      disp[j * cols + i] = fieldAt(xs[i], ys[j]);

  const eps = 0.05;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const d00 = disp[j * cols + i],     d10 = disp[j * cols + i + 1];
      const d01 = disp[(j + 1) * cols + i], d11 = disp[(j + 1) * cols + i + 1];

      const active = free ||
        (Math.abs(d00.dx) + Math.abs(d00.dy) > eps || Math.abs(d10.dx) + Math.abs(d10.dy) > eps ||
         Math.abs(d01.dx) + Math.abs(d01.dy) > eps || Math.abs(d11.dx) + Math.abs(d11.dy) > eps);
      if (!active) continue;

      const x0 = xs[i],     y0 = ys[j];
      const x1 = xs[i + 1], y1 = ys[j];
      const x2 = xs[i],     y2 = ys[j + 1];
      const x3 = xs[i + 1], y3 = ys[j + 1];

      drawTextureTriangle(ctx, srcImg,
        x0 + d00.dx - rx0, y0 + d00.dy - ry0, x1 + d10.dx - rx0, y1 + d10.dy - ry0, x2 + d01.dx - rx0, y2 + d01.dy - ry0,
        x0 + srcOffX, y0 + srcOffY, x1 + srcOffX, y1 + srcOffY, x2 + srcOffX, y2 + srcOffY);
      drawTextureTriangle(ctx, srcImg,
        x1 + d10.dx - rx0, y1 + d10.dy - ry0, x3 + d11.dx - rx0, y3 + d11.dy - ry0, x2 + d01.dx - rx0, y2 + d01.dy - ry0,
        x1 + srcOffX, y1 + srcOffY, x3 + srcOffX, y3 + srcOffY, x2 + srcOffX, y2 + srcOffY);
    }
  }

  return { canvas: out, ox: free ? rx0 - P : rx0, oy: free ? ry0 - P : ry0, w: RW, h: RH, free };
}

function solveAffine(sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) {
  const det = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
  if (Math.abs(det) < 1e-6) return null;
  const a = ((dx1 - dx0) * (sy2 - sy0) - (dx2 - dx0) * (sy1 - sy0)) / det;
  const c = ((dx2 - dx0) * (sx1 - sx0) - (dx1 - dx0) * (sx2 - sx0)) / det;
  const e = dx0 - a * sx0 - c * sy0;
  const b = ((dy1 - dy0) * (sy2 - sy0) - (dy2 - dy0) * (sy1 - sy0)) / det;
  const d = ((dy2 - dy0) * (sx1 - sx0) - (dy1 - dy0) * (sx2 - sx0)) / det;
  const f = dy0 - b * sx0 - d * sy0;
  if ([a, b, c, d, e, f].some(isNaN)) return null;
  return [a, b, c, d, e, f];
}

function drawTextureTriangle(ctx, im, x0, y0, x1, y1, x2, y2, sx0, sy0, sx1, sy1, sx2, sy2) {
  const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
  const bleed = 0.35;
  const p0 = expandVertex(x0, y0, cx, cy, bleed);
  const p1 = expandVertex(x1, y1, cx, cy, bleed);
  const p2 = expandVertex(x2, y2, cx, cy, bleed);

  const t = solveAffine(sx0, sy0, sx1, sy1, sx2, sy2, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
  if (!t) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
  ctx.drawImage(im, 0, 0);
  ctx.restore();
}

function expandVertex(x, y, cx, cy, amt) {
  const dx = x - cx, dy = y - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x, y };
  return { x: x + (dx / len) * amt, y: y + (dy / len) * amt };
}
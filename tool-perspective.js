// Путь: tool-perspective.js
import { state, centerImage } from './state.js';

// ВАЖНО: панель живёт в партиале perspective/perspective.html и появляется
// ПОСЛЕ loadPartials(), поэтому ссылки на элементы берём ТОЛЬКО внутри initPerspectiveTool()
let toggleBtn = null, perspHint = null;
let inpTlx = null, inpTly = null, inpTrx = null, inpTry = null;
let inpBlx = null, inpBly = null, inpBrx = null, inpBry = null;

export let isSetupMode = true;
export let isShowTextLines = false;

export const perspState = {
  tl: { x: 0, y: 0 },
  tr: { x: 0, y: 0 },
  bl: { x: 0, y: 0 },
  br: { x: 0, y: 0 },
  activePoint: null,
  activeEdge: null,
  edgeDragLast: null
};

const PERSP_QUALITY = {
  draft:  { divs: 8,  ss: 1 },
  normal: { divs: 16, ss: 1 },
  high:   { divs: 24, ss: 2 },
  ultra:  { divs: 32, ss: 2 }
};

const PERSP_MARKER_SIZES = {
  small:  { marker: 8,  hit: 18 },
  medium: { marker: 12, hit: 25 },
  large:  { marker: 20, hit: 34 }
};

export function getPerspMarkerMetrics() {
  return PERSP_MARKER_SIZES[state.perspMarkerSize] || PERSP_MARKER_SIZES.medium;
}

export function getPerspDivs() {
  return (PERSP_QUALITY[state.perspQuality] || PERSP_QUALITY.normal).divs;
}

export function initPerspectiveTool() {
  // Элементы ищутся ЗДЕСЬ — editor.js вызывает init после loadPartials()
  toggleBtn = document.getElementById('persp-toggle-setup');
  perspHint = document.getElementById('persp-hint');
  inpTlx = document.getElementById('persp-tl-x'); inpTly = document.getElementById('persp-tl-y');
  inpTrx = document.getElementById('persp-tr-x'); inpTry = document.getElementById('persp-tr-y');
  inpBlx = document.getElementById('persp-bl-x'); inpBly = document.getElementById('persp-bl-y');
  inpBrx = document.getElementById('persp-br-x'); inpBry = document.getElementById('persp-br-y');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (!state.img) return;
      isSetupMode = !isSetupMode;
      if (isSetupMode) {
        toggleBtn.innerText = 'Режим: Настройка маркеров';
        toggleBtn.style.background = '#00ff99';
        toggleBtn.style.color = '#1e1e1e';
        toggleBtn.style.borderColor = '#00ff99';
        if (perspHint) perspHint.innerText = 'Сейчас углы рамки двигаются свободно. Разместите их на реальных углах искаженного документа.';
      } else {
        toggleBtn.innerText = 'Режим: Живое Искажение';
        toggleBtn.style.background = '#007acc';
        toggleBtn.style.color = '#fff';
        toggleBtn.style.borderColor = '#007acc';
        if (perspHint) perspHint.innerText = 'Тяните за углы! Изображение будет интерактивно деформироваться вслед за рамкой.';
      }
      state.render();
    });
  }

  if (document.getElementById('persp-toggle-lines')) {
    document.getElementById('persp-toggle-lines').addEventListener('click', (e) => {
      if (!state.img) return;
      isShowTextLines = !isShowTextLines;
      if (isShowTextLines) {
        e.target.innerText = 'Линии строк: Включены';
        e.target.style.background = '#ff3333';
        e.target.style.borderColor = '#ff3333';
        e.target.style.color = '#fff';
      } else {
        e.target.innerText = 'Включить горизонтальные линии (Выкл)';
        e.target.style.background = '#3c3c3c';
        e.target.style.borderColor = '#555';
        e.target.style.color = '#fff';
      }
      state.render();
    });
  }

  // Размер маркеров: 3 пресета
  ['small', 'medium', 'large'].forEach(key => {
    document.getElementById('persp-marker-' + key)?.addEventListener('click', () => {
      state.perspMarkerSize = key;
      updatePerspMarkerSizeUI();
      if (state.render) state.render();
    });
  });

  // Якоря исходного положения углов (вкл/выкл)
  document.getElementById('persp-toggle-anchors')?.addEventListener('click', (e) => {
    state.perspShowAnchors = !state.perspShowAnchors;
    if (state.perspShowAnchors) {
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

  // Качество рендера
  document.getElementById('persp-quality-select')?.addEventListener('change', (e) => {
    state.perspQuality = e.target.value;
    if (state.perspQuality === 'ultra') {
      setStatus('Перспектива: УЛЬТРА — максимальная нагрузка, только для мощного ПК.');
    } else if (state.perspQuality === 'high') {
      setStatus('Перспектива: высокое качество — повышенная нагрузка на ПК.');
    }
    if (state.render) state.render();
  });

  const resetBtn = document.getElementById('reset-perspective-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!state.img) return;
      updatePerspectiveInterface();
      state.render();
    });
  }

  const applyBtn = document.getElementById('apply-perspective-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (!state.img) return;
      bakePerspective();
    });
  }

  const updateFromInputs = () => {
    if (!state.img || !inpTlx || !inpTlx.value) return;
    perspState.tl = { x: parseFloat(inpTlx.value) || 0, y: parseFloat(inpTly.value) || 0 };
    perspState.tr = { x: parseFloat(inpTrx.value) || 0, y: parseFloat(inpTry.value) || 0 };
    perspState.bl = { x: parseFloat(inpBlx.value) || 0, y: parseFloat(inpBly.value) || 0 };
    perspState.br = { x: parseFloat(inpBrx.value) || 0, y: parseFloat(inpBry.value) || 0 };
    state.render();
  };

  if (inpTlx) {
    [inpTlx, inpTly, inpTrx, inpTry, inpBlx, inpBly, inpBrx, inpBry].forEach(inp => {
      inp.addEventListener('change', updateFromInputs);
    });
  }

  updatePerspMarkerSizeUI();
}

// Автоматический сброс инструмента в дефолтный режим настройки маркеров
export function updatePerspectiveInterface() {
  isSetupMode = true;

  if (state.img) {
    perspState.tl = { x: 0, y: 0 };
    perspState.tr = { x: state.img.width, y: 0 };
    perspState.bl = { x: 0, y: state.img.height };
    perspState.br = { x: state.img.width, y: state.img.height };
  }

  if (toggleBtn) {
    toggleBtn.innerText = 'Режим: Настройка маркеров';
    toggleBtn.style.background = '#00ff99';
    toggleBtn.style.color = '#1e1e1e';
    toggleBtn.style.borderColor = '#00ff99';
  }

  if (perspHint) {
    perspHint.innerText = 'Сейчас углы рамки двигаются свободно. Разместите их на реальных углах искаженного документа.';
  }

  isShowTextLines = false;
  const toggleLinesBtn = document.getElementById('persp-toggle-lines');
  if (toggleLinesBtn) {
    toggleLinesBtn.innerText = 'Включить горизонтальные линии (Выкл)';
    toggleLinesBtn.style.background = '#3c3c3c';
    toggleLinesBtn.style.borderColor = '#555';
    toggleLinesBtn.style.color = '#fff';
  }

  syncInputsWithState();
}

function updatePerspMarkerSizeUI() {
  ['small', 'medium', 'large'].forEach(key => {
    const b = document.getElementById('persp-marker-' + key);
    if (!b) return;
    const active = state.perspMarkerSize === key;
    b.className = active ? 'action-btn' : '';
    b.style.background = active ? '#007acc' : '#3c3c3c';
    b.style.borderColor = active ? '#007acc' : '#555';
    b.style.color = '#fff';
  });
}

function syncInputsWithState() {
  if (!inpTlx) return;
  inpTlx.value = Math.round(perspState.tl.x); inpTly.value = Math.round(perspState.tl.y);
  inpTrx.value = Math.round(perspState.tr.x); inpTry.value = Math.round(perspState.tr.y);
  inpBlx.value = Math.round(perspState.bl.x); inpBly.value = Math.round(perspState.bl.y);
  inpBrx.value = Math.round(perspState.br.x); inpBry.value = Math.round(perspState.br.y);
}

export function checkPerspectiveHandles(mouseX, mouseY) {
  if (!state.img) return false;
  const radius = getPerspMarkerMetrics().hit / state.zoom;
  for (const key of ['tl', 'tr', 'bl', 'br']) {
    if (Math.hypot(mouseX - perspState[key].x, mouseY - perspState[key].y) < radius) {
      perspState.activePoint = key;
      perspState.activeEdge = null;
      return true;
    }
  }
  // Захват за СТОРОНЫ рамки: двигаются оба угла этой стороны
  const edges = [
    { id: 'top',    a: perspState.tl, b: perspState.tr },
    { id: 'bottom', a: perspState.bl, b: perspState.br },
    { id: 'left',   a: perspState.tl, b: perspState.bl },
    { id: 'right',  a: perspState.tr, b: perspState.br }
  ];
  for (const e of edges) {
    if (distToSegment(mouseX, mouseY, e.a.x, e.a.y, e.b.x, e.b.y) < radius) {
      perspState.activeEdge = e.id;
      perspState.edgeDragLast = { x: mouseX, y: mouseY };
      perspState.activePoint = null;
      return true;
    }
  }
  return false;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function handlePerspectiveDrag(mouseX, mouseY) {
  // Тянем сторону: оба её угла получают приращение мыши
  if (perspState.activeEdge) {
    const last = perspState.edgeDragLast || { x: mouseX, y: mouseY };
    const dx = mouseX - last.x;
    const dy = mouseY - last.y;
    perspState.edgeDragLast = { x: mouseX, y: mouseY };
    const pairs = {
      top: ['tl', 'tr'],
      bottom: ['bl', 'br'],
      left: ['tl', 'bl'],
      right: ['tr', 'br']
    };
    (pairs[perspState.activeEdge] || []).forEach(k => {
      perspState[k].x += dx;
      perspState[k].y += dy;
    });
    syncInputsWithState();
    return;
  }
  if (!perspState.activePoint) return;
  perspState[perspState.activePoint].x = mouseX;
  perspState[perspState.activePoint].y = mouseY;
  syncInputsWithState();
}

// Bleeding 0.75px: соседние треугольники перекрываются — диагональные швы исчезают
function drawSubTriangle(ctx, imgObj, s0, s1, s2, d0, d1, d2) {
  const cx = (d0.x + d1.x + d2.x) / 3;
  const cy = (d0.y + d1.y + d2.y) / 3;
  const p0 = expandVertex(d0, cx, cy, 0.75);
  const p1 = expandVertex(d1, cx, cy, 0.75);
  const p2 = expandVertex(d2, cx, cy, 0.75);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();

  const delta = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(delta) < 0.001) { ctx.restore(); return; }

  const a = (p0.x * (s1.y - s2.y) + p1.x * (s2.y - s0.y) + p2.x * (s0.y - s1.y)) / delta;
  const b = (p0.y * (s1.y - s2.y) + p1.y * (s2.y - s0.y) + p2.y * (s0.y - s1.y)) / delta;
  const c = (p0.x * (s2.x - s1.x) + p1.x * (s0.x - s2.x) + p2.x * (s1.x - s0.x)) / delta;
  const d = (p0.y * (s2.x - s1.x) + p1.y * (s0.x - s2.x) + p2.y * (s1.x - s0.x)) / delta;
  const e = (p0.x * (s1.x * s2.y - s2.x * s1.y) + p1.x * (s2.x * s0.y - s0.x * s2.y) + p2.x * (s0.x * s1.y - s1.x * s0.y)) / delta;
  const f = (p0.y * (s1.x * s2.y - s2.x * s1.y) + p1.y * (s2.x * s0.y - s0.x * s2.y) + p2.y * (s0.x * s1.y - s1.x * s0.y)) / delta;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(imgObj, 0, 0);
  ctx.restore();
}

function expandVertex(p, cx, cy, amt) {
  const dx = p.x - cx, dy = p.y - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: p.x, y: p.y };
  return { x: p.x + (dx / len) * amt, y: p.y + (dy / len) * amt };
}

function generateGridPoints(quad, divs) {
  const grid = [];
  for (let r = 0; r <= divs; r++) {
    const t = r / divs;
    const left = { x: quad.tl.x + (quad.bl.x - quad.tl.x) * t, y: quad.tl.y + (quad.bl.y - quad.tl.y) * t };
    const right = { x: quad.tr.x + (quad.br.x - quad.tr.x) * t, y: quad.tr.y + (quad.br.y - quad.tr.y) * t };
    const row = [];
    for (let c = 0; c <= divs; c++) {
      const k = c / divs;
      row.push({ x: left.x + (right.x - left.x) * k, y: left.y + (right.y - left.y) * k });
    }
    grid.push(row);
  }
  return grid;
}

export function renderPerspectiveMesh(ctx, imgObj, srcQuad, destQuad) {
  const divs = getPerspDivs();
  const srcGrid = generateGridPoints(srcQuad, divs);
  const destGrid = generateGridPoints(destQuad, divs);

  for (let r = 0; r < divs; r++) {
    for (let c = 0; c < divs; c++) {
      drawSubTriangle(ctx, imgObj, srcGrid[r][c], srcGrid[r][c + 1], srcGrid[r + 1][c], destGrid[r][c], destGrid[r][c + 1], destGrid[r + 1][c]);
      drawSubTriangle(ctx, imgObj, srcGrid[r][c + 1], srcGrid[r + 1][c + 1], srcGrid[r + 1][c], destGrid[r][c + 1], destGrid[r + 1][c + 1], destGrid[r + 1][c]);
    }
  }
}

function bakePerspective() {
  const w = state.img.width, h = state.img.height;
  const q = PERSP_QUALITY[state.perspQuality] || PERSP_QUALITY.normal;

  let srcQuad, destQuad, outW, outH, offX = 0, offY = 0;

  if (isSetupMode) {
    const w1 = Math.hypot(perspState.tr.x - perspState.tl.x, perspState.tr.y - perspState.tl.y);
    const w2 = Math.hypot(perspState.br.x - perspState.bl.x, perspState.br.y - perspState.bl.y);
    const h1 = Math.hypot(perspState.bl.x - perspState.tl.x, perspState.bl.y - perspState.tl.y);
    const h2 = Math.hypot(perspState.br.x - perspState.tr.x, perspState.br.y - perspState.tr.y);

    outW = Math.round(Math.max(w1, w2));
    outH = Math.round(Math.max(h1, h2));

    srcQuad = { tl: perspState.tl, tr: perspState.tr, bl: perspState.bl, br: perspState.br };
    destQuad = { tl: { x: 0, y: 0 }, tr: { x: outW, y: 0 }, bl: { x: 0, y: outH }, br: { x: outW, y: outH } };
  } else {
    const minX = Math.min(perspState.tl.x, perspState.bl.x, 0);
    const maxX = Math.max(perspState.tr.x, perspState.br.x, w);
    const minY = Math.min(perspState.tl.y, perspState.tr.y, 0);
    const maxY = Math.max(perspState.bl.y, perspState.br.y, h);

    outW = Math.round(maxX - minX);
    outH = Math.round(maxY - minY);
    offX = -minX;
    offY = -minY;

    srcQuad = { tl: { x: 0, y: 0 }, tr: { x: w, y: 0 }, bl: { x: 0, y: h }, br: { x: w, y: h } };
    destQuad = { tl: perspState.tl, tr: perspState.tr, bl: perspState.bl, br: perspState.br };
  }

  const workCanvas = document.createElement('canvas');
  workCanvas.width = outW * q.ss;
  workCanvas.height = outH * q.ss;
  const workCtx = workCanvas.getContext('2d');
  workCtx.scale(q.ss, q.ss);
  if (offX || offY) workCtx.translate(offX, offY);
  renderPerspectiveMesh(workCtx, state.img, srcQuad, destQuad);

  let finalCanvas = workCanvas;
  if (q.ss > 1) {
    finalCanvas = document.createElement('canvas');
    finalCanvas.width = outW;
    finalCanvas.height = outH;
    const fctx = finalCanvas.getContext('2d');
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = 'high';
    fctx.drawImage(workCanvas, 0, 0, outW, outH);
  }

  state.img = finalCanvas;
  updatePerspectiveInterface();
  centerImage();
  setStatus(`Перспектива: запечено (${finalCanvas.width}x${finalCanvas.height} px, качество "${state.perspQuality}", без потерь).`);
  state.render();
}

function setStatus(text) {
  const el = document.getElementById('status-message');
  if (el) el.innerText = text;
}

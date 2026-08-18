// Путь: color-brush.js
// Слой 5: ретушь-кисть. Штрихи хранятся списком (недеструктивно) и
// применяются к данным конвейера; авто-режимы решают по БАЗОВОМУ снимку.
import { state } from '../state.js';
import { colorState } from './color-state.js';

let strokes = [];
let currentStroke = null;
let drawing = false;

let historyStack = [];
let redoStack = [];

export function isColorBrushDrawing() { return drawing; }

export function clearBrushStrokes() {
  strokes = [];
  currentStroke = null;
  drawing = false;
  historyStack = [];
  redoStack = [];
}

// ---------- Undo / Redo ----------

function snapshotStrokes() {
  return strokes.map(s => ({ dabs: s.dabs.map(d => ({ ...d })) }));
}

function pushHistory() {
  historyStack.push(snapshotStrokes());
  if (historyStack.length > (colorState.brushHistoryMax || 5)) historyStack.shift();
  redoStack.length = 0;
}

export function brushUndo() {
  if (!historyStack.length) return false;
  redoStack.push(snapshotStrokes());
  strokes = historyStack.pop();
  currentStroke = null;
  drawing = false;
  return true;
}

export function brushRedo() {
  if (!redoStack.length) return false;
  historyStack.push(snapshotStrokes());
  if (historyStack.length > (colorState.brushHistoryMax || 5)) historyStack.shift();
  strokes = redoStack.pop();
  currentStroke = null;
  drawing = false;
  return true;
}

export function getHistoryCounts() {
  return { undo: historyStack.length, redo: redoStack.length };
}

// ---------- рисование ----------

export function brushBegin(imgX, imgY) {
  if (!colorState.brushOn || !state.img) return false;
  redoStack.length = 0;
  drawing = true;
  currentStroke = { dabs: [] };
  addDab(imgX, imgY);
  return true;
}

export function brushMove(imgX, imgY) {
  if (!drawing || !currentStroke) return;
  const last = currentStroke.dabs[currentStroke.dabs.length - 1];
  const from = last ? { x: last.x, y: last.y } : { x: imgX, y: imgY };
  const dist = Math.hypot(imgX - from.x, imgY - from.y);
  const step = Math.max(2, colorState.brushRadius / 3);
  const n = Math.max(1, Math.floor(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    addDab(from.x + (imgX - from.x) * t, from.y + (imgY - from.y) * t);
  }
}

export function brushEnd() {
  if (drawing && currentStroke && currentStroke.dabs.length) {
    pushHistory();
    strokes.push(currentStroke);
  }
  drawing = false;
  currentStroke = null;
}

function addDab(x, y) {
  currentStroke.dabs.push({
    x, y,
    r: colorState.brushRadius,
    mode: colorState.brushMode,
    str: Math.max(0, Math.min(100, colorState.brushStrength)) / 100,
    thr: colorState.brushThreshold,
    prt: colorState.brushProtect ?? 100
  });
}

// Применение всех штрихов к данным конвейера
export function applyStrokesToData(data, W, H, baseData, baseW, baseH) {
  const all = currentStroke ? strokes.concat([currentStroke]) : strokes;
  for (const s of all) {
    for (const dab of s.dabs) applyDab(data, W, H, baseData, baseW, baseH, dab);
  }
}

function applyDab(data, W, H, baseData, baseW, baseH, dab) {
  const r = dab.r;
  const x0 = Math.max(0, Math.floor(dab.x - r));
  const x1 = Math.min(W - 1, Math.ceil(dab.x + r));
  const y0 = Math.max(0, Math.floor(dab.y - r));
  const y1 = Math.min(H - 1, Math.ceil(dab.y + r));

  // АВТО 2: локальная яркость бумаги по базовому снимку (светлейшая четверть проб)
  let paper = 255;
  if (dab.mode === 'auto2') {
    const samples = [];
    const step = Math.max(1, Math.round(r / 4));
    for (let sy = y0; sy <= y1; sy += step) {
      for (let sx = x0; sx <= x1; sx += step) {
        const bi = (Math.min(baseH - 1, sy) * baseW + Math.min(baseW - 1, sx)) * 4;
        samples.push((baseData[bi] * 2126 + baseData[bi + 1] * 7152 + baseData[bi + 2] * 722) / 10000);
      }
    }
    if (samples.length) {
      samples.sort((a, b) => a - b);
      const q = Math.max(0, Math.floor(samples.length * 0.75));
      let s = 0, n = 0;
      for (let i = q; i < samples.length; i++) { s += samples[i]; n++; }
      if (n) paper = s / n;
    }
  }

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - dab.x, y - dab.y);
      if (d > r) continue;
      const w = 0.5 * (1 + Math.cos(Math.PI * d / r)) * dab.str;
      if (w <= 0.01) continue;

      let target;
      let m = 1;
      if (dab.mode === 'bg') target = 255;
      else if (dab.mode === 'text') target = 0;
      else {
        const bx = Math.min(baseW - 1, Math.max(0, x));
        const by = Math.min(baseH - 1, Math.max(0, y));
        const bi = (by * baseW + bx) * 4;
        const luma = (baseData[bi] * 2126 + baseData[bi + 1] * 7152 + baseData[bi + 2] * 722) / 10000;

        if (dab.mode === 'auto2') {
          // текст (темнее paper - prt) НЕ тронут; около бумаги — целиком;
          // между ними — smoothstep, сохраняющий градиентные переходы букв
          const lo = paper - Math.max(8, dab.prt);
          const hi = paper - 6;
          if (luma <= lo) continue;
          if (luma >= hi) m = 1;
          else { const q = (luma - lo) / (hi - lo); m = q * q * (3 - 2 * q); }
          target = 255;
        } else {
          target = luma >= dab.thr ? 255 : 0;
        }
      }

      const we = Math.min(1, w * m); // страховка от «перелёта» через цель
      if (we <= 0.01) continue;
      const j = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        data[j + ch] += (target - data[j + ch]) * we;
      }
    }
  }
}

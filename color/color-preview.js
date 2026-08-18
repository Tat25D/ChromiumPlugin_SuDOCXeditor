import { state } from '../state.js';
import { colorState } from './color-state.js';
import { applyLeveling, applyBradley, applyGray, applyBC } from './color-math.js';
import { applyStrokesToData } from './color-brush.js';

let previewCanvas = null;
let previewDirty = true;
let previewKey = null;
let pixelsCache = null;
let pixelsKey = null;
let rafPending = false;

export function invalidateColorCache() { previewDirty = true; }

export function requestColorRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (state.render) state.render();
  });
}

// Неразрушающий предпросмотр для renderer.js
export function getColorPreviewCanvas() {
  if (!state.img) return null;
  if (colorState.bypass) return null; // «Без эффектов»: рисуем чистый оригинал
  const base = state.originalCanvas;
  if (base && base !== previewKey) previewDirty = true;
  if (!previewDirty && previewCanvas) return previewCanvas;
  return recomputePreview();
}

function recomputePreview() {
  const base = ensureBase();
  if (!base) return null;
  const src = getBasePixels(base);
  const W = src.width, H = src.height;
  const data = new Uint8ClampedArray(src.data);

  if (colorState.levelOn) applyLeveling(data, W, H, colorState);
  if (colorState.ocrOn)   applyBradley(data, W, H, colorState);
  if (colorState.grayOn)  applyGray(data, W, H, colorState.grayStrength);
  if (colorState.bcOn)    applyBC(data, W, H, colorState);
  applyStrokesToData(data, W, H, src.data, W, H);

  previewCanvas = document.createElement('canvas');
  previewCanvas.width = W;
  previewCanvas.height = H;
  previewCanvas.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0);
  previewKey = base;
  previewDirty = false;
  return previewCanvas;
}

function ensureBase() {
  if (state.originalCanvas) return state.originalCanvas;
  if (!state.img) return null;
  const c = document.createElement('canvas');
  c.width = state.img.width;
  c.height = state.img.height;
  c.getContext('2d').drawImage(state.img, 0, 0);
  state.originalCanvas = c;
  return c;
}

function getBasePixels(base) {
  if (pixelsKey === base) return pixelsCache;
  pixelsCache = base.getContext('2d').getImageData(0, 0, base.width, base.height);
  pixelsKey = base;
  return pixelsCache;
}

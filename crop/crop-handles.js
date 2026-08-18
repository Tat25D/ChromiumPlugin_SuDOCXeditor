import { state } from '../state.js';
import { cropState, cropRect, getCropMarkerMetrics, cropFlags } from './crop-state.js';
import { invalidateMargin } from './crop-margins.js';

export function checkCropHandles(imgX, imgY) {
  if (!state.img) return false;
  const r = cropRect();
  const rad = getCropMarkerMetrics().hit / state.zoom;

  const corners = { tl: [r.x1, r.y1], tr: [r.x2, r.y1], bl: [r.x1, r.y2], br: [r.x2, r.y2] };
  for (const k in corners) {
    if (Math.hypot(imgX - corners[k][0], imgY - corners[k][1]) <= rad) {
      cropState.activeHandle = k;
      return true;
    }
  }

  const edges = [
    ['top',    r.x1, r.y1, r.x2, r.y1],
    ['bottom', r.x1, r.y2, r.x2, r.y2],
    ['left',   r.x1, r.y1, r.x1, r.y2],
    ['right',  r.x2, r.y1, r.x2, r.y2]
  ];
  for (const [k, ax, ay, bx, by] of edges) {
    if (distToSeg(imgX, imgY, ax, ay, bx, by) <= rad) {
      cropState.activeHandle = k;
      return true;
    }
  }
  return false;
}

export function handleCropDrag(imgX, imgY) {
  if (!cropState.activeHandle || !state.img) return;
  const W = state.img.width, H = state.img.height;
  const maxExt = Math.max(W, H);
  const loX = cropState.extend ? -maxExt : 0;
  const hiX = cropState.extend ? W + maxExt : W;
  const loY = cropState.extend ? -maxExt : 0;
  const hiY = cropState.extend ? H + maxExt : H;
  const cl = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const h = cropState.activeHandle;

  if (h === 'tl' || h === 'bl' || h === 'left')  cropState.x1 = cl(imgX, loX, cropState.x2 - 8);
  if (h === 'tr' || h === 'br' || h === 'right') cropState.x2 = cl(imgX, cropState.x1 + 8, hiX);
  if (h === 'tl' || h === 'tr' || h === 'top')   cropState.y1 = cl(imgY, loY, cropState.y2 - 8);
  if (h === 'bl' || h === 'br' || h === 'bottom') cropState.y2 = cl(imgY, cropState.y1 + 8, hiY);

  if (cropFlags.interactive) invalidateMargin();
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

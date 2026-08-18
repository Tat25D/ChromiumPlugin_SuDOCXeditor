import { state } from '../state.js';

export const cropState = {
  x1: 0, y1: 0, x2: 0, y2: 0,
  activeHandle: null,
  extend: true,
  fillColor: 'bg',
  bgThreshold: 0,    // порог тёмных тонов
  gradStrength: 100, // учёт градиента освещения
  fillOpacity: 100,  // прозрачность эффекта
  tone: 0,           // тон заливки
  clean: 100,        // очистка от остатков текста
  overlap: 2         // захват кромки внутрь оригинала
};

export const cropFlags = { get interactive() { return state.interactive; } };

const CROP_MARKER_SIZES = {
  small:  { marker: 6,  hit: 10 },
  medium: { marker: 10, hit: 18 },
  large:  { marker: 16, hit: 30 }
};

export function getCropMarkerMetrics() {
  return CROP_MARKER_SIZES[state.markerSize] || CROP_MARKER_SIZES.medium;
}

export function cropRect() {
  return {
    x1: Math.min(cropState.x1, cropState.x2),
    y1: Math.min(cropState.y1, cropState.y2),
    x2: Math.max(cropState.x1, cropState.x2),
    y2: Math.max(cropState.y1, cropState.y2)
  };
}

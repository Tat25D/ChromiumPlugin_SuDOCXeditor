// Путь: tool-crop.js
export { cropState, cropFlags, getCropMarkerMetrics, cropRect } from './crop/crop-state.js';
export { getMarginCanvas, updateCropInterface, invalidateMargin, clearBaseCache } from './crop/crop-margins.js';
export { checkCropHandles, handleCropDrag } from './crop/crop-handles.js';
export { initCropTool } from './crop/crop-ui.js';
export { cropFillState, resetFillStroke, fillClick, fillClosePoly, fillStartRect, fillMove, fillEndRect } from './crop/crop-fill.js';

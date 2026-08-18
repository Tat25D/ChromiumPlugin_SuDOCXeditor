// Путь: tool-color.js
// Тонкий оркестратор: ре-экспорты, чтобы editor.js / renderer.js / camera.js
// продолжали импортировать из одного места.
export { colorState } from './color/color-state.js';
export { initColorTool } from './color/color-ui.js';
export { getColorPreviewCanvas, invalidateColorCache, requestColorRender } from './color/color-preview.js';
export { brushBegin as colorBrushBegin, brushMove as colorBrushMove, brushEnd as colorBrushEnd, isColorBrushDrawing, clearBrushStrokes, brushUndo, brushRedo, getHistoryCounts } from './color/color-brush.js';

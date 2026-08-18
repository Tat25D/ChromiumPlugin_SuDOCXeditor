// Путь: camera.js
import { state } from './state.js';
import { checkCropHandles, handleCropDrag, cropState, cropFillState, fillClick, fillClosePoly, fillStartRect, fillMove, fillEndRect } from './tool-crop.js';
import { checkPerspectiveHandles, handlePerspectiveDrag, perspState } from './tool-perspective.js';
import { checkGridHandles, completeGridDefine, invalidateGridCache, requestGridRender } from './tool-grid.js';
import { colorState, colorBrushBegin, colorBrushMove, colorBrushEnd, isColorBrushDrawing, invalidateColorCache, requestColorRender } from './tool-color.js';
import { markerState, markerBegin, markerMove, markerEnd, isMarkerDrawing, isMarkerTextDragging, setMarkerCursor } from './tool-marker.js';

export function initCamera(workspace, canvas, statusZoom, statusCoords) {

  // Удержанный Space — временная «рука»: двигает картинку в любом инструменте
  let spaceDown = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      spaceDown = true;
      if (e.target === document.body) e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spaceDown = false;
  });

  // Уводим курсор с холста — прячем контуры кистей
  workspace.addEventListener('mouseleave', () => {
    setMarkerCursor(null);
    if (colorState) colorState.cursorPos = null;
    if (state.render) state.render();
  });

  // Гасим контекстное меню в режиме заливки (ПКМ замыкает ломаную)
  workspace.addEventListener('contextmenu', (e) => {
    const t = document.querySelector('.tool-btn.active')?.getAttribute('data-tool');
    if (t === 'crop' && cropFillState.enabled) e.preventDefault();
  });

  // Уводим курсор с холста — прячем контур кисти ретуши
  workspace.addEventListener('mouseleave', () => {
    if(colorState) colorState.cursorPos = null;
  });

  // Мышь: начало панорамирования, выделения рамки, захвата маркеров или кисти
  workspace.addEventListener('mousedown', (e) => {
    if (e.target.closest('.zoom-controls')) return;

    const activeToolElement = document.querySelector('.tool-btn.active');
    const activeTool = activeToolElement ? activeToolElement.getAttribute('data-tool') : '';

    // ПКМ — только замкнуть ломаную в режиме заливки
    if (e.button === 2) {
      if (activeTool === 'crop' && cropFillState.enabled && cropFillState.mode === 'poly') {
        e.preventDefault();
        fillClosePoly();
      }
      return;
    }
    // ПКМ — только замкнуть ломаную в режиме заливки
    if (e.button === 2) {
      if (activeTool === 'crop' && cropFillState.enabled && cropFillState.mode === 'poly') {
        e.preventDefault();
        fillClosePoly();
      }
      return;
    }
    if (e.button !== 0 && e.button !== 1) return; // ЛКМ или средняя кнопка
    if (e.button === 1) e.preventDefault(); // гасим автоскролл средней кнопки

    // ПКМ — только замкнуть ломаную в режиме заливки
    if (e.button === 2) {
      if (activeTool === 'crop' && cropFillState.enabled && cropFillState.mode === 'poly') {
        e.preventDefault();
        fillClosePoly();
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - state.panX) / state.zoom;
    const mouseY = (e.clientY - rect.top - state.panY) / state.zoom;

    const imgX = mouseX + (state.img ? state.img.width / 2 : 0);
    const imgY = mouseY + (state.img ? state.img.height / 2 : 0);

    if (activeTool === 'grid') {
      if (state.isGridDefining) {
        state.gridDefStart = { x: imgX, y: imgY };
        state.gridDefEnd = { x: imgX, y: imgY };
      } else if (state.gridPoints && checkGridHandles(imgX, imgY)) {
        const { r, c } = state.gridActivePoint;
        const pt = state.gridPoints[r][c];
        state.isDraggingGridPoint = true;
        state.gridGrab = {
          r, c,
          startMouseX: imgX,
          startMouseY: imgY,
          startOffsetX: pt.offsetX || 0,
          startOffsetY: pt.offsetY || 0
        };
        state.render();
      } else {
        state.isDragging = true;
        state.startX = e.clientX - state.panX;
        state.startY = e.clientY - state.panY;
      }
    } else if (activeTool === 'perspective') {
      if (checkPerspectiveHandles(imgX, imgY)) {
        state.isDraggingPerspective = true;
        state.render();
      } else {
        state.isDragging = true;
        state.startX = e.clientX - state.panX;
        state.startY = e.clientY - state.panY;
      }
    } else if (activeTool === 'crop') {
      if (cropFillState.enabled && e.button === 0) {
        // режим заливки: выделение вместо рамки
        if (cropFillState.mode === 'rect') fillStartRect(imgX, imgY);
        else fillClick(imgX, imgY);
        fillMove(imgX, imgY);
      } else if (!cropFillState.enabled && checkCropHandles(imgX, imgY)) {
        state.isDraggingCrop = true;
        state.render();
      } else {
        state.isDragging = true;
        state.startX = e.clientX - state.panX;
        state.startY = e.clientY - state.panY;
      }
    } else if (activeTool === 'color') {
      // ЛКМ рисует кистью слоя 5 (если включена); Space/средняя — панорама
      if (!spaceDown && e.button === 0 && colorState.brushOn && colorBrushBegin(imgX, imgY)) {
        // начат штрих ретушь-кисти — панорамирование не запускаем
      } else {
        state.isDragging = true;
        state.startX = e.clientX - state.panX;
        state.startY = e.clientY - state.panY;
      }
    } else if (activeTool === 'marker') {
      // ЛКМ РИСУЕТ; Space / средняя кнопка / режим «рука» — двигают картинку
      const wantPan = spaceDown || e.button === 1 || markerState.panMode;
      if (!wantPan && markerBegin(imgX, imgY, e.shiftKey)) {
        // начат штрих маркера — панорамирование не запускаем
      } else {
        state.isDragging = true;
        state.startX = e.clientX - state.panX;
        state.startY = e.clientY - state.panY;
      }
    } else {
      state.isDragging = true;
      state.startX = e.clientX - state.panX;
      state.startY = e.clientY - state.panY;
    }
  });

  // Мышь: перемещение, растягивание, деформация, рисование
  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - state.panX) / state.zoom;
    const mouseY = (e.clientY - rect.top - state.panY) / state.zoom;

    const imgX = mouseX + (state.img ? state.img.width / 2 : 0);
    const imgY = mouseY + (state.img ? state.img.height / 2 : 0);

    if (state.img && imgX >= 0 && imgX <= state.img.width && imgY >= 0 && imgY <= state.img.height) {
      if (statusCoords) statusCoords.innerText = `X: ${Math.round(imgX)} Y: ${Math.round(imgY)}`;
    }

    const activeToolElement = document.querySelector('.tool-btn.active');
    const activeTool = activeToolElement ? activeToolElement.getAttribute('data-tool') : '';

    // Растягивание рамки выделения области решётки
    if (activeTool === 'grid' && state.isGridDefining && state.gridDefStart) {
      state.gridDefEnd = { x: imgX, y: imgY };
      state.render();
      return;
    }

    // Решётка: маркер НЕПОДВИЖЕН, мышь накапливает вектор смещения бумаги
    if (state.isDraggingGridPoint && state.gridGrab && state.gridPoints) {
      const g = state.gridGrab;
      const pt = state.gridPoints[g.r][g.c];
      pt.offsetX = g.startOffsetX + (imgX - g.startMouseX);
      pt.offsetY = g.startOffsetY + (imgY - g.startMouseY);
      invalidateGridCache();
      requestGridRender();
      return;
    }

    // Цвет: ретушь-кисть (слой 5)
    if (activeTool === 'color' && isColorBrushDrawing()) {
      colorState.cursorPos = { x: imgX, y: imgY };
      colorBrushMove(imgX, imgY);
      // в эконом-режиме живой пересчёт не делаем — один раз по отпускании мыши
      if (colorState.interactive) {
        invalidateColorCache();
        requestColorRender();
      }
      return;
    }

    // Цвет: контур ретушь-кисти под курсором
    if (activeTool === 'color' && colorState.brushOn) {
      colorState.cursorPos = { x: imgX, y: imgY };
      requestColorRender();
    }

    // Маркер: видимый контур кисти под курсором
    if (activeTool === 'marker') setMarkerCursor(imgX, imgY);

    // Цвет: контур кисти ретуши (Слой 5)
    if(activeTool==='color' && colorState.brushOn){
      colorState.cursorPos = { x: imgX, y: imgY };
      if(state.render) state.render();
    }

    // Маркер: рисование штриха ИЛИ перетаскивание текста
    if (activeTool === 'marker' && (isMarkerDrawing() || isMarkerTextDragging())) {
      markerMove(imgX, imgY);
      return;
    }

    if (state.isDraggingPerspective) {
      handlePerspectiveDrag(imgX, imgY);
      state.render();
      return;
    }

    // Заливка: трекинг курсора / растягивание прямоугольника
    if (activeTool === 'crop' && cropFillState.enabled) {
      fillMove(imgX, imgY);
      state.render();
    }

    // Заливка: трекинг курсора / растягивание прямоугольника
    if (activeTool === 'crop' && cropFillState.enabled) {
      fillMove(imgX, imgY);
      state.render();
    }

    if (state.isDraggingCrop) {
      handleCropDrag(imgX, imgY);
      state.render();
      return;
    }

    if (!state.isDragging) return;
    state.panX = e.clientX - state.startX;
    state.panY = e.clientY - state.startY;
    state.render();
  });

  window.addEventListener('mouseup', () => {
    const activeToolElement = document.querySelector('.tool-btn.active');
    const activeTool = activeToolElement ? activeToolElement.getAttribute('data-tool') : '';

    // Завершение выделения области решётки: строим сетку маркеров
    if (activeTool === 'grid' && state.isGridDefining) {
      completeGridDefine();
    }

    state.isDragging = false;
    state.isDraggingCrop = false;
    state.isDraggingPerspective = false;
    state.isDraggingGridPoint = false;
    state.gridGrab = null;

    if (cropState) cropState.activeHandle = null;
    if (perspState) {
      perspState.activePoint = null;
      perspState.activeEdge = null;
      perspState.edgeDragLast = null;
    }

    if (activeTool === 'crop' && cropFillState.enabled) fillEndRect();

    const wasBrushDrawing = isColorBrushDrawing();
    colorBrushEnd();
    if (wasBrushDrawing && !colorState.interactive) {
      invalidateColorCache();
      requestColorRender();
    }
    markerEnd();
    state.render();
  });

  // Зум колесом относительно курсора
  workspace.addEventListener('wheel', (e) => {
    if (e.target.closest('.zoom-controls')) return;
    e.preventDefault();
    const zoomFactor = 1.1;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const wheel = e.deltaY < 0 ? 1 : -1;

    let newZoom = wheel > 0 ? state.zoom * zoomFactor : state.zoom / zoomFactor;
    newZoom = Math.max(0.05, Math.min(20, newZoom));

    state.panX = mouseX - (mouseX - state.panX) * (newZoom / state.zoom);
    state.panY = mouseY - (mouseY - state.panY) * (newZoom / state.zoom);
    state.zoom = newZoom;

    const el = document.getElementById('status-zoom');
    if (el) el.innerText = `Зум: ${Math.round(state.zoom * 100)}%`;
    state.render();
  }, { passive: false });

  document.getElementById('canvas-zoom-in')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const oldZoom = state.zoom;
    state.zoom = Math.min(20, state.zoom * 1.25);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    state.panX = centerX - (centerX - state.panX) * (state.zoom / oldZoom);
    state.panY = centerY - (centerY - state.panY) * (state.zoom / oldZoom);
    const el = document.getElementById('status-zoom');
    if (el) el.innerText = `Зум: ${Math.round(state.zoom * 100)}%`;
    state.render();
  });

  document.getElementById('canvas-zoom-out')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const oldZoom = state.zoom;
    state.zoom = Math.max(0.05, state.zoom / 1.25);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    state.panX = centerX - (centerX - state.panX) * (state.zoom / oldZoom);
    state.panY = centerY - (centerY - state.panY) * (state.zoom / oldZoom);
    const el = document.getElementById('status-zoom');
    if (el) el.innerText = `Зум: ${Math.round(state.zoom * 100)}%`;
    state.render();
  });

  document.getElementById('canvas-zoom-reset')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.zoom = 1;
    state.panX = canvas.width / 2;
    state.panY = canvas.height / 2;
    const el = document.getElementById('status-zoom');
    if (el) el.innerText = 'Зум: 100%';
    state.render();
  });

  document.getElementById('canvas-zoom-fit')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.img) return;
    state.zoom = computeFitZoom();
    state.panX = state.workspaceWidth / 2;
    state.panY = state.workspaceHeight / 2;
    const el = document.getElementById('status-zoom');
    if (el) el.innerText = `Зум: ${Math.round(state.zoom * 100)}%`;
    state.render();
  });
}

// Зум, при котором в окне помещаются и документ, и рамка выравнивания
function computeFitZoom() {
  const iw = state.img.width, ih = state.img.height;
  let W = iw, H = ih;

  const activeTool = document.querySelector('.tool-btn.active')?.getAttribute('data-tool') || '';
  if (activeTool === 'size') {
    W = parseInt(document.getElementById('size-width')?.value) || W;
    H = parseInt(document.getElementById('size-height')?.value) || H;
  }

  let fw, fh;
  if (state.refFrameMode === 'original') {
    fw = W; fh = H;
    if (state.refFrameLandscape && fh > fw) { const t = fw; fw = fh; fh = t; }
    if (!state.refFrameLandscape && fw > fh) { const t = fw; fw = fh; fh = t; }
  } else {
    const longSide = Math.max(W, H);
    if (state.refFrameLandscape) { fw = longSide; fh = longSide / 1.4142; }
    else { fh = longSide; fw = longSide / 1.4142; }
  }

  const bw = Math.max(iw, fw), bh = Math.max(ih, fh);
  return Math.min(state.workspaceWidth / bw, state.workspaceHeight / bh) * 0.92;
}

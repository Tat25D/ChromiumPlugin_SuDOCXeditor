// Путь: renderer.js
import { state } from './state.js';
import { applyRotateTransform } from './tool-rotate.js';
import { cropState, getCropMarkerMetrics, updateCropInterface, getMarginCanvas, cropFillState } from './tool-crop.js';
import { perspState, isSetupMode, isShowTextLines, renderPerspectiveMesh, getPerspMarkerMetrics, updatePerspectiveInterface } from './tool-perspective.js';
import { getGridPreviewCanvas, getMarkerMetrics } from './tool-grid.js';
import { getColorPreviewCanvas, colorState } from './tool-color.js';
import { renderMarkerStrokes } from './tool-marker.js';

let lastOverlayTool = null;

export function drawScene(ctx, canvas) {
  // ЖЁСТКИЙ СБРОС трансформации + очистка ВСЕГО холста (защита от «призраков»)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Фоновая сетка приложения
  ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  if (!state.img) return;

  const activeToolElement = document.querySelector('.tool-btn.active');
  const activeTool = activeToolElement ? activeToolElement.getAttribute('data-tool') : 'rotate';

  // САМОВОССТАНОВЛЕНИЕ: при входе в инструмент рамки Перспективы/Обрезки
  // принудительно встают по углам ТЕКУЩЕЙ картинки
  if (activeTool !== lastOverlayTool) {
    if (activeTool === 'perspective') updatePerspectiveInterface();
    if (activeTool === 'crop') updateCropInterface();
    lastOverlayTool = activeTool;
  }

  // --- СЛОЙ ОТРИСОВКИ КАРТИНКИ ---
  if (activeTool === 'perspective' && !isSetupMode && (state.interactive || !state.isDraggingPerspective)) {
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);
    applyRotateTransform(ctx);

    const srcQuad = {
      tl: { x: 0, y: 0 }, tr: { x: state.img.width, y: 0 },
      bl: { x: 0, y: state.img.height }, br: { x: state.img.width, y: state.img.height }
    };
    const offsetW = state.img.width / 2;
    const offsetH = state.img.height / 2;
    const destQuad = {
      tl: { x: perspState.tl.x - offsetW, y: perspState.tl.y - offsetH },
      tr: { x: perspState.tr.x - offsetW, y: perspState.tr.y - offsetH },
      bl: { x: perspState.bl.x - offsetW, y: perspState.bl.y - offsetH },
      br: { x: perspState.br.x - offsetW, y: perspState.br.y - offsetH }
    };
    renderPerspectiveMesh(ctx, state.img, srcQuad, destQuad);
    ctx.restore();
  } else if (activeTool === 'grid' && state.gridPoints && state.interactive) {
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);
    applyRotateTransform(ctx);

    const preview = getGridPreviewCanvas();
    if (preview) {
      // Поддержка обоих форматов возврата: объект {canvas,ox,oy,w,h} или голый canvas
      const pc = preview.canvas || preview;
      const ox = preview.ox || 0;
      const oy = preview.oy || 0;
      // Целевой размер в пикселях изображения: холст может быть в ss раз крупнее (суперсэмплинг),
      // поэтому ВСЕГДА указываем dw/dh — иначе превью рисуется увеличенным
      const dw = preview.w || state.img.width;
      const dh = preview.h || state.img.height;
      if (preview.free) {
        ctx.drawImage(pc, ox - state.img.width / 2, oy - state.img.height / 2, dw, dh);
      } else {
        ctx.drawImage(state.img, -state.img.width / 2, -state.img.height / 2);
        ctx.drawImage(pc, ox - state.img.width / 2, oy - state.img.height / 2, dw, dh);
      }
    } else {
      ctx.drawImage(state.img, -state.img.width / 2, -state.img.height / 2);
    }
    ctx.restore();
    } else if (activeTool === 'color') {
    // Неразрушающий предпросмотр обработки поверх опорного снимка
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);
    applyRotateTransform(ctx);
    const colorPreview = getColorPreviewCanvas();

    if(colorPreview){
      ctx.drawImage(colorPreview,-state.img.width/ 2,-state.img.height/ 2);
    } else{
      ctx.drawImage(state.img,-state.img.width/ 2,-state.img.height/ 2);
    }

    // ===== КОНТУР кисти ретуши =====
    if(colorState.brushOn && colorState.cursorPos){
      const cx = colorState.cursorPos.x - state.img.width/2;
      const cy = colorState.cursorPos.y - state.img.height/2;
      const r = colorState.brushRadius;
      const lw = 1.25 / state.zoom;
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = lw * 2.6;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  } else if (activeTool === 'marker') {
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);
    applyRotateTransform(ctx);
    ctx.drawImage(state.img, -state.img.width / 2, -state.img.height / 2);
    renderMarkerStrokes(ctx, -state.img.width / 2, -state.img.height / 2, true);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);
    applyRotateTransform(ctx);
    ctx.drawImage(state.img, -state.img.width / 2, -state.img.height / 2);
    ctx.restore();
  }

  // --- СЛОЙ СЛУЖЕБНЫХ ИНТЕРФЕЙСОВ ПОВЕРХ ---
  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);

  // ===== ДВОЙНАЯ глобальная пунктирная рамка-ориентир (во всех инструментах) =====
  if (state.refFrameOn) {
    const dims = getRefFrameDims(activeTool);
    ctx.save();
    ctx.lineWidth = 1.5 / state.zoom;
    ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);

    // Рамка 1: по краю рабочего размера (оригинал фото или А4, с учётом ориентации)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.strokeRect(-dims.w / 2, -dims.h / 2, dims.w, dims.h);

    // Рамка 2: на 10% больше — зона полей для ориентирования
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.4)';
    ctx.strokeRect((-dims.w * 1.1) / 2, (-dims.h * 1.1) / 2, dims.w * 1.1, dims.h * 1.1);
    ctx.restore();
  }

  // ===== ГЛОБАЛЬНЫЕ вспомогательные линии строк (во всех инструментах) =====
  if (state.showLineGuides || state.gridShowLines || isShowTextLines) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 51, 51, 0.5)';
    ctx.lineWidth = 1 / state.zoom;
    const step = Math.max(40, Math.round(state.img.height / 25));
    for (let y = step; y < state.img.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(-state.img.width / 2, y - state.img.height / 2);
      ctx.lineTo(state.img.width / 2, y - state.img.height / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ===== РЕШЁТКА =====
  if (activeTool === 'grid') {
    // Пунктирная рамка в процессе выделения области мышью
    if (state.isGridDefining && state.gridDefStart && state.gridDefEnd) {
      ctx.strokeStyle = '#00ff99';
      ctx.lineWidth = 2 / state.zoom;
      ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
      const rx = state.gridDefStart.x - state.img.width / 2;
      const ry = state.gridDefStart.y - state.img.height / 2;
      const rw = state.gridDefEnd.x - state.gridDefStart.x;
      const rh = state.gridDefEnd.y - state.gridDefStart.y;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }

    if (state.gridPoints) {
      const size = state.gridSize;
      const halfW = state.img.width / 2;
      const halfH = state.img.height / 2;

      // Граница области деформации + граница пятна эффекта
      if (state.gridRect) {
        ctx.save();
        ctx.lineWidth = 1 / state.zoom;
        ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);

        ctx.strokeStyle = 'rgba(0, 255, 153, 0.25)';
        ctx.strokeRect(state.gridRect.x - halfW, state.gridRect.y - halfH, state.gridRect.w, state.gridRect.h);

        if (state.gridMode !== 'radial') {
          const exp = state.gridRectExpand || 0;
          const ex = Math.max(0, state.gridRect.x - exp);
          const ey = Math.max(0, state.gridRect.y - exp);
          const ew = Math.min(state.img.width, state.gridRect.x + state.gridRect.w + exp) - ex;
          const eh = Math.min(state.img.height, state.gridRect.y + state.gridRect.h + exp) - ey;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
          ctx.strokeRect(ex - halfW, ey - halfH, ew, eh);
        }
        ctx.restore();
      }

      // ЗЕЛЁНАЯ СЕТКА — по СМЕЩЁННЫМ позициям маркеров
      ctx.strokeStyle = 'rgba(0, 255, 153, 0.5)';
      ctx.lineWidth = 1.5 / state.zoom;
      for (let r = 0; r < size; r++) {
        ctx.beginPath();
        for (let c = 0; c < size; c++) {
          const p = state.gridPoints[r][c];
          const gx = p.x + (p.offsetX || 0) - halfW;
          const gy = p.y + (p.offsetY || 0) - halfH;
          if (c === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
        }
        ctx.stroke();
      }
      for (let c = 0; c < size; c++) {
        ctx.beginPath();
        for (let r = 0; r < size; r++) {
          const p = state.gridPoints[r][c];
          const gx = p.x + (p.offsetX || 0) - halfW;
          const gy = p.y + (p.offsetY || 0) - halfH;
          if (r === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
        }
        ctx.stroke();
      }

      const met = getMarkerMetrics();
      const mR = met.marker / state.zoom;
      const aR = met.anchor / state.zoom;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const p = state.gridPoints[r][c];
          const ox = p.offsetX || 0, oy = p.offsetY || 0;
          const ax = p.x - halfW, ay = p.y - halfH;
          const gx = p.x + ox - halfW, gy = p.y + oy - halfH;
          const isActive = state.gridActivePoint &&
                           state.gridActivePoint.r === r && state.gridActivePoint.c === c;

          // Синий якорь исходного положения + вектор смещения (отключаемые)
          if (state.gridShowAnchors && Math.hypot(ox, oy) > 0.5) {
            ctx.strokeStyle = 'rgba(0, 122, 204, 0.9)';
            ctx.lineWidth = 1.5 / state.zoom;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(gx, gy);
            ctx.stroke();
            ctx.fillStyle = '#007acc';
            ctx.beginPath();
            ctx.arc(ax, ay, aR, 0, Math.PI * 2);
            ctx.fill();
          }

          // Круги радиусов у активного маркера (только в режиме radial)
          if (isActive && state.gridMode === 'radial') {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 255, 153, 0.6)';
            ctx.lineWidth = 1 / state.zoom;
            ctx.beginPath(); ctx.arc(gx, gy, state.gridRadiusAction, 0, Math.PI * 2); ctx.stroke();
            if (state.gridRadiusSmooth > 0) {
              ctx.strokeStyle = 'rgba(255, 51, 51, 0.4)';
              ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
              ctx.beginPath(); ctx.arc(gx, gy, state.gridRadiusAction + state.gridRadiusSmooth, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
          }

          // Зелёный маркер (хватается мышью)
          ctx.fillStyle = '#00ff99';
          ctx.beginPath();
          ctx.arc(gx, gy, mR, 0, Math.PI * 2);
          ctx.fill();
          if (isActive) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / state.zoom;
            ctx.beginPath();
            ctx.arc(gx, gy, mR + 2 / state.zoom, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
  }

  // ===== ПЕРСПЕКТИВА =====
  if (activeTool === 'perspective') {
    ctx.strokeStyle = isSetupMode ? '#00ff99' : '#007acc';
    ctx.lineWidth = 2 / state.zoom;

    const pTL = { x: perspState.tl.x - state.img.width / 2, y: perspState.tl.y - state.img.height / 2 };
    const pTR = { x: perspState.tr.x - state.img.width / 2, y: perspState.tr.y - state.img.height / 2 };
    const pBL = { x: perspState.bl.x - state.img.width / 2, y: perspState.bl.y - state.img.height / 2 };
    const pBR = { x: perspState.br.x - state.img.width / 2, y: perspState.br.y - state.img.height / 2 };

    ctx.beginPath();
    ctx.moveTo(pTL.x, pTL.y); ctx.lineTo(pTR.x, pTR.y);
    ctx.lineTo(pBR.x, pBR.y); ctx.lineTo(pBL.x, pBL.y);
    ctx.closePath();
    ctx.stroke();

    // Синие якоря исходных углов + векторы (отключаемые)
    if (state.perspShowAnchors) {
      const orig = [
        { x: -state.img.width / 2, y: -state.img.height / 2 },
        { x:  state.img.width / 2, y: -state.img.height / 2 },
        { x: -state.img.width / 2, y:  state.img.height / 2 },
        { x:  state.img.width / 2, y:  state.img.height / 2 }
      ];
      const cur = [pTL, pTR, pBL, pBR];
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 122, 204, 0.9)';
      ctx.fillStyle = '#007acc';
      ctx.lineWidth = 1.5 / state.zoom;
      for (let i = 0; i < 4; i++) {
        if (Math.hypot(cur[i].x - orig[i].x, cur[i].y - orig[i].y) > 0.5) {
          ctx.beginPath();
          ctx.moveTo(orig[i].x, orig[i].y);
          ctx.lineTo(cur[i].x, cur[i].y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(orig[i].x, orig[i].y, 3 / state.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Угловые маркеры: размер из глобального пресета
    ctx.fillStyle = ctx.strokeStyle;
    const m = getPerspMarkerMetrics().marker / state.zoom;
    ctx.fillRect(pTL.x - m / 2, pTL.y - m / 2, m, m);
    ctx.fillRect(pTR.x - m / 2, pTR.y - m / 2, m, m);
    ctx.fillRect(pBL.x - m / 2, pBL.y - m / 2, m, m);
    ctx.fillRect(pBR.x - m / 2, pBR.y - m / 2, m, m);
  }

  // ===== ОБРЕЗКА =====
  if (activeTool === 'crop') {
    if (cropState.x1 === 0 && cropState.x2 === 0) {
      cropState.x1 = 0; cropState.y1 = 0; cropState.x2 = state.img.width; cropState.y2 = state.img.height;
    }
    ctx.strokeStyle = '#00ff99'; ctx.lineWidth = 2 / state.zoom;
    const rx = cropState.x1 - state.img.width / 2;
    const ry = cropState.y1 - state.img.height / 2;
    const rw = cropState.x2 - cropState.x1;
    const rh = cropState.y2 - cropState.y1;
    ctx.strokeRect(rx, ry, rw, rh);
    const margin = getMarginCanvas();
    if (margin) ctx.drawImage(margin, rx, ry); // наращенные поля под рамкой
    // Затемняем ТОЛЬКО обрезаемую часть: внутри изображения и вне рамки.
    // Наращенные поля (вне изображения) затемнению НЕ подлежат.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const halfW = state.img.width / 2, halfH = state.img.height / 2;
    const cx0 = Math.max(0, cropState.x1), cy0 = Math.max(0, cropState.y1);
    const cx1 = Math.min(state.img.width, cropState.x2), cy1 = Math.min(state.img.height, cropState.y2);
    if (cy0 > 0) ctx.fillRect(-halfW, -halfH, state.img.width, cy0);
    if (cy1 < state.img.height) ctx.fillRect(-halfW, cy1 - halfH, state.img.width, state.img.height - cy1);
    if (cx0 > 0) ctx.fillRect(-halfW, cy0 - halfH, cx0, cy1 - cy0);
    if (cx1 < state.img.width) ctx.fillRect(cx1 - halfW, cy0 - halfH, state.img.width - cx1, cy1 - cy0);

    // ===== ЗАЛИВКА: превью выделения =====
    if (cropFillState.enabled) {
      ctx.save();
      ctx.strokeStyle = '#ff9900';
      ctx.fillStyle = '#ff9900';
      ctx.lineWidth = 2 / state.zoom;
      const halfW = state.img.width / 2, halfH = state.img.height / 2;
      const P = (p) => ({ x: p.x - halfW, y: p.y - halfH });

      if (cropFillState.mode === 'rect' && cropFillState.rectStart && cropFillState.rectEnd) {
        const a = P(cropFillState.rectStart), b = P(cropFillState.rectEnd);
        ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      } else if (cropFillState.points.length) {
        const pts = cropFillState.points;
        ctx.beginPath();
        const f = P(pts[0]);
        ctx.moveTo(f.x, f.y);
        for (let i = 1; i < pts.length; i++) { const q = P(pts[i]); ctx.lineTo(q.x, q.y); }
        if (cropFillState.cursor && (cropFillState.mode === 'poly' || (cropFillState.mode === 'edge' && pts.length === 1))) {
          const c = P(cropFillState.cursor);
          ctx.lineTo(c.x, c.y);
        }
        ctx.stroke();
        const m = 3 / state.zoom;
        for (const p of pts) { const q = P(p); ctx.fillRect(q.x - m, q.y - m, m * 2, m * 2); }
      }
      ctx.restore();
    }

    // Синие якоря исходной рамки (полный лист) + векторы, сколько срезано
    if (state.cropShowAnchors) {
      const orig = [
        { x: -state.img.width / 2, y: -state.img.height / 2 },
        { x:  state.img.width / 2, y: -state.img.height / 2 },
        { x: -state.img.width / 2, y:  state.img.height / 2 },
        { x:  state.img.width / 2, y:  state.img.height / 2 }
      ];
      const cur = [
        { x: rx, y: ry },
        { x: rx + rw, y: ry },
        { x: rx, y: ry + rh },
        { x: rx + rw, y: ry + rh }
      ];
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 122, 204, 0.9)';
      ctx.fillStyle = '#007acc';
      ctx.lineWidth = 1.5 / state.zoom;
      for (let i = 0; i < 4; i++) {
        if (Math.hypot(cur[i].x - orig[i].x, cur[i].y - orig[i].y) > 0.5) {
          ctx.beginPath();
          ctx.moveTo(orig[i].x, orig[i].y);
          ctx.lineTo(cur[i].x, cur[i].y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(orig[i].x, orig[i].y, 3 / state.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Ручки рамки: размер из глобального пресета
    ctx.fillStyle = '#00ff99';
    const m = getCropMarkerMetrics().marker / state.zoom;
    ctx.fillRect(rx - m / 2, ry - m / 2, m, m);
    ctx.fillRect(rx + rw - m / 2, ry - m / 2, m, m);
    ctx.fillRect(rx - m / 2, ry + rh - m / 2, m, m);
    ctx.fillRect(rx + rw - m / 2, ry + rh - m / 2, m, m);
  }

  ctx.restore();
}

/** Размер направляющей рамки.
 *  Базовый размер — текущий документ, а в инструменте «Размер» — целевой размер
 *  из полей панели (превью). Режим «Оригинал/А4» и ориентация применяются
 *  ЕДИНООБРАЗНО поверх базового размера — поэтому рамка не «скачет»
 *  при переключении инструментов.
 */
function getRefFrameDims(activeTool) {
  let W = state.img.width, H = state.img.height;

  // В «Размер» базовый размер = целевой (превью больше/меньше)
  if (activeTool === 'size') {
    W = parseInt(document.getElementById('size-width')?.value) || W;
    H = parseInt(document.getElementById('size-height')?.value) || H;
  }

  if (state.refFrameMode === 'original') {
    let w = W, h = H;
    if (state.refFrameLandscape && h > w) { const t = w; w = h; h = t; }
    if (!state.refFrameLandscape && w > h) { const t = w; w = h; h = t; }
    return { w, h };
  }

  // А4: пропорции 1:1.4142 по длинной стороне базового размера
  const longSide = Math.max(W, H);
  if (state.refFrameLandscape) return { w: longSide, h: longSide / 1.4142 };
  return { h: longSide, w: longSide / 1.4142 };
}

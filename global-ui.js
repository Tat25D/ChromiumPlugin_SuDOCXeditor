// Путь: global-ui.js
import { state } from './state.js';
import { invalidateGridCache } from './tool-grid.js';
import { invalidateColorCache } from './tool-color.js';
import { invalidateMargin } from './tool-crop.js';

// SVG-иконки (без подписей, только title-тултипы)
const ICONS = {
  frameOn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 4h5v2H6v3H4V4zm11 0h5v5h-2V6h-3V4zM4 15h2v3h3v2H4v-5zm14 0h2v5h-5v-2h3v-3zM10 4h4v2h-4V4zm0 14h4v2h-4v-2zM4 10h2v4H4v-4zm14 0h2v4h-2v-4z"/></svg>',
  frameOff: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 4h5v2H6v3H4V4zm11 0h5v5h-2V6h-3V4zM4 15h2v3h3v2H4v-5zm14 0h2v5h-5v-2h3v-3zM10 4h4v2h-4V4zm0 14h4v2h-4v-2zM4 10h2v4H4v-4zm14 0h2v4h-2v-4z"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2"/></svg>',
  orientP: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 2h8v20H8V2zm2 2v16h4V4h-4z"/></svg>',
  orientL: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2 8h20v8H2V8zm2 2v4h16v-4H4z"/></svg>',
  modeA4: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 2h9l5 5v15H6V2zm2 2v16h10V8h-4V4H8z"/><path d="M9.5 17v-4l1.5 2 1.5-2v4h1v-5.5h-1.2l-1.3 1.8-1.3-1.8H8.5V17z"/></svg>',
  modeOrig: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 5h18v14H3V5zm2 2v10h14V7H5zm2 8l3-4 2 2.5L13 10l4 5H7z"/></svg>',
  anchorsOn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a3 3 0 0 1 1 5.83V9h4v2h-4v8.92c3.72-.48 6.68-3.28 7.34-7.02l.16-.9h2.02l-.1.98c-.8 4.52-4.92 8.52-9.92 9.02v.02h-1V23c-5-.5-9.12-4.5-9.92-9.02l-.1-.98h2.02l.16.9c.66 3.74 3.62 6.54 7.34 7.02V11H7V9h4V7.83A3 3 0 0 1 12 2zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>',
  anchorsOff: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a3 3 0 0 1 1 5.83V9h4v2h-4v8.92c3.72-.48 6.68-3.28 7.34-7.02l.16-.9h2.02l-.1.98c-.8 4.52-4.92 8.52-9.92 9.02v.02h-1V23c-5-.5-9.12-4.5-9.92-9.02l-.1-.98h2.02l.16.9c.66 3.74 3.62 6.54 7.34 7.02V11H7V9h4V7.83A3 3 0 0 1 12 2zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2"/></svg>',
  linesOn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 5h16v2H4V5zm0 4h16v2H4V9zm0 4h16v2H4v-2zm0 4h10v2H4v-2z"/></svg>',
  linesOff: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 5h16v2H4V5zm0 4h16v2H4V9zm0 4h16v2H4v-2zm0 4h10v2H4v-2z"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2"/></svg>'
};

export function initGlobalUI() {
  // Дефолты — даже если state.js не обновлялся вручную
  if (state.refFrameOn === undefined) state.refFrameOn = true;
  if (state.refFrameLandscape === undefined) state.refFrameLandscape = false;
  if (state.refFrameMode === undefined) state.refFrameMode = 'a4';
  if (state.markerSize === undefined) state.markerSize = 'medium';
  if (state.showAnchors === undefined) state.showAnchors = true;
  if (state.gridShowAnchors === undefined) state.gridShowAnchors = true;
  if (state.perspShowAnchors === undefined) state.perspShowAnchors = true;
  if (state.cropShowAnchors === undefined) state.cropShowAnchors = true;
  if (state.showLineGuides === undefined) state.showLineGuides = false;

  ensureDom();
  bind();
  refresh();
}

// Оставлено для совместимости с editor.js
export function setGlobalFileInfo() {}

// Панель создаётся скриптом ОДИН раз. Старые копии пересоздаются автоматически.
function ensureDom() {
  let root = document.getElementById('global-ui-root');
  if (root && (root.querySelector('#global-file-name') ||
               !root.querySelector('#global-anchors-toggle') ||
               !root.querySelector('#global-lines-toggle') ||
               !root.querySelector('#global-interactive-toggle'))){
    root.remove();
    root = null;
  }
  if (root) return;
  if (document.getElementById('global-marker-small')) return;

  const anchor = document.querySelector('.properties-panel .panel-title') ||
                 document.querySelector('.properties-panel');
  if (!anchor) return;

  root = document.createElement('div');
  root.id = 'global-ui-root';
  root.innerHTML = `
    <div class="prop-group" style="margin-top: 10px;">
      <label>Направляющая рамка:</label>
      <div class="btn-row">
        <button id="ref-frame-toggle" title="Показать / скрыть рамку" style="padding:6px;"></button>
        <button id="ref-frame-orient" title="Портрет / ландшафт" style="padding:6px;"></button>
        <button id="ref-frame-mode" title="А4 / оригинальный размер" style="padding:6px;"></button>
      </div>
    </div>

    <div class="prop-group">
      <label>Размер маркеров:</label>
      <div class="btn-row">
        <button id="global-marker-small" title="Мелкие маркеры" style="padding:6px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="3"/></svg></button>
        <button id="global-marker-medium" title="Средние маркеры" style="padding:6px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="5.5"/></svg></button>
        <button id="global-marker-large" title="Крупные маркеры" style="padding:6px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="8.5"/></svg></button>
      </div>
    </div>

    <div class="prop-group">
      <label>Якоря и линии строк:</label>
      <div class="btn-row">
        <button id="global-anchors-toggle" title="Якоря исходного положения: показать / скрыть" style="padding:6px;"></button>
        <button id="global-lines-toggle" title="Вспомогательные линии строк: показать/скрыть" style="padding:6px;"></button>
      </div>
    </div>

    <div class="prop-group">
      <label>Живой просмотр эффектов:</label>
      <button id="global-interactive-toggle" title="Выкл = экономия для слабого ПК/смартфона: тяжёлый предпросмотр пересчитывается по отпускании мыши" style="padding:6px;"></button>
    </div>
  `;
  anchor.insertAdjacentElement('afterend', root);
}

function bind() {
  document.getElementById('ref-frame-toggle')?.addEventListener('click', () => {
    state.refFrameOn = !state.refFrameOn;
    refresh();
    if (state.render) state.render();
  });

  document.getElementById('ref-frame-orient')?.addEventListener('click', () => {
    state.refFrameLandscape = !state.refFrameLandscape;
    refresh();
    if (state.render) state.render();
  });

  document.getElementById('ref-frame-mode')?.addEventListener('click', () => {
    state.refFrameMode = state.refFrameMode === 'a4' ? 'original' : 'a4';
    refresh();
    if (state.render) state.render();
  });

  ['small', 'medium', 'large'].forEach(key => {
    document.getElementById('global-marker-' + key)?.addEventListener('click', () => {
      state.markerSize = key;
      state.gridMarkerSize = key;
      state.perspMarkerSize = key;
      state.cropMarkerSize = key;
      refresh();
      if (state.render) state.render();
    });
  });

  document.getElementById('global-anchors-toggle')?.addEventListener('click', () => {
    state.showAnchors = !state.showAnchors;
    state.gridShowAnchors = state.showAnchors;
    state.perspShowAnchors = state.showAnchors;
    state.cropShowAnchors = state.showAnchors;
    refresh();
    if (state.render) state.render();
  });

  // Глобальные вспомогательные линии строк — работают в любом инструменте
  document.getElementById('global-lines-toggle')?.addEventListener('click', () => {
    state.showLineGuides = !state.showLineGuides;
    refresh();
    if (state.render) state.render();
  });

  document.getElementById('global-interactive-toggle')?.addEventListener('click', () => {
    state.interactive = !state.interactive;
    invalidateGridCache();
    invalidateColorCache();
    invalidateMargin();
    refresh();
    if (state.render) state.render();
  });
}

function refresh() {
  const t = document.getElementById('ref-frame-toggle');
  if (t) {
    t.innerHTML = state.refFrameOn ? ICONS.frameOn : ICONS.frameOff;
    setActive(t, state.refFrameOn);
  }
  const o = document.getElementById('ref-frame-orient');
  if (o) {
    o.innerHTML = state.refFrameLandscape ? ICONS.orientL : ICONS.orientP;
    setActive(o, state.refFrameLandscape);
  }
  const m = document.getElementById('ref-frame-mode');
  if (m) {
    m.innerHTML = state.refFrameMode === 'a4' ? ICONS.modeA4 : ICONS.modeOrig;
    setActive(m, state.refFrameMode === 'original');
  }
  ['small', 'medium', 'large'].forEach(key => {
    const b = document.getElementById('global-marker-' + key);
    if (b) setActive(b, state.markerSize === key);
  });
  const a = document.getElementById('global-anchors-toggle');
  if (a) {
    a.innerHTML = state.showAnchors ? ICONS.anchorsOn : ICONS.anchorsOff;
    setActive(a, state.showAnchors);
  }
  const l = document.getElementById('global-lines-toggle');
  if (l) {
    l.innerHTML = state.showLineGuides ? ICONS.linesOn : ICONS.linesOff;
    setActive(l, state.showLineGuides);
  }
  const gi = document.getElementById('global-interactive-toggle');
  if (gi) {
    gi.innerText = state.interactive ? 'Интерактивно: Включен' : 'Интерактивно: Выключен (экономия)';
    gi.style.background = state.interactive ? '#ff3333' : '#3c3c3c';
    gi.style.borderColor = state.interactive ? '#ff3333' : '#555';
    gi.style.color = '#fff';
  }
}

function setActive(btn, on) {
  btn.style.background = on ? '#007acc' : '#3c3c3c';
  btn.style.borderColor = on ? '#007acc' : '#555';
  btn.style.color = '#fff';
}

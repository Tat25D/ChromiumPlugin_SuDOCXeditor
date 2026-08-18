// Путь: ui-mode.js
// Авто-определение устройства и сенсора. Настройки — в localStorage.
// Результат — атрибуты body[data-ui="desktop|tablet|phone"] и body[data-touch="on|off"].
import { state } from './state.js';

const LS_MODE = 'sudocx-ui-mode';  // 'auto' | 'desktop' | 'tablet' | 'phone'
const LS_TOUCH = 'sudocx-touch';   // 'auto' | 'on' | 'off'

export const uiMode = {
  prefMode: 'auto',
  prefTouch: 'auto',
  mode: 'desktop',   // решённое устройство
  touch: false       // решённый сенсор
};

const listeners = [];
export function onUIModeChange(fn) { listeners.push(fn); }

function coarsePointer() {
  return matchMedia('(pointer: coarse)').matches;
}

export function resolveUIMode() {
  uiMode.prefMode = localStorage.getItem(LS_MODE) || 'auto';
  uiMode.prefTouch = localStorage.getItem(LS_TOUCH) || 'auto';

  const coarse = coarsePointer();
  const w = window.innerWidth || screen.width;

  // Устройство: авто = сенсор? (узко→смартфон, широко→планшет) : ПК
  if (uiMode.prefMode === 'auto') {
    uiMode.mode = coarse ? (w < 700 ? 'phone' : 'tablet') : 'desktop';
  } else {
    uiMode.mode = uiMode.prefMode;
  }

  // Сенсор: авто = есть тач-указатель ИЛИ режим не десктопный
  if (uiMode.prefTouch === 'auto') uiMode.touch = coarse || uiMode.mode !== 'desktop';
  else uiMode.touch = uiMode.prefTouch === 'on';

  document.body.dataset.ui = uiMode.mode;
  document.body.dataset.touch = uiMode.touch ? 'on' : 'off';
  listeners.forEach(fn => fn(uiMode));
  return uiMode;
}

export function setUIModePref(v) { localStorage.setItem(LS_MODE, v); resolveUIMode(); }
export function setTouchPref(v) { localStorage.setItem(LS_TOUCH, v); resolveUIMode(); }

// смена ориентации/размера окна важна только в «Авто»
window.addEventListener('resize', () => {
  if (uiMode.prefMode === 'auto') resolveUIMode();
});

resolveUIMode();

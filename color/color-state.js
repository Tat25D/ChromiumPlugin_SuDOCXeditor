// Путь: color-state.js
export const colorState = {
  // Слой 1 — Выравнивание освещённости
  levelOn: false, levelStrength: 100,
  levelBlock: 48, levelTarget: 250, levelDepth: 2.8, levelColor: 80,
  // Слой 2 — Улучшенный OCR (ЧБ)
  ocrOn: false,  ocrWindow: 25, ocrSens: 3, ocrStrength: 15,
  // Слой 3 — Оттенки серого
  grayOn: false,  grayStrength: 100,
  // Слой 4 — Яркость и контраст
  bcOn: false, bcBright: -25, bcContrast: 40, bcGamma: 0.8, bcStrength: 100,
  // Слой 5 — Ретушь-кисть
  brushOn: false, brushMode: 'auto', brushRadius: 80, brushStrength: 5, brushThreshold: 155,
  brushProtect: 100, // Авто 2: граница защищённых тёмных тонов (текст)
  brushHistoryMax: 5,   // глубина истории Undo (1–30, экономия на слабых ПК)
  cursorPos: null,      // позиция курсора для контура кисти
  interactive: true,
  bypass: false
};

export const LAYER_SLIDERS = {
  levelOn: ['color-level-strength', 'color-level-block', 'color-level-target', 'color-level-depth', 'color-level-color'],
  ocrOn: ['color-ocr-window', 'color-ocr-sens', 'color-ocr-strength'],
  grayOn: ['color-gray-strength'],
  bcOn: ['color-bc-strength', 'color-bc-bright', 'color-bc-contrast', 'color-bc-gamma'],
  brushOn: ['color-brush-radius', 'color-brush-strength', 'color-brush-threshold', 'color-brush-protect']
};

export const LAYER_BUTTONS = {
  levelOn: 'color-toggle-level',
  ocrOn: 'color-toggle-ocr',
  grayOn: 'color-toggle-gray',
  bcOn: 'color-toggle-bc',
  brushOn: 'color-toggle-brush'
};

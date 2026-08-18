// Путь: state.js
export const state = {
    img: null,
    originalCanvas: null,   // Синхронный холст-буфер для сброса изменений внутри вкладок
    zoom: 1,
    panX: 0,
    panY: 0,
    rotateStepAngle: 0,
    fineTuneAngle: 0,
    isDragging: false,
    isDraggingCrop: false,
    isDraggingPerspective: false,
    isDraggingGridPoint: false,

    // Параметры интерактивной Решётки деформации
    isGridDefining: false,      // Режим выделения рамки мышью
    gridDefStart: null,
    gridDefEnd: null,
    gridRect: null,             // Зафиксированная область {x, y, w, h}
    gridSize: 3,
    gridPoints: null,           // Узлы {x, y, offsetX, offsetY}; x,y — исходная позиция (якорь)
    gridActivePoint: null,
    gridGrab: null,
    gridMode: 'rect',           // 'rect' | 'radial' | 'tps'
    gridRadiusAction: 150,      // (radial) зона сдвига 1:1
    gridRadiusSmooth: 500,      // (radial) затухание / (rect,tps) ширина размытия краёв
    gridRectExpand: 125,         // (rect/tps) расширение пятна эффекта за рамки области, px
    gridQuality: 'draft',      // 'draft' | 'normal' | 'high' | 'ultra'
    gridMarkerSize: 'medium',   // 'small' | 'medium' | 'large' — размер маркеров и радиус захвата
    gridShowLines: false,       // вспомогательные горизонтальные линии поверх листа
    gridIsInteractive: true,
    interactive: true,        // ГЛОБАЛЬНЫЙ живой просмотр (Перспектива/Решётка/Обрезка/Цвет)
    gridShowAnchors: true,      // показывать синие якоря и векторы исходного положения
    perspQuality: 'draft',      // 'draft' | 'normal' | 'high' | 'ultra' — меш/суперсэмплинг Перспективы
    perspMarkerSize: 'medium',  // 'small' | 'medium' | 'large' — размер угловых маркеров
    perspShowAnchors: true,     // синие якоря исходных углов и векторы
    cropMarkerSize: 'medium',   // 'small' | 'medium' | 'large' — размер ручек обрезки
    cropShowAnchors: true,      // синие якоря исходной рамки (полный лист)

    // Глобальные оверлей-настройки (общие для всех инструментов)
    refFrameOn: true,          // показывать направляющую рамку
    refFrameLandscape: false,  // false = портрет, true = ландшафт
    refFrameMode: 'a4',        // 'a4' | 'original'
    markerSize: 'medium',      // глобальный размер маркеров всех инструментов
    originalWidth: 0,          // исходный размер загруженного фото
    originalHeight: 0,

    workspaceWidth: 0,
    workspaceHeight: 0,

    render: null
};

// Функция центрирования изображения бланка на холсте
export function centerImage() {
    if (!state.img || !state.workspaceWidth || !state.workspaceHeight) return;

    const ratioX = state.workspaceWidth / state.img.width;
    const ratioY = state.workspaceHeight / state.img.height;
    state.zoom = Math.min(ratioX, ratioY) * 0.85;

    state.panX = state.workspaceWidth / 2;
    state.panY = state.workspaceHeight / 2;
}

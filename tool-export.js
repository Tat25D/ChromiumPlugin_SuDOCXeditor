// Путь: tool-export.js
import { state } from './state.js';
import { getSaveFileName, rememberSavedNumbers } from './tool-file.js';

export function initExportTool() {
  document.getElementById('download-btn')?.addEventListener('click', () => {
    if (!state.img) return alert('Нечего сохранять!');

    const saveCanvas = document.createElement('canvas');
    const sCtx = saveCanvas.getContext('2d');
    saveCanvas.width = state.img.width;
    saveCanvas.height = state.img.height;

    // Все повороты/деформации УЖЕ запечены в state.img — рисуем без трансформаций
    sCtx.drawImage(state.img, 0, 0);

    const dataUrl = saveCanvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    const saveName = (getSaveFileName() || 'edited_a4_document').trim();
    link.download = saveName + '.jpg';
    link.href = dataUrl;
    link.click();
    rememberSavedNumbers(); // подсказки номеров сдвинутся на следующее сохранение

    const statusMsg = document.getElementById('status-message');
    if (statusMsg) statusMsg.innerText = 'Файл успешно сохранен в Загрузки!';
  });
}

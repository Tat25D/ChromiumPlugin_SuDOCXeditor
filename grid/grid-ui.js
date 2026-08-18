export function updatePresetButtonsUI(clickedBtn) {
  const p3 = document.getElementById('grid-preset-3');
  const p4 = document.getElementById('grid-preset-4');
  [p3, p4].forEach(b => {
    if (b) {
      b.className = '';
      b.style.background = '#3c3c3c';
      b.style.borderColor = '#555';
      b.style.color = '#fff';
    }
  });
  clickedBtn.className = 'action-btn';
  clickedBtn.style.background = '#007acc';
  clickedBtn.style.borderColor = '#007acc';
}

// ПОЧИНЕНО: Переменная btnInteractive переименована в btnEl. Больше никаких падений!
export function updateInteractiveButtonUI(btnEl, isInteractive) {
  if (!btnEl) return;
  if (isInteractive) {
    btnEl.innerText = 'Интерактивно: Включено';
    btnEl.style.background = '#ff3333';
    btnEl.style.borderColor = '#ff3333';
  } else {
    btnEl.innerText = 'Интерактивно: Выключено (Экономия)';
    btnEl.style.background = '#3c3c3c';
    btnEl.style.borderColor = '#555';
  }
}

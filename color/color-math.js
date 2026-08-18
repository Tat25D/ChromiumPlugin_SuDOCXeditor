// Путь: color-math.js
// Чистые пиксельные алгоритмы инструмента «Цвет». Никакого DOM — только data/W/H + параметры.

// СЛОЙ 1: выравнивание освещённости (max-pooling фон + нормализация gain)
export function applyLeveling(data, W, H, cs) {
  const k = cs.levelStrength / 100;
  if (k <= 0) return;

  const target = cs.levelTarget;
  const maxGain = cs.levelDepth;
  const minGain = 0.4;
  const colorFix = cs.levelColor / 100;

  const smallW = Math.max(16, Math.round(W / Math.max(8, cs.levelBlock)));
  const smallH = Math.max(16, Math.round(H / Math.max(8, cs.levelBlock)));
  const bw = Math.max(1, Math.floor(W / smallW));
  const bh = Math.max(1, Math.floor(H / smallH));

  // Макс-пулинг по каналам: тёмный текст не попадает в оценку фона
  const bgSmall = new Float32Array(smallW * smallH * 3);
  for (let by = 0; by < smallH; by++) {
    const y0 = by * bh, y1 = Math.min(H, y0 + bh);
    for (let bx = 0; bx < smallW; bx++) {
      const x0 = bx * bw, x1 = Math.min(W, x0 + bw);
      let m0 = 0, m1 = 0, m2 = 0;
      for (let y = y0; y < y1; y++) {
        let idx = (y * W + x0) * 4;
        for (let x = x0; x < x1; x++, idx += 4) {
          if (data[idx]     > m0) m0 = data[idx];
          if (data[idx + 1] > m1) m1 = data[idx + 1];
          if (data[idx + 2] > m2) m2 = data[idx + 2];
        }
      }
      const o = (by * smallW + bx) * 3;
      bgSmall[o] = m0; bgSmall[o + 1] = m1; bgSmall[o + 2] = m2;
    }
  }

  // Сглаживание 3x3 по грубой сетке: защита от одиночных бликов
  const sm = new Float32Array(bgSmall.length);
  for (let y = 0; y < smallH; y++) {
    for (let x = 0; x < smallW; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= smallH) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= smallW) continue;
            sum += bgSmall[(yy * smallW + xx) * 3 + ch];
            cnt++;
          }
        }
        sm[(y * smallW + x) * 3 + ch] = sum / cnt;
      }
    }
  }

  // Билинейный апскейл оценки фона до полного размера
  const small = document.createElement('canvas');
  small.width = smallW; small.height = smallH;
  const sctx = small.getContext('2d');
  const sImg = sctx.createImageData(smallW, smallH);
  for (let i = 0, j = 0; i < sm.length; i += 3, j += 4) {
    sImg.data[j] = sm[i]; sImg.data[j + 1] = sm[i + 1]; sImg.data[j + 2] = sm[i + 2]; sImg.data[j + 3] = 255;
  }
  sctx.putImageData(sImg, 0, 0);

  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = W; bgCanvas.height = H;
  const bctx = bgCanvas.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, W, H);
  const bg = bctx.getImageData(0, 0, W, H).data;

  // Нормализация: смешение яркостного и поканального gain
  for (let j = 0; j < data.length; j += 4) {
    const b0 = bg[j], b1 = bg[j + 1], b2 = bg[j + 2];
    if (b0 < 8 && b1 < 8 && b2 < 8) continue;

    const bgLum = (b0 * 2126 + b1 * 7152 + b2 * 722) / 10000;
    let gLum = target / Math.max(8, bgLum);
    if (gLum > maxGain) gLum = maxGain;
    if (gLum < minGain) gLum = minGain;

    for (let ch = 0; ch < 3; ch++) {
      let gCh = target / Math.max(8, bg[j + ch]);
      if (gCh > maxGain) gCh = maxGain;
      if (gCh < minGain) gCh = minGain;
      const g = gLum + (gCh - gLum) * colorFix;
      const v = data[j + ch];
      data[j + ch] = v + (v * g - v) * k;
    }
  }
}

// СЛОЙ 2: Бредсен-Рот (локальная адаптивная бинаризация через интегральное изображение)
export function applyBradley(data, W, H, cs) {
  const n = W * H;
  const gray = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    gray[i] = (data[j] * 2126 + data[j + 1] * 7152 + data[j + 2] * 722) / 10000;
  }
  const iw = W + 1;
  const integral = (n > 16000000) ? new Float64Array(iw * (H + 1)) : new Uint32Array(iw * (H + 1));
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      rowSum += gray[y * W + x];
      integral[(y + 1) * iw + x + 1] = integral[y * iw + x + 1] + rowSum;
    }
  }

  const s = Math.max(3, cs.ocrWindow | 1);
  const half = (s - 1) >> 1;
  const t = cs.ocrSens;
  const k = cs.ocrStrength / 100;

  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(H - 1, y + half);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - half), x1 = Math.min(W - 1, x + half);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * iw + x1 + 1] - integral[y0 * iw + x1 + 1] -
                  integral[(y1 + 1) * iw + x0]     + integral[y0 * iw + x0];
      const bw = (gray[y * W + x] * count * 100 < sum * (100 - t)) ? 0 : 255;
      const j = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v = data[j + ch];
        data[j + ch] = v + (bw - v) * k;
      }
    }
  }
}

// СЛОЙ 3: взвешенное яркостное преобразование (Luma)
export function applyGray(data, W, H, strength) {
  const k = strength / 100;
  if (k <= 0) return;
  for (let j = 0; j < data.length; j += 4) {
    const v = (data[j] * 2126 + data[j + 1] * 7152 + data[j + 2] * 722) / 10000;
    data[j]     += (v - data[j])     * k;
    data[j + 1] += (v - data[j + 1]) * k;
    data[j + 2] += (v - data[j + 2]) * k;
  }
}

// СЛОЙ 4: яркость / контраст / гамма (LUT) с регулятором силы эффекта
export function applyBC(data, W, H, cs) {
  const k = Math.max(0, Math.min(100, cs.bcStrength ?? 100)) / 100;
  if (k <= 0) return;

  const b = cs.bcBright;
  const mult = 1 + cs.bcContrast / 100;
  const invG = 1 / Math.max(0.25, cs.bcGamma);

  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, invG));

  for (let j = 0; j < data.length; j += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const orig = data[j + ch];
      let v = (orig - 128) * mult + 128 + b;
      v = v < 0 ? 0 : (v > 255 ? 255 : v);
      const t = lut[Math.round(v)];
      data[j + ch] = orig + (t - orig) * k; // смешивание с оригиналом по силе слоя
    }
  }
}

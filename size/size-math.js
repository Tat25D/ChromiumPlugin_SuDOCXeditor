// 1. Ступенчатый апскейлинг (High Quality Step-Up)
export function scaleStepUp(imgObj, targetW, targetH) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let currentW = imgObj.width;
  let currentH = imgObj.height;
  let currentSrc = imgObj;

  // Пошагово увеличиваем по +50% за итерацию для сохранения контраста букв
  while (currentW * 1.5 < targetW) {
    currentW = Math.round(currentW * 1.5);
    currentH = Math.round(currentH * 1.5);

    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = currentW;
    stepCanvas.height = currentH;
    const stepCtx = stepCanvas.getContext('2d');

    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(currentSrc, 0, 0, currentW, currentH);

    currentSrc = stepCanvas;
  }

  canvas.width = targetW;
  canvas.height = targetH;
  ctx.drawImage(currentSrc, 0, 0, targetW, targetH);
  return canvas;
}

// 2. Эталонный фильтр Ланцоша (Lanczos-3 Sinc Resampling)
export function scaleLanczos(imgObj, targetW, targetH) {
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = imgObj.width;
  srcCanvas.height = imgObj.height;
  srcCanvas.getContext('2d').drawImage(imgObj, 0, 0);

  const srcData = srcCanvas.getContext('2d').getImageData(0, 0, imgObj.width, imgObj.height).data;
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = targetW;
  dstCanvas.height = targetH;
  const dstCtx = dstCanvas.getContext('2d');
  const dstImageData = dstCtx.createImageData(targetW, targetH);
  const dstData = dstImageData.data;

  const lanczosWindow = 3; // Окно Ланцоша 3-го порядка

  function sinc(x) {
    if (x === 0) return 1;
    const piX = Math.PI * x;
    return Math.sin(piX) / piX;
  }

  function lanczosWeight(x) {
    if (Math.abs(x) >= lanczosWindow) return 0;
    return sinc(x) * sinc(x / lanczosWindow);
  }

  // Попиксельный сверточный расчет матрицы
  for (let y = 0; y < targetH; y++) {
    const srcY = (y + 0.5) * (imgObj.height / targetH) - 0.5;
    const yFloor = Math.floor(srcY);
    const yStart = Math.max(0, yFloor - lanczosWindow + 1);
    const yEnd = Math.min(imgObj.height - 1, yFloor + lanczosWindow);

    for (let x = 0; x < targetW; x++) {
      const srcX = (x + 0.5) * (imgObj.width / targetW) - 0.5;
      const xFloor = Math.floor(srcX);
      const xStart = Math.max(0, xFloor - lanczosWindow + 1);
      const xEnd = Math.min(imgObj.width - 1, xFloor + lanczosWindow);

      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, weightSum = 0;

      for (let sy = yStart; sy <= yEnd; sy++) {
        const yWeight = lanczosWeight(srcY - sy);
        if (yWeight === 0) continue;

        for (let sx = xStart; sx <= xEnd; sx++) {
          const xWeight = lanczosWeight(srcX - sx);
          const weight = xWeight * yWeight;
          if (weight <= 0) continue;

          const srcIdx = (sy * imgObj.width + sx) * 4;
          rSum += srcData[srcIdx] * weight;
          gSum += srcData[srcIdx + 1] * weight;
          bSum += srcData[srcIdx + 2] * weight;
          aSum += srcData[srcIdx + 3] * weight;
          weightSum += weight;
        }
      }

      const dstIdx = (y * targetW + x) * 4;
      if (weightSum > 0) {
        dstData[dstIdx] = Math.min(255, Math.max(0, rSum / weightSum));
        dstData[dstIdx + 1] = Math.min(255, Math.max(0, gSum / weightSum));
        dstData[dstIdx + 2] = Math.min(255, Math.max(0, bSum / weightSum));
        dstData[dstIdx + 3] = Math.min(255, Math.max(0, aSum / weightSum));
      } else {
        const srcIdx = (Math.min(imgObj.height - 1, Math.max(0, yFloor)) * imgObj.width + Math.min(imgObj.width - 1, Math.max(0, xFloor))) * 4;
        dstData[dstIdx] = srcData[srcIdx];
        dstData[dstIdx + 1] = srcData[srcIdx + 1];
        dstData[dstIdx + 2] = srcData[srcIdx + 2];
        dstData[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }
  }

  dstCtx.putImageData(dstImageData, 0, 0);
  return dstCanvas;
}

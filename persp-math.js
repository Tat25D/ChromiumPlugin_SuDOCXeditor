// Вычисление проективной матрицы 4х4 (Метод Гаусса)
export function solveHomography(src, dst) {
  const A = [];
  for (let i = 0; i < 4; i++) {
    A.push([src[i].x, src[i].y, 1, 0, 0, 0, -src[i].x * dst[i].x, -src[i].y * dst[i].x, dst[i].x]);
    A.push([0, 0, 0, src[i].x, src[i].y, 1, -src[i].x * dst[i].y, -src[i].y * dst[i].y, dst[i].y]);
  }
  for (let i = 0; i < 8; i++) {
    let maxRow = i;
    for (let j = i + 1; j < 8; j++) {
      if (Math.abs(A[j][i]) > Math.abs(A[maxRow][i])) maxRow = j;
    }
    const tmp = A[i]; A[i] = A[maxRow]; A[maxRow] = tmp;
    for (let j = i + 1; j < 8; j++) {
      const c = A[j][i] / A[i][i];
      for (let k = i; k < 9; k++) A[j][k] -= c * A[i][k];
    }
  }
  const x = new Array(8);
  for (let i = 7; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < 8; j++) sum += A[i][j] * x[j];
    x[i] = (A[i] - sum) / A[i][i];
  }
  return [
    x[0], x[1], 0, x[2],
    x[3], x[4], 0, x[5],
       0,    0, 1,    0,
    x[6], x[7], 0,    1
  ];
}

// Попиксельное сеточное запекание текстуры А4 (Bleeding против швов)
export function bakeMesh(ctx, imgObj, src, dst) {
  const divs = 16;
  const getPt = (q, r, c) => {
    const t = r / divs; const k = c / divs;
    const l = { x: q.tl.x + (q.bl.x - q.tl.x) * t, y: q.tl.y + (q.bl.y - q.tl.y) * t };
    const ri = { x: q.tr.x + (q.br.x - q.tr.x) * t, y: q.tr.y + (q.br.y - q.tr.y) * t };
    return { x: l.x + (ri.x - l.x) * k, y: l.y + (ri.y - l.y) * k };
  };

  for (let r = 0; r < divs; r++) {
    for (let c = 0; c < divs; c++) {
      const s00 = getPt(src, r, c), s01 = getPt(src, r, c+1), s10 = getPt(src, r+1, c), s11 = getPt(src, r+1, c+1);
      const d00 = getPt(dst, r, c), d01 = getPt(dst, r, c+1), d10 = getPt(dst, r+1, c), d11 = getPt(dst, r+1, c+1);

      // Треугольник 1
      ctx.save(); ctx.beginPath(); ctx.moveTo(d00.x, d00.y); ctx.lineTo(d01.x, d01.y); ctx.lineTo(d10.x, d10.y); ctx.closePath(); ctx.clip();
      let delta = s00.x * (s01.y - s10.y) + s01.x * (s10.y - s00.y) + s10.x * (s00.y - s01.y);
      if (Math.abs(delta) > 0.001) {
        const bleed = 0.7;
        const dcx = (d00.x + d01.x + d10.x) / 3, dcy = (d00.y + d01.y + d10.y) / 3;
        const d00x = d00.x + (d00.x >= dcx ? bleed : -bleed), d00y = d00.y + (d00.y >= dcy ? bleed : -bleed);
        const d01x = d01.x + (d01.x >= dcx ? bleed : -bleed), d01y = d01.y + (d01.y >= dcy ? bleed : -bleed);
        const d10x = d10.x + (d10.x >= dcx ? bleed : -bleed), d10y = d10.y + (d10.y >= dcy ? bleed : -bleed);
        let a = (d00x * (s01.y - s10.y) + d01x * (s10.y - s00.y) + d10x * (s00.y - s01.y)) / delta;
        let b = (d00y * (s01.y - s10.y) + d01y * (s10.y - s00.y) + d10y * (s00.y - s01.y)) / delta;
        let mC = (d00x * (s10.x - s01.x) + d01x * (s00.x - s10.x) + d10x * (s01.x - s00.x)) / delta;
        let d = (d00y * (s10.x - s01.x) + d01y * (s00.x - s10.x) + d10y * (s01.x - s00.x)) / delta;
        let e = (d00x * (s01.x * s10.y - s10.x * s01.y) + d01x * (s10.x * s00.y - s00.x * s10.y) + d10x * (s00.x * s01.y - s01.x * s00.y)) / delta;
        let f = (d00y * (s01.x * s10.y - s10.x * s01.y) + d01y * (s10.x * s00.y - s00.x * s10.y) + d10y * (s00.x * s01.y - s01.x * s00.y)) / delta;
        ctx.transform(a, b, mC, d, e, f); ctx.drawImage(imgObj, 0, 0);
      }
      ctx.restore();

      // Треугольник 2
      ctx.save(); ctx.beginPath(); ctx.moveTo(d01.x, d01.y); ctx.lineTo(d11.x, d11.y); ctx.lineTo(d10.x, d10.y); ctx.closePath(); ctx.clip();
      delta = s01.x * (s11.y - s10.y) + s11.x * (s10.y - s01.y) + s10.x * (s01.y - s11.y);
      if (Math.abs(delta) > 0.001) {
        const bleed = 0.7;
        const dcx = (d01.x + d11.x + d10.x) / 3, dcy = (d01.y + d11.y + d10.y) / 3;
        const d01x = d01.x + (d01.x >= dcx ? bleed : -bleed), d01y = d01.y + (d01.y >= dcy ? bleed : -bleed);
        const d11x = d11.x + (d11.x >= dcx ? bleed : -bleed), d11y = d11.y + (d11.y >= dcy ? bleed : -bleed);
        const d10x = d10.x + (d10.x >= dcx ? bleed : -bleed), d10y = d10.y + (d10.y >= dcy ? bleed : -bleed);
        let a = (d01x * (s11.y - s10.y) + d11x * (s10.y - s01.y) + d10x * (s01.y - s11.y)) / delta;
        let b = (d01y * (s11.y - s10.y) + d11y * (s10.y - s01.y) + d10y * (s01.y - s11.y)) / delta;
        let mC = (d01x * (s10.x - s11.x) + d11x * (s01.x - s10.x) + d10x * (s11.x - s01.x)) / delta;
        let d = (d01y * (s10.x - s11.x) + d11y * (s01.x - s10.x) + d10y * (s11.x - s01.x)) / delta;
        let e = (d01x * (s11.x * s10.y - s10.x * s11.y) + d11x * (s10.x * s01.y - s01.x * s10.y) + d10x * (s01.x * s11.y - s11.x * s01.y)) / delta;
        let f = (d01y * (s11.x * s10.y - s10.x * s11.y) + d11y * (s10.x * s01.y - s01.x * s10.y) + d10y * (s01.x * s11.y - s11.x * s01.y)) / delta;
        ctx.transform(a, b, mC, d, e, f); ctx.drawImage(imgObj, 0, 0);
      }
      ctx.restore();
    }
  }
}

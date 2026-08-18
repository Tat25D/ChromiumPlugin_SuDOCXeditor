const inpTlx = document.getElementById('persp-tl-x'), inpTly = document.getElementById('persp-tl-y');
const inpTrx = document.getElementById('persp-tr-x'), inpTry = document.getElementById('persp-tr-y');
const inpBlx = document.getElementById('persp-bl-x'), inpBly = document.getElementById('persp-bl-y');
const inpBrx = document.getElementById('persp-br-x'), inpBry = document.getElementById('persp-br-y');

export function syncInputsWithState(perspState) {
  if (!inpTlx) return;
  inpTlx.value = Math.round(perspState.tl.x); inpTly.value = Math.round(perspState.tl.y);
  inpTrx.value = Math.round(perspState.tr.x); inpTry.value = Math.round(perspState.tr.y);
  inpBlx.value = Math.round(perspState.bl.x); inpBly.value = Math.round(perspState.bl.y);
  inpBrx.value = Math.round(perspState.br.x); inpBry.value = Math.round(perspState.br.y);
}

export function bindInputsChange(callback) {
  if (!inpTlx) return;
  const elements = [inpTlx, inpTly, inpTrx, inpTry, inpBlx, inpBly, inpBrx, inpBry];
  elements.forEach(inp => inp.addEventListener('change', () => {
    const currentValues = {
      tl: { x: parseFloat(inpTlx.value) || 0, y: parseFloat(inpTly.value) || 0 },
      tr: { x: parseFloat(inpTrx.value) || 0, y: parseFloat(inpTry.value) || 0 },
      bl: { x: parseFloat(inpBlx.value) || 0, y: parseFloat(inpBly.value) || 0 },
      br: { x: parseFloat(inpBrx.value) || 0, y: parseFloat(inpBry.value) || 0 }
    };
    callback(currentValues);
  }));
}

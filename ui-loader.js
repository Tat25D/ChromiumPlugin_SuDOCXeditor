// Путь: ui-loader.js
// Подгрузка HTML-партиалов: <div data-partial="ui/crop.html"></div> -> содержимое файла
export async function loadPartials() {
  const nodes = Array.from(document.querySelectorAll('[data-partial]'));
  await Promise.all(nodes.map(async (el) => {
    const url = el.getAttribute('data-partial');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      el.outerHTML = (await res.text()).trim();
    } catch (err) {
      console.error('[ui-loader] не удалось загрузить', url, err);
    }
  }));
}

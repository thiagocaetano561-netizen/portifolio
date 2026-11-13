/**
 * Vetorização simples e determinística de uma máscara binária (sem dependências).
 * Segue as bordas dos pixels preenchidos, liga as arestas em contornos fechados
 * e simplifica com Douglas–Peucker. Ideal para marcas geométricas como a da Tryggport.
 */

function simplify(points, epsilon) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let maxD = -1;
  let idx = 0;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = len === 1 && dx === 0 && dy === 0 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= epsilon) return [a, b];
  const left = simplify(points.slice(0, idx + 1), epsilon);
  const right = simplify(points.slice(idx), epsilon);
  return [...left.slice(0, -1), ...right];
}

/** @param {(x:number,y:number)=>boolean} filled */
export function traceContours(width, height, filled, epsilon = 1.1) {
  const key = (x, y) => y * (width + 2) + x;
  const edges = new Map();
  const add = (x1, y1, x2, y2) => {
    const k = key(x1, y1);
    const list = edges.get(k) ?? [];
    list.push([x2, y2]);
    edges.set(k, list);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!filled(x, y)) continue;
      if (!filled(x, y - 1)) add(x, y, x + 1, y);
      if (!filled(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!filled(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!filled(x - 1, y)) add(x, y + 1, x, y);
    }
  const loops = [];
  for (const [k, list] of edges) {
    while (list.length) {
      const startX = k % (width + 2);
      const startY = Math.floor(k / (width + 2));
      const pts = [[startX, startY]];
      let [cx, cy] = list.pop();
      let guard = 0;
      while ((cx !== startX || cy !== startY) && guard++ < 1e6) {
        pts.push([cx, cy]);
        const next = edges.get(key(cx, cy));
        if (!next || next.length === 0) break;
        [cx, cy] = next.pop();
      }
      if (pts.length > 8) loops.push(pts);
    }
  }
  return loops.map((loop) => {
    // fecha o laço e simplifica as "escadinhas" das diagonais
    const closed = [...loop, loop[0]];
    const simple = simplify(closed, epsilon);
    return simple.slice(0, -1);
  });
}

export function contoursToPath(loops, scale = 1, dx = 0, dy = 0) {
  const f = (n) => Math.round(n * 100) / 100;
  return loops
    .map((pts) => "M" + pts.map(([x, y]) => `${f(x * scale + dx)} ${f(y * scale + dy)}`).join("L") + "Z")
    .join("");
}

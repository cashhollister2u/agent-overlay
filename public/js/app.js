// Simple component registry: components register init functions here.
window.__components = window.__components || {}; // { [name]: { init: fn } }

async function loadComponent(name, target, props = {}) {
  const base = `./components/${name}/${name}`;

  const [html, css] = await Promise.all([
    fetch(`${base}.html`).then((r) => r.text()),
    fetch(`${base}.css`).then((r) => r.text()),
  ]);

  // Inject CSS once
  const cssId = `${name}-css`;
  if (!document.getElementById(cssId)) {
    const style = document.createElement("style");
    style.id = cssId;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Create component root container
  const root = document.createElement("div");
  root.dataset.component = name;

  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.flex = "1";
  root.style.minHeight = "0";

  root.innerHTML = html;

  console.log(html);

  document.getElementById(target).appendChild(root);

  // Load JS once (and wait for it)
  await loadComponentScriptOnce(name, `${base}.js`);

  // Call init if provided
  const mod = window.__components[name];
  if (mod && typeof mod.init === "function") {
    mod.init(root, props);
  }

  return root;
}

function loadComponentScriptOnce(name, src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-component="${name}"]`);
    if (existing) return resolve();

    const script = document.createElement("script");
    script.src = src;
    script.async = false; // keep execution order predictable
    script.dataset.component = name;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.body.appendChild(script);
  });
}

function createRegion({
  id,
  row,
  col,
  rowSpan = 1,
  colSpan = 1,
  className = "",
}) {
  const el = document.createElement("div");
  el.id = id;
  el.className = `region ${className}`.trim();

  // 1-based grid lines
  el.style.gridRow = `${row} / span ${rowSpan}`;
  el.style.gridColumn = `${col} / span ${colSpan}`;

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "region-close";
  closeBtn.innerHTML = "×";

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    el.remove();
  });

  el.appendChild(closeBtn);
  return el;
}

function cellsForRect(row, col, rowSpan, colSpan) {
  const cells = [];
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      cells.push(key(r, c));
    }
  }
  return cells;
}

function canPlace(row, col, rowSpan, colSpan) {
  return cellsForRect(row, col, rowSpan, colSpan).every(k => !occupied.has(k));
}

function markOccupied(row, col, rowSpan, colSpan) {
  for (const k of cellsForRect(row, col, rowSpan, colSpan)) occupied.add(k);
}

function unmarkOccupied(row, col, rowSpan, colSpan) {
  for (const k of cellsForRect(row, col, rowSpan, colSpan)) occupied.delete(k);
}

function addRegion(spec) {
  const { row, col, rowSpan = 1, colSpan = 1 } = spec;

  if (!canPlace(row, col, rowSpan, colSpan)) {
    console.warn("Cannot place region: cells occupied");
    return null;
  }

  markOccupied(row, col, rowSpan, colSpan);

  const el = createRegion({
    ...spec,
    className: "region",
    onClose: () => unmarkOccupied(row, col, rowSpan, colSpan),
  });

  app.appendChild(el);
  return el;
}


// Main //

const app = document.getElementById('app');
const occupied = new Set(); 
const key = (r, c) => `${r},${c}`;

(async () => {
  let success = null;
  success = addRegion({ id: "region1", row: 1, col: 1, rowSpan: 2, colSpan: 2 });
  if (success)
    await loadComponent("ai-chat", "region1");
  success = addRegion({ id: "region2", row: 3, col: 2, rowSpan: 2, colSpan: 2 });
  if (success)
    await loadComponent("ai-chat", "region2");
})();
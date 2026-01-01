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

  target.appendChild(root);

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


function cellsForRect(row, col, rowSpan, colSpan) {
  const cells = [];
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) cells.push(key(r,c));
  }
  return cells;
}

function canPlaceRect(occupied, row, col, rowSpan, colSpan) {
  return cellsForRect(row, col, rowSpan, colSpan).every(k => !occupied.has(k));
}

function markRect(occupied, row, col, rowSpan, colSpan) {
  for (const k of cellsForRect(row, col, rowSpan, colSpan)) occupied.add(k);
}

function unmarkRect(occupied, row, col, rowSpan, colSpan) {
  for (const k of cellsForRect(row, col, rowSpan, colSpan)) occupied.delete(k);
}

function enableRegionResizing(app, occupied) {
  let active = null;

  app.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".resize-handle");
    if (!handle) return;

    const region = handle.closest(".region");
    if (!region) return;

    e.preventDefault();
    region.setPointerCapture(e.pointerId);

    const dir = handle.dataset.dir;
    const startSpec = getSpec(region);
    const metrics = getGridMetrics(app);

    // temporarily free the region’s current cells
    unmarkRect(occupied, startSpec.row, startSpec.col, startSpec.rowSpan, startSpec.colSpan);

    active = {
      region,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startSpec,
      metrics,
    };

    region.classList.add("is-resizing");
  });

  app.addEventListener("pointermove", (e) => {
    if (!active) return;

    const { region, dir, startX, startY, startSpec } = active;
    const { cols, rows, cellW, cellH } = getGridMetrics(app);

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const dc = deltaToCells(dx, cellW);
    const dr = deltaToCells(dy, cellH);

    // propose new spec
    let next = { ...startSpec };

    const minSpan = 1;

    const resizeE = dir.includes("e");
    const resizeW = dir.includes("w");
    const resizeS = dir.includes("s");
    const resizeN = dir.includes("n");

    if (resizeE) next.colSpan = Math.max(minSpan, startSpec.colSpan + dc);
    if (resizeS) next.rowSpan = Math.max(minSpan, startSpec.rowSpan + dr);

    if (resizeW) {
      const newCol = startSpec.col + dc;
      const newSpan = startSpec.colSpan - dc;
      if (newSpan >= minSpan) {
        next.col = newCol;
        next.colSpan = newSpan;
      }
    }

    if (resizeN) {
      const newRow = startSpec.row + dr;
      const newSpan = startSpec.rowSpan - dr;
      if (newSpan >= minSpan) {
        next.row = newRow;
        next.rowSpan = newSpan;
      }
    }

    // clamp within grid
    next.col = Math.max(1, Math.min(next.col, cols));
    next.row = Math.max(1, Math.min(next.row, rows));
    next.colSpan = Math.max(minSpan, Math.min(next.colSpan, cols - next.col + 1));
    next.rowSpan = Math.max(minSpan, Math.min(next.rowSpan, rows - next.row + 1));

    // occupancy check
    if (canPlaceRect(occupied, next.row, next.col, next.rowSpan, next.colSpan)) {
      applyGrid(region, next);
    }
  });

  function endResize(e) {
    if (!active) return;

    const { region, startSpec } = active;
    const finalSpec = getSpec(region);

    // commit occupancy at final spec
    markRect(occupied, finalSpec.row, finalSpec.col, finalSpec.rowSpan, finalSpec.colSpan);

    region.classList.remove("is-resizing");
    active = null;
  }

  app.addEventListener("pointerup", endResize);
  app.addEventListener("pointercancel", endResize);
}

function applyGrid(el, spec) {
  el.style.gridRow = `${spec.row} / span ${spec.rowSpan}`;
  el.style.gridColumn = `${spec.col} / span ${spec.colSpan}`;
  el.dataset.row = String(spec.row);
  el.dataset.col = String(spec.col);
  el.dataset.rowSpan = String(spec.rowSpan);
  el.dataset.colSpan = String(spec.colSpan);
}

function getSpec(el) {
  return {
    row: Number(el.dataset.row),
    col: Number(el.dataset.col),
    rowSpan: Number(el.dataset.rowSpan),
    colSpan: Number(el.dataset.colSpan),
  };
}

function addResizeHandles(regionEl) {
  const dirs = ["n","e","s","w","ne","nw","se","sw"];
  for (const d of dirs) {
    const h = document.createElement("div");
    h.className = `resize-handle ${d}`;
    h.dataset.dir = d;
    regionEl.appendChild(h);
  }
}

function getGridMetrics(app) {
  const rect = app.getBoundingClientRect();
  const cs = getComputedStyle(app);

  // assumes repeat(N, 1fr) like you have
  const cols = cs.gridTemplateColumns.split(" ").length;
  const rows = cs.gridTemplateRows.split(" ").length;

  const gapX = parseFloat(cs.columnGap || cs.gap || "0") || 0;
  const gapY = parseFloat(cs.rowGap || cs.gap || "0") || 0;

  // approximate cell sizes (good enough for 1fr layouts)
  const cellW = (rect.width - gapX * (cols - 1)) / cols;
  const cellH = (rect.height - gapY * (rows - 1)) / rows;

  return { rect, cols, rows, cellW, cellH, gapX, gapY };
}

// Given a delta in px, how many whole cells did we cross?
function deltaToCells(deltaPx, cellSize) {
  return Math.round(deltaPx / cellSize);
}

function createRegion(spec) {
  const el = document.createElement("div");
  el.className = "region";
  applyGrid(el, spec);

  // close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "region-close";
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const s = getSpec(el);
    unmarkRect(occupied, s.row, s.col, s.rowSpan, s.colSpan);
    el.remove();
  });
  el.appendChild(closeBtn);

  addResizeHandles(el);
  return el;
}

function addRegion(spec) {
  const { row, col, rowSpan = 1, colSpan = 1 } = spec;

  if (!canPlaceRect(occupied, row, col, rowSpan, colSpan)) return null;
  markRect(occupied, row, col, rowSpan, colSpan);

  const el = createRegion({ row, col, rowSpan, colSpan });
  app.appendChild(el);
  return el;
}


// Main //

const app = document.getElementById('app');
const occupied = new Set(); 
const key = (r, c) => `${r},${c}`;

(async () => {
  enableRegionResizing(app, occupied);
  let regionEl = addRegion({ row: 1, col: 1, rowSpan: 2, colSpan: 2 });
  if (regionEl) await loadComponent("ai-chat", regionEl);
  regionEl = addRegion({ row: 3, col: 3, rowSpan: 1, colSpan: 1 });
  if (regionEl) await loadComponent("ai-chat", regionEl);
  // success = addRegion({ id: "region2", row: 3, col: 2, rowSpan: 2, colSpan: 2 });
  // if (success)
  //   await loadComponent("ai-chat", "region2");
})();
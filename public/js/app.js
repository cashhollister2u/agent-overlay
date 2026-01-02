// =============================
// Helpers
// =============================
function* range(start, end, step = 1) {
  for (let i = start; i < end; i += step) {
    yield i;
  }
}
function toggleRegions() {
  const showBtn = document.querySelector('[data-action="showRegions"]');
  const hideBtn = document.querySelector('[data-action="hideRegions"]');

  if (hideBtn && !hideBtn.classList.contains("hidden")) {
    hideBtn.click();
  } else if (showBtn) {
    showBtn.click();
  }
}

// =============================
// ComponentLoader
// =============================
class ComponentLoader {
  constructor() {
    // Simple component registry: components register init functions here.
    window.__components = window.__components || {}; // { [name]: { init: fn } }
    this.loadedScripts = new Set();
    this.loadedCss = new Set();
    this.registry = this.listAvailable();
  }

  async listAvailable() {
    if (this.registry) return this.registry;
    this.registry = await fetch("./components/components.json").then(r => r.json());
    return this.registry;
  }

  async load(name, targetEl, props = {}) {
    const base = `./components/${name}/${name}`;

    const [html, css] = await Promise.all([
      fetch(`${base}.html`).then((r) => r.text()),
      fetch(`${base}.css`).then((r) => r.text()),
    ]);

    // CSS once
    if (!this.loadedCss.has(name)) {
      const style = document.createElement("style");
      style.dataset.componentCss = name;
      style.textContent = css;
      document.head.appendChild(style);
      this.loadedCss.add(name);
    }

    // component root
    const root = document.createElement("div");
    root.dataset.component = name;
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.flex = "1";
    root.style.minHeight = "0";

    // NOTE: if html is trusted local template files, innerHTML is fine.
    // If it ever becomes user-controlled, sanitize it.
    root.innerHTML = html;

    targetEl.appendChild(root);

    // JS once
    await this.loadScriptOnce(name, `${base}.js`);

    // init
    const mod = window.__components[name];
    if (mod && typeof mod.init === "function") {
      mod.init(root, props);
    }

    return root;
  }

  loadScriptOnce(name, src) {
    if (this.loadedScripts.has(name)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-component="${name}"]`);
      if (existing) {
        this.loadedScripts.add(name);
        return resolve();
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.component = name;
      script.onload = () => {
        this.loadedScripts.add(name);
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }
}

// =============================
// Helpers
// =============================
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));


// =============================
// Region (single instance)
// =============================
class Region {
  constructor(layout, spec) {
    this.layout = layout;
    this.regionType = spec.regionType || "";  
    this.spec = { ...spec }; // { row, col, rowSpan, colSpan }
    this.el = document.createElement("div");
    this.el.className = "region";
    if (this.regionType) this.el.dataset.regionType = this.regionType;

    // store spec on dataset (useful for debugging / CSS hooks)
    this.applyGrid(this.spec);

    // Header bar (your "region-handle")
    const header = document.createElement("div");
    header.className = "region-handle app-background";

    const closeBtn = document.createElement("button");
    closeBtn.className = "region-close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.layout.removeRegion(this);
    });

    header.appendChild(closeBtn);
    this.el.appendChild(header);

    // Resize handles
    this.addResizeHandles();
  }

  applyGrid(spec) {
    this.spec = { ...spec };
    this.el.style.gridRow = `${spec.row} / span ${spec.rowSpan}`;
    this.el.style.gridColumn = `${spec.col} / span ${spec.colSpan}`;

    this.el.dataset.row = String(spec.row);
    this.el.dataset.col = String(spec.col);
    this.el.dataset.rowSpan = String(spec.rowSpan);
    this.el.dataset.colSpan = String(spec.colSpan);
  }

  addResizeHandles() {
    const dirs = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];
    for (const d of dirs) {
      const h = document.createElement("div");
      h.className = `resize-handle ${d}`;
      h.dataset.dir = d;
      this.el.appendChild(h);
    }
  }
}

// =============================
// GridLayout (owns occupancy + resizing)
// =============================
class GridLayout {
  constructor(appEl) {
    this.appEl = appEl;
    this.styles = getComputedStyle(appEl);

    this.cols = parseInt(this.styles.getPropertyValue("--grid-cols"), 10);
    this.rows = parseInt(this.styles.getPropertyValue("--grid-rows"), 10);
    this.occupied = new Set(); // "r,c"
    this.regions = new Set();

    this.active = null;

    // bind once
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    appEl.addEventListener("pointerdown", this.onPointerDown);
    appEl.addEventListener("pointermove", this.onPointerMove);
    appEl.addEventListener("pointerup", this.onPointerUp);
    appEl.addEventListener("pointercancel", this.onPointerUp);
    
    this.bindEvents();
  }

  key(r, c) {
    return `${r},${c}`;
  }

  bindEvents() {
      document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const action = btn.dataset.action;

        switch (action) {
          case "showRegions":
            this.showRegions(btn);
            break;
          case "hideRegions":
            this.hideRegions(btn);
            break;
          default:
            break;
        }
      });
    }
  
  async showRegions(btn) {
    btn?.classList.add("hidden");
    document.querySelector('[data-action="hideRegions"]')?.classList.remove("hidden");
    this.regions.forEach( region => {
      region.el.classList.add("is-disabled")
    })
    for (const r of range(1, this.rows+1)) {
      for (const c of range(1, this.cols+1)) {
        if (this.canPlaceRect(r, c, 1, 1)) {
          const tmpRegion = layout.addRegion({ row: r, col: c, rowSpan: 1, colSpan: 1, regionType: "available-region" });
          if (tmpRegion) await loader.load("available-region", tmpRegion.el, { loader, layout });
        }
      }
    }
  }

  async hideRegions(btn) {
    btn?.classList.add("hidden");
    this.regions.forEach( region => {
      region.el.classList.remove("is-disabled")
    })
    document.querySelector('[data-action="showRegions"]')?.classList.remove("hidden");
    const toRemove = [...this.regions].filter(r => r.el.dataset.regionType === "available-region");
    for (const region of toRemove) this.removeRegion(region);
  }

  findRegionByEl(regionEl) {
    for (const r of this.regions) {
      if (r.el === regionEl) return r;
    }
    return null;
  }

  cellsForRect(row, col, rowSpan, colSpan) {
    const cells = [];
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        cells.push(this.key(r, c));
      }
    }
    return cells;
  }

  canPlaceRect(row, col, rowSpan, colSpan) {
    return this.cellsForRect(row, col, rowSpan, colSpan).every((k) => !this.occupied.has(k));
  }

  markRect(row, col, rowSpan, colSpan) {
    for (const k of this.cellsForRect(row, col, rowSpan, colSpan)) this.occupied.add(k);
  }

  unmarkRect(row, col, rowSpan, colSpan) {
    for (const k of this.cellsForRect(row, col, rowSpan, colSpan)) this.occupied.delete(k);
  }

  getGridMetrics() {
    const rect = this.appEl.getBoundingClientRect();
    const cs = getComputedStyle(this.appEl);

    const cols = cs.gridTemplateColumns.split(" ").length;
    const rows = cs.gridTemplateRows.split(" ").length;

    const gapX = parseFloat(cs.columnGap || cs.gap || "0") || 0;
    const gapY = parseFloat(cs.rowGap || cs.gap || "0") || 0;

    const cellW = (rect.width - gapX * (cols - 1)) / cols;
    const cellH = (rect.height - gapY * (rows - 1)) / rows;

    return { rect, cols, rows, cellW, cellH };
  }

  deltaToCells(deltaPx, cellSize) {
    return Math.round(deltaPx / cellSize);
  }

  addRegion(spec) {
    const { row, col, rowSpan = 1, colSpan = 1, regionType } = spec;

    if (!this.canPlaceRect(row, col, rowSpan, colSpan)) {
      console.warn("Cannot place region: cells occupied", spec);
      return null;
    }

    this.markRect(row, col, rowSpan, colSpan);

    const region = new Region(this, { row, col, rowSpan, colSpan, regionType });
    this.appEl.appendChild(region.el);
    this.regions.add(region);

    return region;
  }

  removeRegion(region) {
    const s = region.spec;
    this.unmarkRect(s.row, s.col, s.rowSpan, s.colSpan);
    region.el.remove();
    this.regions.delete(region);
  }

  findRegionFromEvent(e) {
    const regionEl = e.target.closest(".region");
    if (!regionEl) return null;
    return [...this.regions].find(r => r.el === regionEl) || null;
  }

  // ---------- resizing ----------
  onPointerDown(e) {
    const region = this.findRegionFromEvent(e);
    if (!region) return;

    const resizeHandle = e.target.closest(".resize-handle");
    const dragHandle = e.target.closest(".region-handle");
    const removeBtn = e.target.closest(".region-close");

    if (removeBtn) {
      this.removeRegion(region)
      return
    }

    if (!resizeHandle && !dragHandle) return;


    e.preventDefault();
    region.el.setPointerCapture(e.pointerId);

    const startSpec = { ...region.spec };
    const metrics = this.getGridMetrics();

    // free current occupancy so it can resize over its own space
    this.unmarkRect(startSpec.row, startSpec.col, startSpec.rowSpan, startSpec.colSpan);

    if (resizeHandle) {
      this.active = {
        mode: "resize",
        region,
        dir: resizeHandle.dataset.dir,
        startX: e.clientX,
        startY: e.clientY,
        startSpec,
        metrics
      };
      region.el.classList.add("is-resizing");
      return;
    }

    this.active = {
      mode: "drag",
      region,
      startX: e.clientX,
      startY: e.clientY,
      startSpec,
      metrics
    };
    region.el.classList.add("is-dragging");
    return;
  }

  onPointerMove(e) {
    if (!this.active) return;

    const { region, startX, startY, startSpec } = this.active;
    const { cols, rows, cellW, cellH } = this.getGridMetrics();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const dc = this.deltaToCells(dx, cellW);
    const dr = this.deltaToCells(dy, cellH);

    if (this.active.mode === "drag") {
      let next = { ...startSpec };

      next.col = clamp(startSpec.col + dc, 1, cols);
      next.row = clamp(startSpec.row + dr, 1, rows);

      // keep current span inside bounds
      next.colSpan = clamp(startSpec.colSpan, 1, cols - next.col + 1);
      next.rowSpan = clamp(startSpec.rowSpan, 1, rows - next.row + 1);

      if (this.canPlaceRect(next.row, next.col, next.rowSpan, next.colSpan)) {
        region.applyGrid(next);
      }
      return;
    }

    const dir = this.active.dir;
    const minSpan = 1;
    let next = { ...startSpec };

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

    // clamp to grid
    next.col = clamp(next.col, 1, cols);
    next.row = clamp(next.row, 1, rows);
    next.colSpan = clamp(next.colSpan, minSpan, cols - next.col + 1);
    next.rowSpan = clamp(next.rowSpan, minSpan, rows - next.row + 1);

    // only apply if legal
    if (this.canPlaceRect(next.row, next.col, next.rowSpan, next.colSpan)) {
      region.applyGrid(next);
    }
  }

  onPointerUp(e) {
    if (!this.active) return;

    const { region, startSpec } = this.active;
    const finalSpec = region.spec;

    // commit occupancy
    if (!this.canPlaceRect(finalSpec.row, finalSpec.col, finalSpec.rowSpan, finalSpec.colSpan)) {
      region.applyGrid(startSpec);
      this.markRect(startSpec.row, startSpec.col, startSpec.rowSpan, startSpec.colSpan);
    } else {
      // commit occupancy
      this.markRect(finalSpec.row, finalSpec.col, finalSpec.rowSpan, finalSpec.colSpan);
    }

    region.el.classList.remove("is-resizing", "is-dragging");
    this.active = null;
  }
}

// =============================
// Main
// =============================
const app = document.getElementById("app");
const layout = new GridLayout(app);
const loader = new ComponentLoader();


(async () => {
  window.overlayAPI?.onToggleRegions(() => {
    toggleRegions();
  });
  console.log(layout)
  if (layout.occupied.size <= 0)
  {
    const starter = layout.addRegion({ row: 1, col: 2, rowSpan: 4, colSpan: 2 });
    if (starter) await loader.load("ai-chat", starter.el);
  }
})();
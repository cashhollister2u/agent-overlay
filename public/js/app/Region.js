export default class Region {
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

export function toggleRegions() {
  const showBtn = document.querySelector('[data-action="showRegions"]');
  const hideBtn = document.querySelector('[data-action="hideRegions"]');

  if (hideBtn && !hideBtn.classList.contains("hidden")) {
    hideBtn.click();
  } else if (showBtn) {
    showBtn.click();
  }
}
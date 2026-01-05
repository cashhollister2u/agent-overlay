import ComponentLoader from './app/ComponentLoader.js';
import GridLayout from './app/GridLayout.js';
import { toggleRegions } from './app/Region.js';

const app = document.getElementById("app");   
const loader = new ComponentLoader();
const layout = new GridLayout(app, loader);
(async () => {
  // Node Listeners
  window.overlayAPI?.onToggleRegions(() => {
    toggleRegions();
  });
  window.overlayAPI?.addWidget(async (payload) => {
    console.log('AITools adding widget...')
    const { widget_name, row_index, column_index, row_span, column_span } = payload;
    const newRegion = layout.addRegion({ row: row_index, col: column_index, rowSpan: row_span, colSpan:column_span });
    if (newRegion) await loader.load(widget_name, newRegion.el);
  });

  // Default View
  if (layout.occupied.size <= 0)
  {
    const starter = layout.addRegion({ row: 1, col: 2, rowSpan: 4, colSpan: 2 });
    if (starter) await loader.load("ai-chat", starter.el);
  }
})();
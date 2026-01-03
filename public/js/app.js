import ComponentLoader from './app/ComponentLoader.js';
import GridLayout from './app/GridLayout.js';
import { toggleRegions } from './app/Region.js';

const app = document.getElementById("app");   
const loader = new ComponentLoader();
const layout = new GridLayout(app, loader);
(async () => {
  window.overlayAPI?.onToggleRegions(() => {
    toggleRegions();
  });
  if (layout.occupied.size <= 0)
  {
    const starter = layout.addRegion({ row: 1, col: 2, rowSpan: 4, colSpan: 2 });
    if (starter) await loader.load("ai-chat", starter.el);
  }
})();
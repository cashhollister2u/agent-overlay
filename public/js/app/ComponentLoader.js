export default class ComponentLoader {
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

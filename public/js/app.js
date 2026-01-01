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

// Example usage:
(async () => {
  await loadComponent("ai-chat", "region2");
  await loadComponent("tooltip");
})();
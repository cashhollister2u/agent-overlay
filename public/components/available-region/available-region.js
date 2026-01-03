(function () {
    window.__components = window.__components || {};
    
    class AvilableRegion {
        constructor(root, props = {}) {
            this.root = root;
            this.props = props;
            this.loader = this.props.loader;
            this.layout = this.props.layout;
            this.registry = this.loader.registry;
            this.regionEl = this.root.closest(".region");
            this.region = this.layout.findRegionByEl(this.regionEl);

            const $ = (sel) => this.root.querySelector(sel);
            
            this.optContainer = $('[data-role="availableOptions"]');
            this.initOptions()
        }

        initOptions() {
            for (const [name, info] of Object.entries(this.registry)) {
                const optBtn = document.createElement("button");
                optBtn.textContent = name;
                optBtn.classList.add("app-background")
                optBtn.classList.add("app-btn")
                optBtn.addEventListener("click", () => {
                    this.layout.removeRegion(this.region);
                    let newSpec = {...this.region.spec};
                    newSpec.regionType = name;
                    const newRegion = this.layout.addRegion(newSpec);
                    if (newRegion) this.loader.load(name, newRegion.el, {}, true);
                })
                this.optContainer.appendChild(optBtn);
            }
        }
    }

    window.__components["available-region"] = {
        init(root, props) {
            root.__availableRegion = new AvilableRegion(root, props);
        },
    };
})();
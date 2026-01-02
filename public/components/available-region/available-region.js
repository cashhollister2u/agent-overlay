(function () {
    window.__components = window.__components || {};
    
    class AvilableRegion {
        constructor(root, props = {}) {
            this.root = root;
            this.props = props;
            this.registry = this.props.loader.registry;

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
                optBtn.classList.add("app-background")
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
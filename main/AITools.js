class AITools {
    constructor(functionName) {
        this.functionName = functionName
        this.availableFunctions = {
            "addWidget": this.addWidget
        }
    }

    async validate() {
        console.log(Object.keys(this.availableFunctions))
        console.log(this.functionName)
        return Object.keys(this.availableFunctions).includes(this.functionName)
    }

    async execute(win, args) {
        const selectedFunction = this.availableFunctions[this.functionName]
        selectedFunction(win, args)
    }

    async addWidget(win, args) {
        console.log('AITools adding widget...')
        win.webContents.send("addWidget", args)
    }
}

module.exports = { AITools }
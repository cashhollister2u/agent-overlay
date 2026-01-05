class Response {
    constructor(success, response, skipAIResponse) {
        this.success = success;
        this.response = response;
        this.skipAIResponse = skipAIResponse;
    }
}

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
        return selectedFunction(win, args)
    }

    async addWidget(win, args) {
        try {
            win.webContents.send("addWidget", args)
            const { widget_name, row_index, column_index, row_span, column_span } = args;
            const response = `
            Added Widget: [ ${widget_name} ]
            Row:${row_index} 
            Column:${column_index} 
            Width:${column_span} 
            Height:${row_span}`

            return new Response(true, response, true)
        }
        catch (err) {
            return new Response(false, err, false)
        }
    }
}

module.exports = { AITools }
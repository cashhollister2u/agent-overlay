const { startMCP, listTools, callTool, stopMcpServer } = require('./Mcp');
const http = require("http");

async function chatWithLLM(message, history, toolContext, onChunk) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const body = JSON.stringify({
      model: 'mistral',
      stream: true,
      messages: [
        {
          role: "system",
          content: `[ Instructions ] You are helpful assistant. \nUtilize markdown when appropriate`,
        },
        ...history, 
        { role: "system", content: toolContext},
        { role: "user", content: message }]
    });

    req.write(body);
    req.end();

    let buffer = "";

    req.on("response", (res) => {
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");

        buffer = lines.pop(); // save incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content || "";

            if (content && typeof onChunk === "function") {
              onChunk(content);
            }
          } catch (err) {
            console.error("Stream parse error:", err);
          }
        }
      });

      res.on("end", () => {
        resolve();
      });
    });

    req.on("error", (err) => reject(err));
  });
}


async function extractToolCallJsonObject(text) {
  const match = text.match(
    /(\{\s*"tool"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[\s\S]*?\}\s*\})/
  );
  return match ? match[1].trim() : null;
}

async function validateTool(content) {
  try {
    const toolString = await extractToolCallJsonObject(content);
    const tool = JSON.parse(toolString);
    const keys = Object.keys(tool)
    const availableTools = await listTools();
    
    const validTool = Array.isArray(availableTools.tools) && availableTools.tools.some(t => t.name === tool.tool);
    if (keys.length !== 2 || !keys.includes("tool") || !keys.includes("arguments") || !validTool) 
      return {
        tool:`[Error] Invalid tool call. Tools must adhere to the tool template: 
              {
                "tool": tool_name,
                "arguments": {}
              }`,
        success: false};
    return {
      tool: tool,
      success: true
    };
  } catch (err) {
    console.log("Invalid JSON in LLM response: " + err.message);
    return {
        tool:`[Error] Invalid tool call. Tools must adhere to the tool template: 
              {
                "tool": tool_name,
                "arguments": {}
              }`,
        success: false};
  }
}

async function selectTool(message, history, feedback, widgets) {
  message = `${feedback}\n ${message}`
  const tools = await listTools();
  console.log(tools)
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 11434,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      (res) => {
        let data = "";

        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);

            const content = parsed.message?.content;
            resolve({
              raw: parsed,
              content
            });
          } catch (err) {
            reject(new Error("Failed to parse LLM response: " + err.message));
          }
        });
      }
    );

    req.on("error", reject);

    const body = JSON.stringify({
      model: 'mistral',
      stream: false,
      messages: [
        {
          role: "system",
          content: `[ Instructions ] You are a tool calling assistant. Only respond using the json template no other text.\n
                    Available Tools:\n
                    ${JSON.stringify(tools, null, 2)}

                    Respond only by filling out the template below:
                    {
                      "tool": tool_name,
                      "arguments": {}
                    }`
        },
        ...history,
        { role: "user", content: message }
      ]
    });

    req.write(body);
    req.end();
  });
}

module.exports = { selectTool, validateTool, chatWithLLM };
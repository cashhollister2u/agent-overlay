const { spawn } = require("child_process");
const path = require("path");

let mcpProcess = null;
let mcpTools = []; 

async function startMCP() {
  const pyPath = process.platform === 'win32'
  ? path.join(__dirname, "..", "mcp", ".venv", "Scripts", "python.exe")
  : path.join(__dirname, "..", "mcp", ".venv", "bin", "python");

  const serverPath = path.join(__dirname, "mcp", "mcp_server.py");

  const py = spawn(pyPath, ["-u", serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  py.stderr.on("data", (d) => console.log("[py:err]", d.toString()));
  py.stdout.on("data", (d) => console.log("[py:out]", d.toString()));

  py.on("exit", (code) => console.log("python exited", code));

  // establishes handshake
  const initMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "v1",
      capabilities: {},
      clientInfo: {
        name: "electron-app",
        version: "1.0.0"
      }
    }
  }) + "\n";

  //tests that the connection is established
  const pingMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "custom_ping",
      arguments: {}
    }
  }) + "\n";

  // Send ping after receiving init response
  py.stdout.on("data", (d) => {
    const line = d.toString();
    try {
      const msg = JSON.parse(line);
      if (msg.id === 0 && msg.result !== undefined) {
        console.log("Initialization complete, sending ping...");
        py.stdin.write(pingMsg);
      }
    } catch (err) {
      console.error("Failed to parse py stdout:", err);
    }
  });

  // Kick off initialization
  py.stdin.write(initMsg);
}



// Call MCP tool via JSON-RPC
async function callMcpTool(toolName, args) {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    const msg = JSON.stringify({
      jsonrpc: "2.0",
      id: id,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    }) + "\n";

    const handler = (d) => {
      try {
        const response = JSON.parse(d.toString());
        if (response.id === id) {
          mcpProcess.stdout.off("data", handler);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        }
      } catch (err) {
        // Not our response, ignore
      }
    };

    mcpProcess.stdout.on("data", handler);
    mcpProcess.stdin.write(msg);

    // Timeout after 30 seconds
    setTimeout(() => {
      mcpProcess.stdout.off("data", handler);
      reject(new Error("Tool call timeout"));
    }, 30000);
  });
}

function stopMcpServer() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

module.exports = { startMCP, stopMcpServer };
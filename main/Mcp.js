const { spawn } = require("child_process");
const path = require("path");

let mcpProcess = null;

let stdoutBuffer = "";
let nextId = 1;
const pending = new Map(); // id -> { resolve, reject, timeout }

function sendRpc(method, params) {
  return new Promise((resolve, reject) => {
    if (!mcpProcess) return reject(new Error("MCP process not started"));

    const id = nextId++;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";

    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`MCP timeout calling ${method}`));
    }, 30000);

    pending.set(id, { resolve, reject, timeout });
    mcpProcess.stdin.write(msg);
  });
}

async function startMCP() {
  if (mcpProcess) return; // already running

  const pyPath =
    process.platform === "win32"
      ? path.join(__dirname, "..", "mcp", ".venv", "Scripts", "python.exe")
      : path.join(__dirname, "..", "mcp", ".venv", "bin", "python");

  const serverPath = path.join(__dirname, "..", "mcp", "mcp_server.py");

  const py = spawn(pyPath, ["-u", serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  mcpProcess = py;

  py.stderr.on("data", (d) => console.log("[mcp:err]", d.toString()));

  py.stdout.on("data", (d) => {
    stdoutBuffer += d.toString("utf8");
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop(); // keep incomplete last line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let msg;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        console.log("[mcp:out non-json]", trimmed);
        continue;
      }

      // Resolve pending requests by id
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve, reject, timeout } = pending.get(msg.id);
        clearTimeout(timeout);
        pending.delete(msg.id);

        if (msg.error) reject(new Error(msg.error.message || "MCP error"));
        else resolve(msg.result);
      } else {
        // notifications/logs from server (optional)
        // console.log("[mcp:msg]", msg);
      }
    }
  });

  py.on("exit", (code) => {
    console.log("MCP python exited", code);
    mcpProcess = null;

    for (const [id, p] of pending.entries()) {
      clearTimeout(p.timeout);
      p.reject(new Error("MCP server exited"));
      pending.delete(id);
    }
  });

  // 1) Handshake
  await sendRpc("initialize", {
    protocolVersion: "v1",
    capabilities: {},
    clientInfo: { name: "electron-app", version: "1.0.0" },
  });

  console.log("MCP initialized");
}

async function listTools() {
  // Standard MCP method
  return sendRpc("tools/list", {});
}

async function callTool(name, args = {}) {
  return sendRpc("tools/call", {
    name,
    arguments: args,
  });
}

function stopMcpServer() {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

module.exports = { startMCP, listTools, callTool, stopMcpServer };
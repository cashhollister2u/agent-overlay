# mcp/mcp_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("electron-mcp")

@mcp.tool()
def custom_ping() -> dict:
    return {"pong": "pong"}

if __name__ == "__main__":
    # Runs an MCP server over stdio
    mcp.run()
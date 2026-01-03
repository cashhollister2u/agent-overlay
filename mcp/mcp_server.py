# mcp/mcp_server.py
from mcp.server.fastmcp import FastMCP
from datetime import datetime

mcp = FastMCP("electron-mcp")

@mcp.tool()
def custom_ping() -> dict:
    """ Tool used to verify mcp server connection """
    return {"pong": "pong"}

@mcp.tool()
def get_datetime() -> dict:
    """ Tool to get current datetime """
    return {"Current Datetime": datetime.now().strftime('%M%D%Y %H%M%S')}

@mcp.tool()
def add(a: int, b: int) -> dict:
    """Add two numbers."""
    return {"result": a + b}

if __name__ == "__main__":
    # Runs an MCP server over stdio
    mcp.run()
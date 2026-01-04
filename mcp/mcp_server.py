# mcp/mcp_server.py
from mcp.server.fastmcp import FastMCP
from datetime import datetime

mcp = FastMCP("electron-mcp")

@mcp.tool()
def custom_ping() -> dict:
    """ Tool used to verify server connection """
    return {"content": "pong"}

@mcp.tool()
def get_datetime() -> dict:
    """ Tool to get current datetime """
    return {"content": f'Current time [%Y/%m/%d %H:%M:%S]: {datetime.now().strftime('%Y/%m/%d %H:%M:%S')}'}

@mcp.tool()
def add(a: int, b: int) -> dict:
    """Add two numbers."""
    return {"content": a + b}

@mcp.tool()
def Conversation() -> dict:
    """ Handles requests not related to any of the available tools no arguments required """
    return {"content": "[ Instructions ] You are a helpful AI assistant. \nUtilize markdown when appropriate"}

if __name__ == "__main__":
    # Runs an MCP server over stdio
    mcp.run()
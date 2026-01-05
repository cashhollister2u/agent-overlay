# mcp/mcp_server.py
from mcp.server.fastmcp import FastMCP
from dataclasses import dataclass, asdict
from datetime import datetime
import json

@dataclass
class McpResponse:
    content: str
    function_name: str
    args: dict
        

mcp = FastMCP("electron-mcp")
with open('./public/components/components.json', 'r') as file:
    registered_widgets = json.load(file)

add_widget_desc = f""" 
    Tool used to add widgets to the 4x4 grid application overlay [Index values range from 1 - 4] 
    Available widget_names:
    {json.dumps(registered_widgets)}
    """
@mcp.tool(description=add_widget_desc)
def add_widget(widget_name:str, column_index:int, row_index:int, column_span:int, row_span:int) -> dict:
    return asdict(McpResponse(
        f"Tell the user that a widget has been created at this location [do not explain how to create a widget]: column_index:{column_index}, row_index:{row_index}, column_span:{column_span}, row_span:{row_span}",
        "addWidget",
        {
            "widget_name": widget_name,
            "column_index": column_index, 
            "row_index": row_index, 
            "column_span": column_span, 
            "row_span":row_span
        }))

@mcp.tool()
def get_datetime() -> dict:
    """ Tool to get current datetime """
    return asdict(McpResponse(f'Current time [%Y/%m/%d %H:%M:%S]: {datetime.now().strftime('%Y/%m/%d %H:%M:%S')}', "", {}))

@mcp.tool()
def add(a: int, b: int) -> dict:
    """Add two numbers."""
    return asdict(McpResponse(str( a + b), "", {}))

@mcp.tool()
def Conversation() -> dict:
    """ Handles requests not related to any of the available tools no arguments required """
    return asdict(McpResponse("[ Instructions ] You are a helpful AI assistant. \nUtilize markdown when appropriate", "", {}))

if __name__ == "__main__":
    # Runs an MCP server over stdio
    mcp.run()
from tools import get_customer_package, get_data_balance, create_support_ticket, change_customer_package

class MockMCPClient:
    """
    Mocks an MCP Client connection to a remote Model Context Protocol server.
    In a real production environment, this would use the official MCP SDK
    to connect via stdio or SSE to an isolated business API tool server.
    """
    def __init__(self):
        # We expose the local functions as if they were remote MCP tools
        self.tools = [
            get_customer_package,
            get_data_balance,
            create_support_ticket,
            change_customer_package
        ]
        self.connected = True
        
    def get_tools(self):
        if not self.connected:
            raise Exception("MCP Client not connected to MCP Server")
        return self.tools

mcp_client = MockMCPClient()

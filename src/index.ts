import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";

import { handleCallTool, handleListTools } from "./handlers/index.js";

dotenv.config();

/**
 * Main function to start the MCP server
 * 
 * @async
 * @returns {Promise<void>}
 */
async function main() {
    const transport = new StdioServerTransport();
    const server = new Server(
        {
            name: "jira-mcp-server",
            version: "0.1.0",
        },
        {
            capabilities: {
                resources: {},
                tools: {},
            },
        }
    );


    server.setRequestHandler(ListToolsRequestSchema, handleListTools);
    server.setRequestHandler(CallToolRequestSchema, handleCallTool);

    await server.connect(transport);
    console.log("Jira MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});
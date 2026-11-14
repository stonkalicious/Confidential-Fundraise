import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createRaiseMcpServer, validateApiBaseUrl } from "./raise-mcp";

try {
  validateApiBaseUrl();
  serveStdio(() => createRaiseMcpServer(), {
    onerror: () => {
      process.stderr.write("Agent Raised MCP transport error.\n");
    },
  });
} catch {
  process.stderr.write("Agent Raised MCP could not start. Check AGENT_RAISED_API_BASE_URL.\n");
  process.exitCode = 1;
}

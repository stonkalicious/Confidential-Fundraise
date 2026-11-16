import { createMcpHandler, validateHostHeader } from "@modelcontextprotocol/server";
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { createRaiseMcpServer } from "../raise-mcp";

const router: IRouter = Router();

const remoteMcpHandler = createMcpHandler(
  () =>
    createRaiseMcpServer({
      includeGetRaise: true,
      includeTestSettlement: false,
      retainCommitSessions: false,
    }),
  {
    legacy: "stateless",
    responseMode: "json",
    onerror: (error) => {
      logger.error({ errorName: error.name }, "Remote MCP protocol error");
    },
  },
);

function parseHostname(value: string): string | undefined {
  const candidate = value.trim();
  if (!candidate) return undefined;
  try {
    return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).hostname;
  } catch {
    return undefined;
  }
}

function allowedHostnames(): string[] {
  const configuredDomains = [
    process.env.REPLIT_DOMAINS,
    process.env.REPLIT_DEV_DOMAIN,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map(parseHostname)
    .filter((value): value is string => Boolean(value));

  const hosts = [
    "agentraised.com",
    "confidential-fundraise-desk.replit.app",
    ...configuredDomains,
  ];
  if (process.env.NODE_ENV !== "production") {
    hosts.push("localhost", "127.0.0.1", "[::1]");
  }
  return [...new Set(hosts)];
}

router.all("/", async (req, res): Promise<void> => {
  const hostCheck = validateHostHeader(req.get("host"), allowedHostnames());
  if (!hostCheck.ok) {
    req.log.warn({ reason: hostCheck.errorCode }, "Rejected remote MCP host");
    res.status(403).json({ error: "This host is not allowed." });
    return;
  }

  const headers = new Headers();
  for (const name of [
    "accept",
    "content-type",
    "mcp-protocol-version",
    "mcp-session-id",
    "last-event-id",
    "origin",
  ]) {
    const value = req.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const requestUrl = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);
    const request = new Request(requestUrl, {
      method: req.method,
      headers,
    });
    const response = await remoteMcpHandler.fetch(request, { parsedBody: req.body });

    res.status(response.status);
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.setHeader("Cache-Control", "no-store");
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    req.log.error(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "Remote MCP request failed",
    );
    res.status(500).json({ error: "The Agent Raised MCP request could not be completed." });
  }
});

export default router;

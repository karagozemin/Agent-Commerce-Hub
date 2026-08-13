import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createMarketplaceMcpServer } from "./mcp-server";

async function connectedClient() {
  const server = createMarketplaceMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

function resultJson(result: unknown) {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
  const text = content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("MCP result did not contain text");
  return JSON.parse(text) as Record<string, unknown>;
}

describe("marketplace MCP server", () => {
  it("exposes the marketplace tool contract", async () => {
    const { client, server } = await connectedClient();
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "search_services",
      "get_service",
      "get_service_price",
      "invoke_service",
      "get_invocation_status",
      "get_service_metrics",
      "get_agent_identity",
    ]);
    await client.close();
    await server.close();
  });

  it("searches published services and returns authoritative pricing", async () => {
    const { client, server } = await connectedClient();
    const search = resultJson(await client.callTool({ name: "search_services", arguments: { query: "wallet", verifiedOnly: true } }));
    expect(search.count).toBe(1);
    expect((search.data as Array<{ slug: string }>)[0].slug).toBe("wallet-lens");

    const price = resultJson(await client.callTool({ name: "get_service_price", arguments: { slug: "wallet-lens" } }));
    expect((price.pricing as { amount: string }).amount).toBe("0.08");
    await client.close();
    await server.close();
  });
});

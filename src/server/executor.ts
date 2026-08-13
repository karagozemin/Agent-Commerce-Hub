import type { ServiceManifest } from "@/domain/types";
import type { RuntimeService } from "./catalog";
import { callPublicJsonEndpoint } from "./service-endpoint-verifier";
import { assertMatchesSchema, compileJsonSchema } from "./schema-validation";

export async function executeService(service: ServiceManifest | RuntimeService, input: unknown) {
  const data = input as Record<string, string>;

  switch (service.slug) {
    case "wallet-lens":
      return {
        address: data.address,
        summary: "Active GOAT account with recurring contract interactions and no critical risk signal in this demo response.",
        activity: { transactions: 48, activeDays: 12, contractsUsed: 9 },
        riskSignals: ["No known malicious counterparties", "No unusual approval concentration"],
      };
    case "tx-explain":
      return {
        transactionHash: data.transactionHash,
        explanation: "The sender called a contract and completed an ERC-20 transfer to the destination account.",
        events: ["Approval", "Transfer"],
        status: "success",
      };
    case "contract-lens":
      return {
        contractAddress: data.contractAddress,
        riskLevel: "low",
        findings: ["Proxy pattern not detected", "No unrestricted mint selector detected", "Owner controls should be reviewed"],
      };
    case "repo-brief":
      return {
        repositoryUrl: data.repositoryUrl,
        architecture: "TypeScript application organized around domain, transport, and infrastructure boundaries.",
        hotspots: ["Authentication boundary", "Payment reconciliation", "External endpoint validation"],
      };
    default:
      if (!("endpoint" in service) || !service.endpoint.startsWith("https://")) {
        throw new Error("No executor is configured for this service");
      }
      const result = await callPublicJsonEndpoint(service.endpoint, input);
      assertMatchesSchema(compileJsonSchema(service.outputSchema, "Output"), result.body, "Service response");
      return result.body;
  }
}

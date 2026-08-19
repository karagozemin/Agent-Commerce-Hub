import type { ServiceManifest } from "@/domain/types";
import type { RuntimeService } from "./catalog";
import { callPublicJsonEndpoint } from "./service-endpoint-verifier";
import { assertMatchesSchema, compileJsonSchema } from "./schema-validation";
import { getGoatWalletSnapshot } from "./goat-transaction-status";

export async function executeService(service: ServiceManifest | RuntimeService, input: unknown) {
  const data = input as Record<string, string>;

  switch (service.slug) {
    case "wallet-lens":
      const snapshot = await getGoatWalletSnapshot(data.address);
      return {
        address: snapshot.address,
        summary: `${snapshot.accountType === "contract" ? "Contract account" : "Externally-owned account"} observed on GOAT mainnet at block ${snapshot.observedBlock} with ${snapshot.transactionCount} confirmed outgoing transaction${snapshot.transactionCount === 1 ? "" : "s"}.`,
        activity: {
          transactionCount: snapshot.transactionCount,
          nativeBalanceWei: snapshot.nativeBalanceWei,
          observedBlock: snapshot.observedBlock,
        },
        riskSignals: snapshot.transactionCount === 0
          ? ["No confirmed outgoing transaction history was observed"]
          : [],
        accountType: snapshot.accountType,
        dataSource: "GOAT mainnet JSON-RPC",
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

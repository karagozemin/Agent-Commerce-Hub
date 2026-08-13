import type { ServiceManifest } from "@/domain/types";
import { assertMatchesSchema, compileJsonSchema } from "./schema-validation";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const transactionPattern = /^0x[a-fA-F0-9]{64}$/;

export function validateServiceInput(service: ServiceManifest, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Service input must be an object");
  }

  const value = input as Record<string, unknown>;
  if (!['wallet-lens', 'tx-explain', 'contract-lens', 'repo-brief'].includes(service.slug)) {
    assertMatchesSchema(compileJsonSchema(service.inputSchema, "Input"), input, "Service input");
    return;
  }
  switch (service.slug) {
    case "wallet-lens":
      if (typeof value.address !== "string" || !addressPattern.test(value.address)) {
        throw new Error("A valid EVM wallet address is required");
      }
      break;
    case "tx-explain":
      if (typeof value.transactionHash !== "string" || !transactionPattern.test(value.transactionHash)) {
        throw new Error("A valid transaction hash is required");
      }
      break;
    case "contract-lens":
      if (typeof value.contractAddress !== "string" || !addressPattern.test(value.contractAddress)) {
        throw new Error("A valid contract address is required");
      }
      break;
    case "repo-brief":
      if (typeof value.repositoryUrl !== "string") throw new Error("A repository URL is required");
      try {
        const url = new URL(value.repositoryUrl);
        if (url.protocol !== "https:") throw new Error();
      } catch {
        throw new Error("A valid HTTPS repository URL is required");
      }
      break;
  }
}

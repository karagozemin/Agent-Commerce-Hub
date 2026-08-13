import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import type { SellerServiceDraft } from "./seller/repository";
import { validateSellerEndpoint } from "./endpoint-security";
import { assertMatchesSchema, compileJsonSchema } from "./schema-validation";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const TIMEOUT_MS = 15_000;

function isPrivateIp(address: string) {
  if (address.includes(":")) {
    const value = address.toLowerCase();
    return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
  }
  const parts = address.split(".").map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

async function resolvePublicAddress(hostname: string) {
  const records = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateIp(record.address))) {
    throw new Error("Endpoint resolves to a private or unavailable network");
  }
  return records[0];
}

function postJsonPinned(url: URL, address: string, family: number, payload: unknown) {
  const body = JSON.stringify(payload);
  return new Promise<{ body: unknown; latencyMs: number }>((resolve, reject) => {
    const startedAt = performance.now();
    const req = request({
      protocol: "https:",
      hostname: address,
      family,
      port: url.port ? Number(url.port) : 443,
      path: `${url.pathname}${url.search}`,
      method: "POST",
      servername: url.hostname,
      headers: {
        Host: url.host,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "Agent-Commerce-Hub-Verifier/1.0",
      },
      timeout: TIMEOUT_MS,
      rejectUnauthorized: true,
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        response.resume();
        reject(new Error("Endpoint redirects are not allowed"));
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Endpoint returned HTTP ${status}`));
        return;
      }
      const contentType = response.headers["content-type"] ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        response.resume();
        reject(new Error("Endpoint must return application/json"));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          response.destroy(new Error("Endpoint response exceeds 1 MB"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        try {
          resolve({ body: JSON.parse(Buffer.concat(chunks).toString("utf8")), latencyMs: Math.round(performance.now() - startedAt) });
        } catch {
          reject(new Error("Endpoint returned invalid JSON"));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Endpoint timed out after 15 seconds")));
    req.on("error", reject);
    req.end(body);
  });
}

export async function callPublicJsonEndpoint(endpoint: string, payload: unknown) {
  const normalized = validateSellerEndpoint(endpoint);
  const url = new URL(normalized);
  const target = await resolvePublicAddress(url.hostname);
  return postJsonPinned(url, target.address, target.family, payload);
}

export interface EndpointVerificationResult {
  verifiedAt: Date;
  latencyMs: number;
  sampleOutput: unknown;
}

export async function verifyServiceEndpoint(service: SellerServiceDraft): Promise<EndpointVerificationResult> {
  const normalized = validateSellerEndpoint(service.endpoint);
  const url = new URL(normalized);
  const inputValidator = compileJsonSchema(service.inputSchema, "Input");
  const outputValidator = compileJsonSchema(service.outputSchema, "Output");
  assertMatchesSchema(inputValidator, service.testInput, "Test input");
  const result = await callPublicJsonEndpoint(url.toString(), service.testInput);
  assertMatchesSchema(outputValidator, result.body, "Endpoint response");
  return { verifiedAt: new Date(), latencyMs: result.latencyMs, sampleOutput: result.body };
}

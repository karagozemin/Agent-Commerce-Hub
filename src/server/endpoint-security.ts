import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const blockedHosts = new Set(["localhost", "localhost.localdomain"]);

function isPrivateIp(hostname: string) {
  if (!isIP(hostname)) return false;
  if (hostname.includes(":")) {
    const normalized = hostname.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }
  const parts = hostname.split(".").map(Number);
  return parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0;
}

export function validateSellerEndpoint(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("A valid HTTPS endpoint is required"); }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:") throw new Error("Seller endpoints must use HTTPS");
  if (url.username || url.password) throw new Error("Endpoint URLs cannot include credentials");
  if (blockedHosts.has(hostname) || hostname.endsWith(".localhost") || isPrivateIp(hostname)) {
    throw new Error("Local and private network endpoints are not allowed");
  }
  return url.toString();
}

export async function assertPublicEndpoint(value: string) {
  const normalized = validateSellerEndpoint(value);
  const url = new URL(normalized);
  if (isIP(url.hostname)) return normalized;
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Endpoint hostname could not be resolved");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("Endpoint hostname resolves to a private network");
  }
  return normalized;
}

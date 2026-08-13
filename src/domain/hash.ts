import { keccak256, stringToHex } from "viem";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function hashPayload(value: unknown): `0x${string}` {
  return keccak256(stringToHex(JSON.stringify(stableValue(value))));
}

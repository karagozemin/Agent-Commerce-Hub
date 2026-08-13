import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/config/env";

function getKey() {
  if (!env.CREDENTIAL_ENCRYPTION_KEY) throw new Error("Credential encryption key is not configured");
  const key = Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) throw new Error("Credential encryption key must be 32 bytes encoded as base64");
  return key;
}

function decodeCanonical(value: string, label: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`Encrypted credential ${label} is invalid`);
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length === 0 || decoded.toString("base64url") !== value) throw new Error(`Encrypted credential ${label} is invalid`);
  return decoded;
}

export function encryptCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptCredential(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("Encrypted credential format is invalid");
  const iv = decodeCanonical(ivValue, "IV");
  const tag = decodeCanonical(tagValue, "tag");
  const encrypted = decodeCanonical(encryptedValue, "payload");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Encrypted credential parameters are invalid");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isAddress, isHex, verifyMessage } from "viem";
import type { AuthRepository } from "./repository";
import { authRepository } from "./repository";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const sessionCookie = {
  name: "ach_session",
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  },
};

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  constructor(private readonly repository: AuthRepository = authRepository) {}

  async createChallenge(input: { walletAddress: string; domain: string; uri: string; chainId: number }) {
    if (!isAddress(input.walletAddress)) throw new Error("A valid wallet address is required");
    if (!input.domain || !input.uri) throw new Error("Challenge origin is required");
    if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) throw new Error("A valid chain ID is required");
    const walletAddress = input.walletAddress.toLowerCase();
    const id = `chl_${randomUUID().replaceAll("-", "")}`;
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
    const message = [
      `${input.domain} wants you to sign in with your Ethereum account:`,
      walletAddress,
      "",
      "Sign in to manage Agent Commerce Hub seller services.",
      "",
      `URI: ${input.uri}`,
      "Version: 1",
      `Chain ID: ${input.chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${expiresAt.toISOString()}`,
    ].join("\n");
    await this.repository.createChallenge({ id, walletAddress, message, expiresAt });
    return { challengeId: id, message, expiresAt: expiresAt.toISOString() };
  }

  async verify(input: { challengeId: string; walletAddress: string; message: string; signature: string }) {
    if (!isAddress(input.walletAddress) || !isHex(input.signature)) throw new Error("Invalid signature payload");
    const walletAddress = input.walletAddress.toLowerCase();
    const challenge = await this.repository.findChallenge(input.challengeId);
    if (!challenge) throw new Error("Challenge is invalid, expired, or already used");
    if (challenge.walletAddress !== walletAddress || challenge.message !== input.message) {
      throw new Error("Challenge does not match the wallet or message");
    }
    const valid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message: input.message,
      signature: input.signature,
    });
    if (!valid) throw new Error("Wallet signature is invalid");
    const consumed = await this.repository.consumeChallenge(input.challengeId, walletAddress, input.message);
    if (!consumed) throw new Error("Challenge is invalid, expired, or already used");

    const user = await this.repository.upsertUser(walletAddress);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await this.repository.createSession({
      id: hashSessionToken(token),
      userId: user.id,
      walletAddress,
      expiresAt,
    });
    return { token, user, expiresAt };
  }

  async getSession(token: string | undefined) {
    if (!token) return undefined;
    return this.repository.findSession(hashSessionToken(token));
  }

  async revoke(token: string | undefined) {
    if (token) await this.repository.revokeSession(hashSessionToken(token));
  }
}

export const authService = new AuthService();

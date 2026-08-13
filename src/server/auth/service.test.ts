import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { MemoryAuthRepository } from "./repository";
import { AuthService, hashSessionToken } from "./service";

const owner = privateKeyToAccount(`0x${"1".repeat(64)}`);
const attacker = privateKeyToAccount(`0x${"2".repeat(64)}`);

describe("wallet authentication", () => {
  it("creates a session from a valid signature and rejects nonce replay", async () => {
    const auth = new AuthService(new MemoryAuthRepository());
    const challenge = await auth.createChallenge({
      walletAddress: owner.address,
      domain: "localhost:3000",
      uri: "http://localhost:3000",
      chainId: 48816,
    });
    const signature = await owner.signMessage({ message: challenge.message });
    const result = await auth.verify({
      challengeId: challenge.challengeId,
      walletAddress: owner.address,
      message: challenge.message,
      signature,
    });

    expect(result.user.walletAddress).toBe(owner.address.toLowerCase());
    expect(await auth.getSession(result.token)).toMatchObject({ walletAddress: owner.address.toLowerCase() });
    expect(hashSessionToken(result.token)).not.toBe(result.token);
    await expect(auth.verify({
      challengeId: challenge.challengeId,
      walletAddress: owner.address,
      message: challenge.message,
      signature,
    })).rejects.toThrow("already used");
  });

  it("does not consume a challenge when the signature is invalid", async () => {
    const auth = new AuthService(new MemoryAuthRepository());
    const challenge = await auth.createChallenge({
      walletAddress: owner.address,
      domain: "localhost:3000",
      uri: "http://localhost:3000",
      chainId: 48816,
    });
    const badSignature = await attacker.signMessage({ message: challenge.message });
    await expect(auth.verify({
      challengeId: challenge.challengeId,
      walletAddress: owner.address,
      message: challenge.message,
      signature: badSignature,
    })).rejects.toThrow("invalid");

    const validSignature = await owner.signMessage({ message: challenge.message });
    await expect(auth.verify({
      challengeId: challenge.challengeId,
      walletAddress: owner.address,
      message: challenge.message,
      signature: validSignature,
    })).resolves.toHaveProperty("token");
  });
});

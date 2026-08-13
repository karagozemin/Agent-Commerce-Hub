import { and, eq, gt, isNull } from "drizzle-orm";
import { env } from "@/config/env";
import { getDatabase } from "@/db/client";
import { authChallenges, sessions, users } from "@/db/schema";

export interface AuthChallenge {
  id: string;
  walletAddress: string;
  message: string;
  expiresAt: Date;
  consumedAt?: Date;
}

export interface AuthSession {
  id: string;
  userId: string;
  walletAddress: string;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface AuthRepository {
  createChallenge(challenge: AuthChallenge): Promise<void>;
  findChallenge(id: string): Promise<AuthChallenge | undefined>;
  consumeChallenge(id: string, walletAddress: string, message: string): Promise<AuthChallenge | undefined>;
  upsertUser(walletAddress: string): Promise<{ id: string; walletAddress: string }>;
  createSession(session: AuthSession): Promise<void>;
  findSession(id: string): Promise<AuthSession | undefined>;
  revokeSession(id: string): Promise<void>;
}

export class MemoryAuthRepository implements AuthRepository {
  private readonly challenges = new Map<string, AuthChallenge>();
  private readonly sessions = new Map<string, AuthSession>();
  private readonly users = new Map<string, { id: string; walletAddress: string }>();

  async createChallenge(challenge: AuthChallenge) { this.challenges.set(challenge.id, challenge); }

  async findChallenge(id: string) {
    const challenge = this.challenges.get(id);
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) return undefined;
    return challenge;
  }

  async consumeChallenge(id: string, walletAddress: string, message: string) {
    const challenge = this.challenges.get(id);
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) return undefined;
    if (challenge.walletAddress !== walletAddress.toLowerCase() || challenge.message !== message) return undefined;
    challenge.consumedAt = new Date();
    this.challenges.set(id, challenge);
    return challenge;
  }

  async upsertUser(walletAddress: string) {
    const wallet = walletAddress.toLowerCase();
    const existing = this.users.get(wallet);
    if (existing) return existing;
    const user = { id: `usr_${crypto.randomUUID().replaceAll("-", "")}`, walletAddress: wallet };
    this.users.set(wallet, user);
    return user;
  }

  async createSession(session: AuthSession) { this.sessions.set(session.id, session); }

  async findSession(id: string) {
    const session = this.sessions.get(id);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return undefined;
    return session;
  }

  async revokeSession(id: string) {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, revokedAt: new Date() });
  }
}

class PostgresAuthRepository implements AuthRepository {
  async createChallenge(challenge: AuthChallenge) {
    await getDatabase().insert(authChallenges).values(challenge);
  }

  async findChallenge(id: string) {
    const [row] = await getDatabase().select().from(authChallenges).where(and(
      eq(authChallenges.id, id), isNull(authChallenges.consumedAt), gt(authChallenges.expiresAt, new Date()),
    )).limit(1);
    return row ? { ...row, consumedAt: row.consumedAt ?? undefined } : undefined;
  }

  async consumeChallenge(id: string, walletAddress: string, message: string) {
    const [row] = await getDatabase().update(authChallenges).set({ consumedAt: new Date() }).where(and(
      eq(authChallenges.id, id),
      eq(authChallenges.walletAddress, walletAddress.toLowerCase()),
      eq(authChallenges.message, message),
      isNull(authChallenges.consumedAt),
      gt(authChallenges.expiresAt, new Date()),
    )).returning();
    return row ? { ...row, consumedAt: row.consumedAt ?? undefined } : undefined;
  }

  async upsertUser(walletAddress: string) {
    const wallet = walletAddress.toLowerCase();
    const [row] = await getDatabase().insert(users).values({
      id: `usr_${crypto.randomUUID().replaceAll("-", "")}`,
      walletAddress: wallet,
      lastSeenAt: new Date(),
    }).onConflictDoUpdate({ target: users.walletAddress, set: { lastSeenAt: new Date() } }).returning();
    return { id: row.id, walletAddress: row.walletAddress };
  }

  async createSession(session: AuthSession) { await getDatabase().insert(sessions).values(session); }

  async findSession(id: string) {
    const [row] = await getDatabase().select().from(sessions).where(and(
      eq(sessions.id, id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()),
    )).limit(1);
    return row ? { ...row, revokedAt: row.revokedAt ?? undefined } : undefined;
  }

  async revokeSession(id: string) {
    await getDatabase().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, id));
  }
}

const globalAuth = globalThis as typeof globalThis & { authRepository?: AuthRepository };
export const authRepository = globalAuth.authRepository ?? (
  env.DATA_STORE === "postgres" ? new PostgresAuthRepository() : new MemoryAuthRepository()
);
if (process.env.NODE_ENV !== "production") globalAuth.authRepository = authRepository;

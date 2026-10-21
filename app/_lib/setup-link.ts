import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { adminClient } from "./supabase";

/**
 * One-time "set your password" links for students a teacher adds by email.
 *
 * The account is created with a random password nobody knows. The link
 * carries the account id and a secret; only a hash of the secret is kept, in
 * the account's app_metadata (which users cannot change themselves), with an
 * expiry. Setting a password through the link clears it, so the link works
 * once. No email is sent and no database change is needed: the teacher
 * passes the link on, as with the class link.
 */

const DAYS = 14;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export type SetupState = { h: string; exp: number };

/** Makes a new link secret for an account, replacing any earlier one. Returns the token for the URL. */
export async function issueSetupToken(userId: string): Promise<string> {
  const secret = randomBytes(24).toString("hex");
  const setup: SetupState = { h: sha(secret), exp: Date.now() + DAYS * 86400000 };
  const { error } = await adminClient().auth.admin.updateUserById(userId, { app_metadata: { setup } });
  if (error) throw error;
  return `${userId}.${secret}`;
}

/** A password nobody knows, for an account whose owner has not set one yet. */
export const unusablePassword = () => randomBytes(32).toString("base64url");

/** Whether an account is still waiting for its owner to set a password. */
export const setupPending = (appMetadata: any) => !!appMetadata?.setup?.h;

/** Checks a link token. Returns the account, or a reason it cannot be used. */
export async function checkSetupToken(token: string) {
  const m = /^([0-9a-f-]{36})\.([0-9a-f]{48})$/.exec(token ?? "");
  if (!m) return { ok: false as const, reason: "invalid" as const };
  const [, userId, secret] = m;

  const { data, error } = await adminClient().auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user) return { ok: false as const, reason: "invalid" as const };

  const setup = (user.app_metadata as any)?.setup as SetupState | undefined;
  if (!setup?.h) return { ok: false as const, reason: "used" as const };

  const a = Buffer.from(sha(secret), "hex");
  const b = Buffer.from(String(setup.h), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false as const, reason: "invalid" as const };
  if (Date.now() > Number(setup.exp)) return { ok: false as const, reason: "expired" as const };

  return { ok: true as const, user };
}

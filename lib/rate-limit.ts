import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { prisma } from "@/lib/db";

// Per-IP rate limiting for the login action. State lives in Postgres rather than
// in memory because the app runs on serverless functions: any given request may
// hit a fresh instance, so an in-memory counter would reset unpredictably and a
// brute-force script could slip through on cold starts. A shared table is the
// only place the count is reliable across instances.
//
// Policy: at most MAX_ATTEMPTS failed attempts per rolling WINDOW per IP. The
// legitimate user has one password and one device, so a low ceiling costs them
// nothing while cutting a scripted attacker from thousands of guesses per minute
// down to a handful per window. Per-IP (not global) is deliberate: a global cap
// would let an attacker lock the owner out by hammering from anywhere.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number };

function hashIp(ip: string): string {
  // Keyed hash so the stored value is opaque without SESSION_SECRET. Same input
  // always maps to the same key, which is all the counter needs.
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(ip).digest("hex");
}

async function clientIpHash(): Promise<string> {
  const headerList = await headers();
  // On Vercel the real client IP is the first entry of x-forwarded-for. Fall
  // back to x-real-ip, then a shared bucket so a missing header still limits
  // (rather than silently disabling the protection).
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim() ||
    "unknown";
  return hashIp(ip);
}

// --- Core, keyed by a caller-supplied identifier so it can be tested without a
// request context. The exported wrappers below read the IP from the request. ---

export async function checkRateLimitForKey(
  ipHash: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = new Date(now - WINDOW_MS);
  const attempts = await prisma.loginAttempt.findMany({
    where: { ipHash, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (attempts.length < MAX_ATTEMPTS) return { allowed: true };

  // Blocked until the oldest in-window attempt ages out of the window.
  const oldest = attempts[0].createdAt.getTime();
  const retryAfterMs = WINDOW_MS - (now - oldest);
  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return { allowed: false, retryAfterMinutes };
}

export async function recordFailureForKey(ipHash: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { ipHash } });
  // Opportunistically drop this key's expired rows so the table stays small
  // without needing a scheduled job.
  await prisma.loginAttempt.deleteMany({
    where: { ipHash, createdAt: { lt: new Date(Date.now() - WINDOW_MS) } },
  });
}

export async function clearForKey(ipHash: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { ipHash } });
}

// --- Request-context wrappers used by the login action. ---

export async function checkLoginRateLimit(): Promise<RateLimitResult> {
  return checkRateLimitForKey(await clientIpHash());
}

export async function recordFailedLogin(): Promise<void> {
  await recordFailureForKey(await clientIpHash());
}

export async function clearLoginAttempts(): Promise<void> {
  await clearForKey(await clientIpHash());
}

"use server";

import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";
import { createSession, deleteSession } from "@/lib/auth";
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLogin,
} from "@/lib/rate-limit";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type LoginState = { error?: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.APP_PASSWORD ?? "";

  if (!expected) {
    return { error: "APP_PASSWORD is not configured on the server." };
  }

  // Reject before checking the password so a blocked IP cannot keep guessing.
  const limit = await checkLoginRateLimit();
  if (!limit.allowed) {
    const { retryAfterMinutes } = limit;
    return {
      error: `Too many attempts. Try again in ${retryAfterMinutes} minute${
        retryAfterMinutes === 1 ? "" : "s"
      }.`,
    };
  }

  if (!safeEqual(password, expected)) {
    await recordFailedLogin();
    return { error: "Incorrect password." };
  }

  // A correct password clears this IP's failures so earlier typos never count
  // against a legitimate future login.
  await clearLoginAttempts();
  await createSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}

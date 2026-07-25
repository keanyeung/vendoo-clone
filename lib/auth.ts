import "server-only";
import { cookies } from "next/headers";
import { encrypt, decrypt } from "@/lib/session";

const COOKIE_NAME = "session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(): Promise<void> {
  const expiresAt = Date.now() + MAX_AGE_MS;
  const token = await encrypt({ auth: true, expiresAt });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const payload = await decrypt(token);
  return payload?.auth === true;
}

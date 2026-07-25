import { SignJWT, jwtVerify } from "jose";

// Pure session-token helpers (no next/headers), so they can be used from both
// server code and the proxy (middleware) runtime.

const secret = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secret);

export type SessionPayload = { auth: true; expiresAt: number };

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(
  token?: string,
): Promise<{ auth?: boolean } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as { auth?: boolean };
  } catch {
    return null;
  }
}

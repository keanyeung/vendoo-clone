"use server";

import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";
import { createSession, deleteSession } from "@/lib/auth";

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
  if (!safeEqual(password, expected)) {
    return { error: "Incorrect password." };
  }

  await createSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}

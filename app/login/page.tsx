"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <form
        action={action}
        className="w-full max-w-sm space-y-4 rounded-xl border border-black/10 p-8 dark:border-white/15"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Vendoo Clone</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Enter your password to continue.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

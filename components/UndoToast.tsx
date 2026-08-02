"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export type UndoToastProps = {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
  isUndoing?: boolean;
  timeoutMs?: number;
  tone?: "default" | "error";
};

type ActiveToast = {
  id: symbol;
  dismiss: () => void;
};

let activeToast: ActiveToast | null = null;

export function UndoToast({
  message,
  onUndo,
  onDismiss,
  isUndoing = false,
  timeoutMs,
  tone = "default",
}: UndoToastProps) {
  const idRef = useRef(Symbol("undo-toast"));
  const onDismissRef = useRef(onDismiss);

  useLayoutEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const dismiss = useCallback((): void => {
    if (activeToast?.id === idRef.current) activeToast = null;
    onDismissRef.current();
  }, []);

  useLayoutEffect(() => {
    const nextToast = { id: idRef.current, dismiss };
    const previousToast = activeToast;
    activeToast = nextToast;

    if (previousToast !== null && previousToast.id !== nextToast.id) {
      previousToast.dismiss();
    }

    return (): void => {
      if (activeToast?.id === nextToast.id) activeToast = null;
    };
  }, [dismiss, message]);

  const resolvedTimeoutMs = timeoutMs ?? (onUndo === undefined ? 4000 : 7000);

  useEffect(() => {
    if (isUndoing) return;

    const timer = setTimeout(dismiss, resolvedTimeoutMs);
    return (): void => clearTimeout(timer);
  }, [dismiss, isUndoing, message, resolvedTimeoutMs]);

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      className={`fixed bottom-6 left-1/2 z-[60] flex min-h-11 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm shadow-xl ${
        tone === "error"
          ? "border-red-600/30 text-red-700 dark:border-red-400/30 dark:text-red-400"
          : "border-black/15 text-foreground dark:border-white/20"
      }`}
    >
      <p className="min-w-0 flex-1 px-1 font-medium">{message}</p>
      {onUndo !== undefined && (
        <button
          type="button"
          onClick={onUndo}
          disabled={isUndoing}
          className="min-h-11 shrink-0 rounded-md px-3 font-semibold text-blue-700 hover:bg-blue-600/[.08] disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-400"
        >
          {isUndoing ? "Undoing…" : "Undo"}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        disabled={isUndoing}
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-xl leading-none text-black/60 hover:bg-black/[.05] hover:text-black disabled:cursor-not-allowed disabled:opacity-60 dark:text-white/60 dark:hover:bg-white/[.07] dark:hover:text-white"
        aria-label="Dismiss notification"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

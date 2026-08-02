"use client";

type SaleToastProps = {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  isUndoing?: boolean;
};

export function SaleToast({
  message,
  onUndo,
  onDismiss,
  isUndoing = false,
}: SaleToastProps) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-2 rounded-xl border border-black/15 bg-background px-3 py-2 text-sm text-foreground shadow-xl dark:border-white/20"
    >
      <p className="min-w-0 flex-1 px-1 font-medium">{message}</p>
      <button
        type="button"
        onClick={onUndo}
        disabled={isUndoing}
        className="min-h-11 shrink-0 rounded-md px-3 font-semibold text-blue-700 hover:bg-blue-600/[.08] disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-400"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        disabled={isUndoing}
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-xl leading-none text-black/60 hover:bg-black/[.05] hover:text-black disabled:cursor-not-allowed disabled:opacity-60 dark:text-white/60 dark:hover:bg-white/[.07] dark:hover:text-white"
        aria-label="Dismiss sale notification"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

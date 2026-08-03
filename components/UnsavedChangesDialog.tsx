"use client";

import { useEffect, useRef } from "react";

type UnsavedChangesDialogProps = {
  open: boolean;
  canSave: boolean;
  isSaving: boolean;
  isDiscarding: boolean;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedChangesDialog({
  open,
  canSave,
  isSaving,
  isDiscarding,
  error,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isPending = isSaving || isDiscarding;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  function cancel(): void {
    if (!isPending) onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="unsaved-changes-title"
      aria-describedby="unsaved-changes-description"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || isPending) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;
        if (!inside) cancel();
      }}
      className="unsaved-changes-dialog m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-black/15 bg-background p-6 text-foreground shadow-xl dark:border-white/20"
    >
      <style>{`
        .unsaved-changes-dialog::backdrop {
          background: rgb(0 0 0 / 0.55);
        }
      `}</style>
      <h2 id="unsaved-changes-title" className="text-lg font-semibold">
        Save your changes?
      </h2>
      <p
        id="unsaved-changes-description"
        className="mt-3 text-sm leading-6 text-black/70 dark:text-white/70"
      >
        You have unsaved changes. Save them before leaving, or discard them and
        continue to your destination.
      </p>

      {error !== null && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-600/25 bg-red-600/[.05] px-3 py-2 text-sm text-red-700 dark:border-red-400/25 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="button"
          autoFocus
          onClick={cancel}
          disabled={isPending}
          className="min-h-11 rounded-md border border-black/15 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={isPending}
          className="min-h-11 rounded-md border border-red-600/30 px-4 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/35 dark:text-red-400"
        >
          {isDiscarding ? "Discarding…" : "Discard and leave"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isPending}
          className="min-h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-35"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </dialog>
  );
}

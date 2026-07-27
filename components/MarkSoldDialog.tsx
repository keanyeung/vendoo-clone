"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { ItemDto } from "@/lib/item-dto";
import { MarkSoldSchema } from "@/lib/item-schema";

export type MarkSoldDialogProps = {
  item: ItemDto | null;
  onClose: () => void;
  onSold: () => void;
};

type FieldErrors = Record<string, string>;
type FormState = {
  soldPrice: string;
  soldPlatform: string;
  soldDate: string;
  platformFees: string;
};

const control =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function localDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function deriveFormState(item: ItemDto): FormState {
  return {
    soldPrice: String(item.listPrice),
    soldPlatform: "",
    soldDate: localDate(),
    platformFees: "",
  };
}

function ErrorText({
  name,
  errors,
}: {
  name: string;
  errors: FieldErrors;
}) {
  return errors[name] ? (
    <p className="text-sm text-red-600 dark:text-red-400">{errors[name]}</p>
  ) : null;
}

export default function MarkSoldDialog({
  item,
  onClose,
  onSold,
}: MarkSoldDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<FormState>({
    soldPrice: "",
    soldPlatform: "",
    soldDate: localDate(),
    platformFees: "",
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (item && !dialog.open) dialog.showModal();
    else if (!item && dialog.open) dialog.close();
  }, [item]);

  useEffect(() => {
    // The selected row is external dialog state; each new item starts a fresh form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (item) setForm(deriveFormState(item));
  }, [item]);

  function updateField(
    field: keyof FormState,
  ): (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void {
    return (event): void => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  function handleClose(): void {
    if (isSaving) return;
    setFieldErrors({});
    setSubmitError(null);
    onClose();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!item || isSaving) return;

    const payload = {
      soldPrice:
        form.soldPrice === "" ? Number.NaN : Number(form.soldPrice),
      soldPlatform: form.soldPlatform,
      soldDate: form.soldDate,
      platformFees:
        form.platformFees === "" ? null : Number(form.platformFees),
    };
    const parsed = MarkSoldSchema.safeParse(payload);

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const segment = issue.path[0];
        const name = typeof segment === "string" ? segment : "form";
        if (!next[name]) next[name] = issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_sold",
          data: parsed.data,
        }),
      });

      if (!response.ok) {
        let message = `Saving failed with status ${response.status}.`;
        try {
          const body: unknown = await response.json();
          if (
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
          ) {
            message = body.error;
          }
        } catch {
          // Keep the status-based fallback when the response is not JSON.
        }
        setSubmitError(message);
        return;
      }

      onSold();
    } catch {
      setSubmitError(
        "Could not reach the save service. Check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const soldPrice =
    form.soldPrice === "" ? Number.NaN : Number(form.soldPrice);
  const enteredFees =
    form.platformFees === "" ? 0 : Number(form.platformFees);
  const platformFees = Number.isFinite(enteredFees) ? enteredFees : 0;
  const profit =
    item && Number.isFinite(soldPrice)
      ? soldPrice - item.purchasePrice - platformFees
      : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => {
        if (isSaving) {
          event.preventDefault();
          return;
        }
        handleClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;
        if (!inside) handleClose();
      }}
      className="mark-sold-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-black/15 bg-background p-6 text-foreground shadow-xl dark:border-white/20"
    >
      <style>{`
        .mark-sold-dialog::backdrop {
          background: rgb(0 0 0 / 0.55);
        }
      `}</style>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Mark as sold</h2>
          {item && (
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              {item.title}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isSaving}
          className="text-sm font-medium text-black/60 disabled:opacity-60 dark:text-white/60"
          aria-label="Close mark sold dialog"
        >
          Close
        </button>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-6 space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="dialog-sell-price" className="text-sm font-medium">
              Sold price
            </label>
            <input
              id="dialog-sell-price"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              onWheel={(event) => event.currentTarget.blur()}
              value={form.soldPrice}
              onChange={updateField("soldPrice")}
              className={control}
            />
            <ErrorText name="soldPrice" errors={fieldErrors} />
          </div>
          <div className="space-y-1">
            <label htmlFor="dialog-sell-platform" className="text-sm font-medium">
              Platform
            </label>
            <select
              id="dialog-sell-platform"
              value={form.soldPlatform}
              onChange={updateField("soldPlatform")}
              className={control}
            >
              <option value="" disabled>Select platform…</option>
              <option value="FB_MARKETPLACE">Facebook Marketplace</option>
              <option value="DEPOP">Depop</option>
              <option value="EBAY">eBay</option>
            </select>
            <ErrorText name="soldPlatform" errors={fieldErrors} />
          </div>
          <div className="space-y-1">
            <label htmlFor="dialog-sell-date" className="text-sm font-medium">
              Sold date
            </label>
            <input
              id="dialog-sell-date"
              type="date"
              value={form.soldDate}
              onChange={updateField("soldDate")}
              className={control}
            />
            <ErrorText name="soldDate" errors={fieldErrors} />
          </div>
          <div className="space-y-1">
            <label htmlFor="dialog-sell-fees" className="text-sm font-medium">
              Platform fees
            </label>
            <input
              id="dialog-sell-fees"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              onWheel={(event) => event.currentTarget.blur()}
              value={form.platformFees}
              onChange={updateField("platformFees")}
              className={control}
            />
            <p className="text-xs text-black/60 dark:text-white/60">
              eBay takes roughly 13%. Leave blank if there were no fees.
            </p>
            <ErrorText name="platformFees" errors={fieldErrors} />
          </div>
        </div>

        <div className="rounded-xl border border-black/15 bg-black/[.03] p-4 dark:border-white/20 dark:bg-white/[.04]">
          <p className="text-sm font-medium text-black/60 dark:text-white/60">
            Profit preview
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              profit === null
                ? ""
                : profit >= 0
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
            }`}
          >
            {profit === null ? "—" : currencyFormatter.format(profit)}
          </p>
          {item && profit !== null && (
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              {currencyFormatter.format(soldPrice)} sold −{" "}
              {currencyFormatter.format(item.purchasePrice)} paid −{" "}
              {currencyFormatter.format(platformFees)} fees
            </p>
          )}
        </div>

        {submitError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
          >
            <p>{submitError}</p>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="shrink-0 font-medium"
              aria-label="Dismiss save error"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

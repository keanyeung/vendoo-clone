"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import type { ItemDto } from "@/lib/item-dto";
import { MarkSoldSchema } from "@/lib/item-schema";

export type ItemSellSectionProps = {
  item: ItemDto;
};

type FieldErrors = Record<string, string>;
type FormState = {
  soldPrice: string;
  soldPlatform: string;
  soldDate: string;
  platformFees: string;
};

const control =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function localDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  // Use the local calendar date so evening sales do not shift to tomorrow in UTC.
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

export default function ItemSellSection({
  item,
}: ItemSellSectionProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [form, setForm] = useState<FormState>(() => deriveFormState(item));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (item.status === "SOLD") return null;

  function updateField(
    field: keyof FormState,
  ): (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void {
    return (event): void => {
      const value = event.target.value;
      setForm((current: FormState): FormState => ({
        ...current,
        [field]: value,
      }));
    };
  }

  function resetForm(): void {
    setForm(deriveFormState(item));
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleOpen(): void {
    resetForm();
    setIsExpanded(true);
  }

  function handleCancel(): void {
    resetForm();
    setIsExpanded(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (isSaving) return;

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

      // The refreshed SOLD item makes this component render nothing.
      router.refresh();
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
  const profit = Number.isFinite(soldPrice)
    ? soldPrice - item.purchasePrice - platformFees
    : null;

  return (
    <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sale</h2>
          {!isExpanded && (
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Record the sale price, platform, date, and fees.
            </p>
          )}
        </div>
        {!isExpanded && (
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Mark as sold
          </button>
        )}
      </div>

      {isExpanded && (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-6 space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="sell-price" className="text-sm font-medium">
                Sold price
              </label>
              <input
                id="sell-price"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                // Blur on wheel so scrolling the page over a focused number
                // input cannot silently change the amount (45 -> 44.99).
                onWheel={(event) => event.currentTarget.blur()}
                value={form.soldPrice}
                onChange={updateField("soldPrice")}
                className={control}
              />
              <ErrorText name="soldPrice" errors={fieldErrors} />
            </div>

            <div className="space-y-1">
              <label htmlFor="sell-platform" className="text-sm font-medium">
                Platform
              </label>
              <select
                id="sell-platform"
                value={form.soldPlatform}
                onChange={updateField("soldPlatform")}
                className={control}
              >
                <option value="" disabled>
                  Select platform…
                </option>
                <option value="FB_MARKETPLACE">Facebook Marketplace</option>
                <option value="DEPOP">Depop</option>
                <option value="EBAY">eBay</option>
              </select>
              <ErrorText name="soldPlatform" errors={fieldErrors} />
            </div>

            <div className="space-y-1">
              <label htmlFor="sell-date" className="text-sm font-medium">
                Sold date
              </label>
              <input
                id="sell-date"
                type="date"
                value={form.soldDate}
                onChange={updateField("soldDate")}
                className={control}
              />
              <ErrorText name="soldDate" errors={fieldErrors} />
            </div>

            <div className="space-y-1">
              <label htmlFor="sell-fees" className="text-sm font-medium">
                Platform fees
              </label>
              <input
                id="sell-fees"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                // Blur on wheel so scrolling the page over a focused number
                // input cannot silently change the amount (45 -> 44.99).
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

          <div className="rounded-xl border border-black/15 bg-black/[.03] p-5 dark:border-white/20 dark:bg-white/[.04]">
            <p className="text-sm font-medium text-black/60 dark:text-white/60">
              Profit preview
            </p>
            <p
              className={`mt-1 text-3xl font-semibold ${
                profit === null
                  ? ""
                  : profit >= 0
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
              }`}
            >
              {profit === null ? "—" : currencyFormatter.format(profit)}
            </p>
            {profit !== null && (
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

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

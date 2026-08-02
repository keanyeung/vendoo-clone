"use client";

import type { Platform } from "@prisma/client";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { computeProfit, computeRoi } from "@/lib/analytics";
import { chargesFees, estimateFees, FEE_HINTS } from "@/lib/fees";
import type { ItemDto } from "@/lib/item-dto";
import {
  type MarkSoldInput,
  MarkSoldSchema,
} from "@/lib/item-schema";
import { PLATFORM_LABELS } from "@/lib/platform-label";
import {
  PROFIT_TONE_CLASSES,
  profitTone,
} from "@/lib/profit-tone";

type MarkSoldItem = Pick<
  ItemDto,
  | "id"
  | "title"
  | "listPrice"
  | "purchasePrice"
  | "soldPrice"
  | "soldPlatform"
  | "soldDate"
  | "platformFees"
>;

export type MarkSoldDialogProps = {
  item: MarkSoldItem | null;
  onClose: () => void;
  onSold: (sale: MarkSoldInput) => void;
  mode?: "create" | "edit";
};

type FieldErrors = Record<string, string>;
type FormState = {
  soldPrice: string;
  soldPlatform: Platform | "";
  soldDate: string;
  platformFees: string;
};

const platforms = [
  { value: "FB_MARKETPLACE", label: "Facebook" },
  { value: "DEPOP", label: "Depop" },
  { value: "EBAY", label: "eBay" },
] as const satisfies ReadonlyArray<{ value: Platform; label: string }>;

const control =
  "w-full min-h-11 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function localDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function yesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return localDate(yesterday);
}

function moneyFieldValue(value: number): string {
  return value.toFixed(2);
}

function sanitizeMoney(value: string): string {
  const stripped = value.replace(/[^\d.]/g, "");
  const decimalIndex = stripped.indexOf(".");

  if (decimalIndex === -1) return stripped;

  return (
    stripped.slice(0, decimalIndex + 1) +
    stripped.slice(decimalIndex + 1).replaceAll(".", "")
  );
}

function parseMoney(value: string): number | null {
  const sanitized = sanitizeMoney(value);
  if (sanitized === "" || sanitized === ".") return null;

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMoney(value: string): string {
  const parsed = parseMoney(value);
  return parsed === null ? "" : moneyFieldValue(parsed);
}

function deriveFormState(
  item: MarkSoldItem,
  mode: "create" | "edit",
): FormState {
  if (mode === "edit") {
    return {
      soldPrice:
        item.soldPrice === null ? "" : moneyFieldValue(item.soldPrice),
      soldPlatform: item.soldPlatform ?? "",
      soldDate: item.soldDate?.slice(0, 10) ?? localDate(),
      platformFees:
        item.platformFees === null
          ? ""
          : moneyFieldValue(item.platformFees),
    };
  }

  return {
    soldPrice: moneyFieldValue(item.listPrice),
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
  mode = "create",
}: MarkSoldDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formSessionRef = useRef<string | null>(null);
  const feesTouchedRef = useRef<boolean>(false);
  const [form, setForm] = useState<FormState>({
    soldPrice: "",
    soldPlatform: "",
    soldDate: localDate(),
    platformFees: "",
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isOpen = item !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    // The selected row is external dialog state; every opening starts with
    // values derived from that item and mode.
    if (!item) {
      formSessionRef.current = null;
      return;
    }

    const sessionKey = `${item.id}:${mode}`;
    if (formSessionRef.current === sessionKey) return;

    formSessionRef.current = sessionKey;
    feesTouchedRef.current = mode === "edit";
    setForm(deriveFormState(item, mode));
  }, [item, mode]);

  function clearFieldError(field: keyof FormState): void {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handlePriceChange(event: ChangeEvent<HTMLInputElement>): void {
    const value = event.target.value;
    clearFieldError("soldPrice");
    setForm((current) => {
      const soldPrice = parseMoney(value);
      const platformFees =
        !feesTouchedRef.current && current.soldPlatform !== ""
          ? moneyFieldValue(
              estimateFees(current.soldPlatform, soldPrice ?? 0),
            )
          : current.platformFees;

      return { ...current, soldPrice: value, platformFees };
    });
  }

  function handlePriceBlur(): void {
    setForm((current) => {
      const soldPrice = parseMoney(current.soldPrice);
      const platformFees =
        !feesTouchedRef.current && current.soldPlatform !== ""
          ? moneyFieldValue(
              estimateFees(current.soldPlatform, soldPrice ?? 0),
            )
          : current.platformFees;

      return {
        ...current,
        soldPrice: normalizeMoney(current.soldPrice),
        platformFees,
      };
    });
  }

  function handlePlatformChange(platform: Platform): void {
    clearFieldError("soldPlatform");
    setForm((current) => ({
      ...current,
      soldPlatform: platform,
      platformFees: feesTouchedRef.current
        ? current.platformFees
        : moneyFieldValue(
            estimateFees(platform, parseMoney(current.soldPrice) ?? 0),
          ),
    }));
  }

  function handleFeesChange(event: ChangeEvent<HTMLInputElement>): void {
    feesTouchedRef.current = true;
    clearFieldError("platformFees");
    setForm((current) => ({
      ...current,
      platformFees: event.target.value,
    }));
  }

  function handleDateChange(event: ChangeEvent<HTMLInputElement>): void {
    clearFieldError("soldDate");
    setForm((current) => ({ ...current, soldDate: event.target.value }));
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
      soldPrice: parseMoney(form.soldPrice) ?? Number.NaN,
      soldPlatform: form.soldPlatform,
      soldDate: form.soldDate,
      platformFees: parseMoney(form.platformFees),
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
          action: mode === "edit" ? "edit_sale" : "mark_sold",
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

      onSold(parsed.data);
    } catch {
      setSubmitError(
        "Could not reach the save service. Check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const soldPrice = parseMoney(form.soldPrice);
  const platformFees = parseMoney(form.platformFees) ?? 0;
  const preview = item
    ? {
        soldPrice,
        purchasePrice: item.purchasePrice,
        platformFees,
      }
    : null;
  const profit = preview === null ? null : computeProfit(preview);
  const roi = preview === null ? null : computeRoi(preview);
  const profitClass =
    profit === null ? "" : PROFIT_TONE_CLASSES[profitTone(profit)];

  let warning: { message: string; className: string } | null = null;
  if (soldPrice === null || soldPrice === 0) {
    warning = {
      message: "Enter what it actually sold for.",
      className: "text-black/60 dark:text-white/60",
    };
  } else if (profit !== null && profit < 0) {
    warning = {
      message: `You'd take a loss of ${currencyFormatter.format(Math.abs(profit))} on this sale.`,
      className: "text-red-700 dark:text-red-400",
    };
  } else if (profit === 0 && item !== null) {
    warning = {
      message: `Break-even — you get your ${currencyFormatter.format(item.purchasePrice)} back and nothing more.`,
      className: "text-amber-700 dark:text-amber-400",
    };
  } else if (
    form.soldPlatform !== "" &&
    chargesFees(form.soldPlatform) &&
    platformFees === 0
  ) {
    warning = {
      message: `${PLATFORM_LABELS[form.soldPlatform]} normally takes a cut — leaving fees at $0 will overstate your profit.`,
      className: "text-amber-700 dark:text-amber-400",
    };
  }

  const today = localDate();
  const yesterday = yesterdayDate();

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
      className="mark-sold-dialog mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl rounded-b-none border border-black/15 bg-background p-6 text-foreground shadow-xl dark:border-white/20 sm:m-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:rounded-xl"
    >
      <style>{`
        .mark-sold-dialog::backdrop {
          background: rgb(0 0 0 / 0.55);
        }

        @media (max-width: 639.98px) and (prefers-reduced-motion: no-preference) {
          .mark-sold-dialog[open] {
            animation: mark-sold-dialog-slide-up 220ms ease-out;
          }

          @keyframes mark-sold-dialog-slide-up {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        }
      `}</style>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            {mode === "edit" ? "Edit sale details" : "Record a sale"}
          </h2>
          {item && (
            <p className="mt-1 truncate text-sm text-black/60 dark:text-white/60">
              {item.title}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isSaving}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-2xl leading-none text-black/60 hover:bg-black/[.05] hover:text-black disabled:cursor-not-allowed disabled:opacity-60 dark:text-white/60 dark:hover:bg-white/[.07] dark:hover:text-white"
          aria-label="Close sale dialog"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-6 space-y-5"
      >
        <div className="space-y-1.5">
          <label htmlFor="dialog-sell-price" className="text-sm font-medium">
            Sold price
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[19px] font-semibold"
            >
              $
            </span>
            <input
              id="dialog-sell-price"
              type="text"
              inputMode="decimal"
              value={form.soldPrice}
              onChange={handlePriceChange}
              onBlur={handlePriceBlur}
              disabled={isSaving}
              className={`${control} pl-8 text-[19px] font-semibold`}
            />
          </div>
          <ErrorText name="soldPrice" errors={fieldErrors} />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Platform</legend>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-black/15 dark:border-white/20">
            {platforms.map((platform) => {
              const selected = form.soldPlatform === platform.value;
              return (
                <button
                  key={platform.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => handlePlatformChange(platform.value)}
                  disabled={isSaving}
                  className={`min-h-11 border-r border-black/15 px-2 text-sm font-medium last:border-r-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 ${
                    selected
                      ? "bg-foreground text-background"
                      : "hover:bg-black/[.05] dark:hover:bg-white/[.07]"
                  }`}
                >
                  {platform.label}
                </button>
              );
            })}
          </div>
          <ErrorText name="soldPlatform" errors={fieldErrors} />
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="dialog-sell-fees" className="text-sm font-medium">
              Platform fees
            </label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base"
              >
                $
              </span>
              <input
                id="dialog-sell-fees"
                type="text"
                inputMode="decimal"
                value={form.platformFees}
                onChange={handleFeesChange}
                onBlur={() =>
                  setForm((current) => ({
                    ...current,
                    platformFees: normalizeMoney(current.platformFees),
                  }))
                }
                disabled={isSaving}
                className={`${control} pl-7`}
              />
            </div>
            {form.soldPlatform !== "" && (
              <p className="text-xs text-black/60 dark:text-white/60">
                {FEE_HINTS[form.soldPlatform]}
              </p>
            )}
            <ErrorText name="platformFees" errors={fieldErrors} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dialog-sell-date" className="text-sm font-medium">
              Sold date
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={form.soldDate === today}
                onClick={() => {
                  clearFieldError("soldDate");
                  setForm((current) => ({ ...current, soldDate: today }));
                }}
                disabled={isSaving}
                className={`min-h-11 rounded-md border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                  form.soldDate === today
                    ? "border-foreground bg-foreground text-background"
                    : "border-black/15 hover:bg-black/[.05] dark:border-white/20 dark:hover:bg-white/[.07]"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                aria-pressed={form.soldDate === yesterday}
                onClick={() => {
                  clearFieldError("soldDate");
                  setForm((current) => ({ ...current, soldDate: yesterday }));
                }}
                disabled={isSaving}
                className={`min-h-11 rounded-md border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                  form.soldDate === yesterday
                    ? "border-foreground bg-foreground text-background"
                    : "border-black/15 hover:bg-black/[.05] dark:border-white/20 dark:hover:bg-white/[.07]"
                }`}
              >
                Yesterday
              </button>
            </div>
            <input
              id="dialog-sell-date"
              type="date"
              max={today}
              value={form.soldDate}
              onChange={handleDateChange}
              disabled={isSaving}
              className={control}
            />
            <ErrorText name="soldDate" errors={fieldErrors} />
          </div>
        </div>

        <div className="sticky bottom-0 z-[1] bg-background py-2 sm:static sm:z-auto sm:bg-transparent sm:py-0">
          <div className="rounded-xl border border-black/15 bg-black/[.03] p-5 dark:border-white/20 dark:bg-white/[.04]">
            <p className="text-sm font-medium text-black/60 dark:text-white/60">
              Profit preview
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className={`text-[28px] font-semibold ${profitClass}`}>
                {profit === null ? "—" : currencyFormatter.format(profit)}
              </p>
              <p className="text-sm font-medium text-black/60 dark:text-white/60">
                ROI {roi === null ? "—" : `${roi.toFixed(1)}%`}
              </p>
            </div>
            {item && (
              <p className="mt-2 font-mono text-sm text-black/60 dark:text-white/60">
                {currencyFormatter.format(soldPrice ?? 0)} −{" "}
                {currencyFormatter.format(item.purchasePrice)} paid −{" "}
                {currencyFormatter.format(platformFees)} fees
              </p>
            )}
            {warning && (
              <p className={`mt-3 text-sm ${warning.className}`}>
                {warning.message}
              </p>
            )}
          </div>
        </div>

        {submitError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
          >
            <p className="py-2">{submitError}</p>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="min-h-11 shrink-0 font-medium"
              aria-label="Dismiss save error"
            >
              Dismiss
            </button>
          </div>
        )}

        <p className="text-sm text-black/60 dark:text-white/60">
          {mode === "edit"
            ? "Updates this item's profit everywhere it appears."
            : "Moves this out of Active listings and into Analytics."}
        </p>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="min-h-11 rounded-md border border-black/15 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Saving…"
              : mode === "edit"
                ? "Save changes"
                : "Mark as sold"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

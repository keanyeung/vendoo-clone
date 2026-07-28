"use client";

import { type FormEvent, useState } from "react";
import { CONDITION_VALUES, type Analysis } from "@/lib/analysis-schema";
import { CreateItemSchema } from "@/lib/item-schema";

export type ItemFormProps = {
  analysis: Analysis;
  photoUrls: string[];
  onSaved: (id: string, title: string) => void;
};

type FieldErrors = Record<string, string>;
type ItemStatus = "DRAFT" | "LISTED";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const control =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

function nullable(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function ErrorText({ name, errors }: { name: string; errors: FieldErrors }) {
  return errors[name] ? (
    <p className="text-sm text-red-600 dark:text-red-400">{errors[name]}</p>
  ) : null;
}

export default function ItemForm({
  analysis,
  photoUrls,
  onSaved,
}: ItemFormProps) {
  const [title, setTitle] = useState<string>(analysis.title);
  const [summary, setSummary] = useState<string>(analysis.summary);
  const [description, setDescription] = useState<string>(analysis.description);
  const [brand, setBrand] = useState<string>(analysis.brand ?? "");
  const [category, setCategory] = useState<string>(analysis.category);
  const [size, setSize] = useState<string>(analysis.size ?? "");
  const [color, setColor] = useState<string>(analysis.color ?? "");
  const [condition, setCondition] =
    useState<Analysis["condition"]>(analysis.condition);
  const [conditionNotes, setConditionNotes] = useState<string>(
    analysis.condition_notes,
  );
  const [suggestedPrice] = useState<string>(String(analysis.suggested_price));
  const [priceLow] = useState<string>(String(analysis.price_low));
  const [priceHigh] = useState<string>(String(analysis.price_high));
  const [priceReasoning] = useState<string>(analysis.price_reasoning);
  const [listPrice, setListPrice] = useState<string>(
    String(analysis.suggested_price),
  );
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [keywords, setKeywords] = useState<string>(
    analysis.keywords.join(", "),
  );
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSaving) return;
    const submitter =
      event.nativeEvent instanceof SubmitEvent
        ? event.nativeEvent.submitter
        : null;
    const status: ItemStatus =
      submitter instanceof HTMLButtonElement && submitter.value === "DRAFT"
        ? "DRAFT"
        : "LISTED";
    const payload = {
      photos: photoUrls,
      title,
      summary: nullable(summary),
      description,
      brand: nullable(brand),
      category,
      size: nullable(size),
      color: nullable(color),
      condition,
      conditionNotes: nullable(conditionNotes),
      suggestedPrice: suggestedPrice === "" ? null : Number(suggestedPrice),
      priceLow: priceLow === "" ? null : Number(priceLow),
      priceHigh: priceHigh === "" ? null : Number(priceHigh),
      priceReasoning: nullable(priceReasoning),
      listPrice: Number(listPrice),
      purchasePrice:
        purchasePrice === "" ? Number.NaN : Number(purchasePrice),
      keywords: keywords
        .split(",")
        .map((value: string): string => value.trim())
        .filter((value: string): boolean => value !== ""),
      aiConfidence: analysis.confidence,
      purchaseDate: nullable(purchaseDate),
      notes: nullable(notes),
      status,
    };
    const parsed = CreateItemSchema.safeParse(payload);
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
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : `Saving failed with status ${response.status}.`;
        setSubmitError(message);
        return;
      }
      if (
        typeof body !== "object" ||
        body === null ||
        !("id" in body) ||
        typeof body.id !== "string"
      ) {
        setSubmitError("The save response was incomplete. Please try again.");
        return;
      }
      onSaved(body.id, parsed.data.title);
    } catch {
      setSubmitError(
        "Could not reach the save service. Check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const shortFields: Array<{
    id: string;
    label: string;
    value: string;
    setValue: (value: string) => void;
  }> = [
    { id: "brand", label: "Brand", value: brand, setValue: setBrand },
    { id: "category", label: "Category", value: category, setValue: setCategory },
    { id: "size", label: "Size", value: size, setValue: setSize },
    { id: "color", label: "Color", value: color, setValue: setColor },
  ];

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6 rounded-xl border border-black/15 p-5 dark:border-white/20">
      <div>
        <h2 className="text-xl font-semibold">Review item details</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Edit the AI draft and add your purchase details before saving.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">Title</label>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} className={control} />
          <ErrorText name="title" errors={fieldErrors} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="summary" className="text-sm font-medium">Summary</label>
          <textarea id="summary" rows={2} value={summary} onChange={(event) => setSummary(event.target.value)} className={control} />
          <ErrorText name="summary" errors={fieldErrors} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <textarea id="description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className={control} />
          <ErrorText name="description" errors={fieldErrors} />
        </div>
        {shortFields.map((field) => (
          <div key={field.id} className="space-y-1">
            <label htmlFor={field.id} className="text-sm font-medium">{field.label}</label>
            <input id={field.id} value={field.value} onChange={(event) => field.setValue(event.target.value)} className={control} />
            <ErrorText name={field.id} errors={fieldErrors} />
          </div>
        ))}
        <div className="space-y-1">
          <label htmlFor="condition" className="text-sm font-medium">Condition</label>
          <select id="condition" value={condition} onChange={(event) => setCondition(event.target.value as Analysis["condition"])} className={control}>
            {CONDITION_VALUES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
          <ErrorText name="condition" errors={fieldErrors} />
        </div>
        <div className="space-y-1">
          <label htmlFor="listPrice" className="text-sm font-medium">List price</label>
          <input id="listPrice" type="number" step="0.01" min="0" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()} value={listPrice} onChange={(event) => setListPrice(event.target.value)} className={control} />
          <ErrorText name="listPrice" errors={fieldErrors} />
        </div>
        <div className="space-y-1">
          <label htmlFor="purchasePrice" className="text-sm font-medium">Purchase price</label>
          <input id="purchasePrice" type="number" step="0.01" min="0" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()} value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} className={control} />
          <ErrorText name="purchasePrice" errors={fieldErrors} />
        </div>
        <div className="space-y-1">
          <label htmlFor="purchaseDate" className="text-sm font-medium">Purchase date</label>
          <input id="purchaseDate" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className={control} />
          <ErrorText name="purchaseDate" errors={fieldErrors} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="conditionNotes" className="text-sm font-medium">Condition notes</label>
          <textarea id="conditionNotes" rows={3} value={conditionNotes} onChange={(event) => setConditionNotes(event.target.value)} className={control} />
          <ErrorText name="conditionNotes" errors={fieldErrors} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="keywords" className="text-sm font-medium">Keywords</label>
          <input id="keywords" value={keywords} onChange={(event) => setKeywords(event.target.value)} className={control} />
          <p className="text-xs text-black/60 dark:text-white/60">Separate keywords with commas.</p>
          <ErrorText name="keywords" errors={fieldErrors} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium">Notes</label>
          <textarea id="notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={control} />
          <ErrorText name="notes" errors={fieldErrors} />
        </div>
      </div>
      <aside className="space-y-3 rounded-xl border border-black/15 bg-black/[.03] p-4 dark:border-white/20 dark:bg-white/[.04]">
        <div>
          <h3 className="font-semibold">AI pricing reference</h3>
          <p className="text-sm text-black/60 dark:text-white/60">Reference only; your editable list price is above.</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div><dt className="text-xs text-black/60 dark:text-white/60">Suggested</dt><dd className="font-medium">{money.format(Number(suggestedPrice))}</dd></div>
          <div><dt className="text-xs text-black/60 dark:text-white/60">Range</dt><dd className="font-medium">{money.format(Number(priceLow))}–{money.format(Number(priceHigh))}</dd></div>
          <div><dt className="text-xs text-black/60 dark:text-white/60">Confidence</dt><dd className="font-medium capitalize">{analysis.confidence}</dd></div>
        </dl>
        <p className="text-sm leading-6">{priceReasoning}</p>
      </aside>
      {submitError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400">
          <p>{submitError}</p>
          <button type="button" onClick={() => setSubmitError(null)} className="shrink-0 font-medium" aria-label="Dismiss save error">Dismiss</button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="status" value="LISTED" disabled={isSaving} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Saving…" : "Save item"}</button>
        <button type="submit" name="status" value="DRAFT" disabled={isSaving} className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20">Save as draft</button>
      </div>
    </form>
  );
}

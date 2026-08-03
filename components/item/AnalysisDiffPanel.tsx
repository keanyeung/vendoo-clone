"use client";

import type {
  AnalysisEditableField,
  AnalysisFieldChange,
} from "@/lib/analysis-diff";

export default function AnalysisDiffPanel({
  changes,
  selectedFields,
  usageLine,
  onToggle,
  onApply,
  onDismiss,
}: {
  changes: AnalysisFieldChange[];
  selectedFields: readonly AnalysisEditableField[];
  usageLine: string;
  onToggle: (field: AnalysisEditableField) => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const selected = new Set(selectedFields);

  return (
    <section
      aria-labelledby="analysis-diff-heading"
      className="rounded-xl border border-black/15 p-5 dark:border-white/20 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="analysis-diff-heading" className="font-semibold">
            Review AI suggestions
          </h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Nothing is selected automatically. Choose only the changes you want.
          </p>
        </div>
        <p className="text-xs text-black/60 dark:text-white/60">
          {usageLine}
        </p>
      </div>

      {changes.length === 0 ? (
        <p className="mt-4 rounded-lg bg-black/[.03] px-4 py-3 text-sm text-black/60 dark:bg-white/[.05] dark:text-white/60">
          The analysis did not propose changes to editable listing fields.
        </p>
      ) : (
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Select AI suggestions to apply</legend>
          {changes.map((change) => (
            <label
              key={change.field}
              className="grid cursor-pointer gap-3 rounded-lg border border-black/10 p-3 hover:bg-black/[.02] dark:border-white/15 dark:hover:bg-white/[.03] sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <input
                type="checkbox"
                checked={selected.has(change.field)}
                onChange={() => onToggle(change.field)}
                className="mt-1 size-5 accent-foreground"
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-black/50 dark:text-white/50">
                  Current {change.label.toLowerCase()}
                </span>
                <span className="mt-1 block whitespace-pre-wrap break-words text-sm">
                  {change.current}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-black/50 dark:text-white/50">
                  Proposed {change.label.toLowerCase()}
                </span>
                <span className="mt-1 block whitespace-pre-wrap break-words text-sm font-medium">
                  {change.proposed}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 rounded-md border border-black/15 px-4 text-sm font-medium dark:border-white/20"
        >
          Dismiss
        </button>
        <button
          type="button"
          disabled={selectedFields.length === 0}
          onClick={onApply}
          className="min-h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply selected
        </button>
      </div>
    </section>
  );
}

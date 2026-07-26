"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import ItemForm from "@/components/ItemForm";
import PhotoUploader from "@/components/PhotoUploader";
import type { Analysis } from "@/lib/analysis-schema";

type AnalysisUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
};

type AnalyzeResponse = {
  analysis: Analysis;
  usage: AnalysisUsage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function NewListingPage() {
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [usage, setUsage] = useState<AnalysisUsage | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisKey, setAnalysisKey] = useState<number>(0);
  const [uploaderKey, setUploaderKey] = useState<number>(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string>("");
  const uploadedUrlsKeyRef = useRef<string>(JSON.stringify([]));

  function handleUploadedUrlsChange(urls: string[]): void {
    const nextKey = JSON.stringify(urls);
    if (uploadedUrlsKeyRef.current === nextKey) return;
    uploadedUrlsKeyRef.current = nextKey;
    setUploadedUrls(urls);
    setAnalysis(null);
    setUsage(null);
    setErrorMessage(null);
    setIsAnalyzing(false);
  }

  async function handleAnalyze(): Promise<void> {
    if (uploadedUrls.length === 0 || isAnalyzing) return;
    const requestedUrlsKey = uploadedUrlsKeyRef.current;
    setErrorMessage(null);
    setAnalysis(null);
    setUsage(null);
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls: uploadedUrls }),
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
          setErrorMessage(
            `Analysis failed with status ${response.status}. Please try again.`,
          );
        }
        return;
      }
      if (!response.ok) {
        const message =
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : `Analysis failed with status ${response.status}. Please try again.`;
        if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
          setErrorMessage(message);
        }
        return;
      }
      if (
        !isRecord(body) ||
        !("analysis" in body) ||
        !isRecord(body.usage) ||
        typeof body.usage.inputTokens !== "number" ||
        typeof body.usage.outputTokens !== "number" ||
        typeof body.usage.model !== "string"
      ) {
        if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
          setErrorMessage("The analysis response was incomplete. Please try again.");
        }
        return;
      }
      if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
        const result = body as AnalyzeResponse;
        setAnalysis(result.analysis);
        setUsage(result.usage);
        setAnalysisKey((current: number): number => current + 1);
      }
    } catch {
      if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
        setErrorMessage(
          "Could not reach the analysis service. Check your connection and try again.",
        );
      }
    } finally {
      if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
        setIsAnalyzing(false);
      }
    }
  }

  function handleSaved(id: string, title: string): void {
    setSavedId(id);
    setSavedTitle(title);
  }

  function handleCreateAnother(): void {
    setSavedId(null);
    setSavedTitle("");
    setAnalysis(null);
    setUsage(null);
    setErrorMessage(null);
    setUploadedUrls([]);
    setIsAnalyzing(false);
    uploadedUrlsKeyRef.current = JSON.stringify([]);
    setUploaderKey((current: number): number => current + 1);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="space-y-2">
        <Link href="/" className="inline-block text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white">
          ← Back to home
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New Listing</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Step one: add photos of the item you want to list.
        </p>
      </div>

      {savedId ? (
        <section className="mt-8 space-y-4 rounded-xl border border-black/15 p-6 dark:border-white/20">
          <div>
            <h2 className="text-xl font-semibold">Item saved</h2>
            <p className="mt-1 text-black/60 dark:text-white/60">{savedTitle}</p>
          </div>
          <button type="button" onClick={handleCreateAnother} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
            Create another
          </button>
        </section>
      ) : (
        <>
          <section className="mt-8">
            <PhotoUploader key={uploaderKey} onChange={handleUploadedUrlsChange} />
          </section>

          {uploadedUrls.length > 0 && (
            <section className="mt-8 space-y-4">
              <button type="button" disabled={isAnalyzing} onClick={() => void handleAnalyze()} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60">
                {analysis ? "Re-analyze photos" : "Analyze photos"}
              </button>
              {isAnalyzing && (
                <div aria-live="polite" className="rounded-xl border border-black/15 bg-black/[.03] p-4 dark:border-white/20 dark:bg-white/[.04]">
                  <p className="font-medium">
                    Analyzing {uploadedUrls.length} {uploadedUrls.length === 1 ? "photo" : "photos"}…
                  </p>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                    This usually takes 15–30 seconds. You can keep this page open while the listing draft is prepared.
                  </p>
                </div>
              )}
              {errorMessage && (
                <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400">
                  <p>{errorMessage}</p>
                  <div className="flex shrink-0 gap-3 font-medium">
                    <button type="button" disabled={isAnalyzing} onClick={() => void handleAnalyze()} className="disabled:opacity-60">Try again</button>
                    <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss analysis error">Dismiss</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {analysis && (
            <section className="mt-8 space-y-4">
              <ItemForm key={analysisKey} analysis={analysis} photoUrls={uploadedUrls} onSaved={handleSaved} />
              {usage && (
                <p className="text-xs text-black/60 dark:text-white/60">
                  {usage.inputTokens.toLocaleString()} input tokens · {usage.outputTokens.toLocaleString()} output tokens · {usage.model}
                </p>
              )}
              <details className="rounded-md border border-black/15 dark:border-white/20">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Raw JSON</summary>
                <pre className="overflow-x-auto border-t border-black/10 p-3 text-xs dark:border-white/15">
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              </details>
            </section>
          )}

          {uploadedUrls.length > 0 && (
            <section className="mt-8 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Uploaded photos</h2>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {uploadedUrls.length} {uploadedUrls.length === 1 ? "photo" : "photos"} uploaded
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {uploadedUrls.map((url: string, index: number) => (
                  <div key={url} className="overflow-hidden rounded-xl border border-black/15 dark:border-white/20">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Uploaded listing photo ${index + 1}`} className="aspect-square w-full object-cover" />
                    </a>
                    <p title={url} className="select-text truncate border-t border-black/10 p-3 text-xs text-black/60 dark:border-white/15 dark:text-white/60">
                      {url}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

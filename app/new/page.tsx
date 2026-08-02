import { Suspense } from "react";

import NewListingClient, {
  type InitialServerDraft,
} from "@/components/item/NewListingClient";
import { ResumeDraftBanner } from "@/components/item/ResumeDraftBanner";
import { prisma } from "@/lib/db";
import {
  restorePersistedDraft,
  type DraftStep,
} from "@/lib/item-draft";

export const dynamic = "force-dynamic";

function firstSearchParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function relativeSavedTime(updatedAt: Date, now: number): string {
  const elapsedSeconds = Math.max(
    0,
    Math.round((now - updatedAt.getTime()) / 1000),
  );
  if (elapsedSeconds < 60) return "just now";

  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

async function LatestDraftBanner({ currentId }: { currentId: string | null }) {
  const latestDraft = await prisma.item.findFirst({
    where: {
      status: "DRAFT",
      ...(currentId === null ? {} : { id: { not: currentId } }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      photos: true,
      updatedAt: true,
    },
  });
  if (latestDraft === null) return null;

  // Capture one request-time value so the streamed banner has a stable label.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <ResumeDraftBanner
      id={latestDraft.id}
      title={latestDraft.title}
      photoCount={latestDraft.photos.length}
      savedLabel={relativeSavedTime(latestDraft.updatedAt, now)}
    />
  );
}

export default async function NewListingPage(props: {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const searchParams = await props.searchParams;
  const requestedDraftId = firstSearchParam(searchParams.draft).trim();
  const item =
    requestedDraftId === ""
      ? null
      : await prisma.item.findFirst({
          where: { id: requestedDraftId, status: "DRAFT" },
        });

  let initialDraft: InitialServerDraft | null = null;
  if (item !== null) {
    const restored = restorePersistedDraft({
      photos: item.photos,
      title: item.title,
      summary: item.summary,
      description: item.description,
      brand: item.brand,
      category: item.category,
      size: item.size,
      color: item.color,
      condition: item.condition,
      conditionNotes: item.conditionNotes,
      suggestedPrice:
        item.suggestedPrice === null ? null : Number(item.suggestedPrice),
      priceLow: item.priceLow === null ? null : Number(item.priceLow),
      priceHigh: item.priceHigh === null ? null : Number(item.priceHigh),
      priceReasoning: item.priceReasoning,
      listPrice: Number(item.listPrice),
      purchasePrice: Number(item.purchasePrice),
      keywords: item.keywords,
      aiConfidence: item.aiConfidence,
      purchaseDate: item.purchaseDate?.toISOString() ?? null,
      notes: item.notes,
      draftStep: item.draftStep,
    });
    initialDraft = {
      id: item.id,
      photos: item.photos,
      analysis: restored.analysis,
      draft: restored.draft,
      draftStep: ["photos", "analyzed", "reviewed"].includes(
        item.draftStep ?? "",
      )
        ? (item.draftStep as DraftStep)
        : null,
    };
  }

  const fallbackMessage =
    requestedDraftId !== "" && item === null
      ? "That draft is missing or is no longer a draft. Starting a fresh listing instead."
      : null;

  return (
    <NewListingClient
      initialDraft={initialDraft}
      fallbackMessage={fallbackMessage}
      resumeBanner={
        <Suspense fallback={null}>
          <LatestDraftBanner currentId={initialDraft?.id ?? null} />
        </Suspense>
      }
    />
  );
}

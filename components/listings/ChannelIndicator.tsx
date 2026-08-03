import type { ListingPostingDto } from "@/lib/item-dto";
import {
  livePlatforms,
  postingAccessibleLabel,
  POSTING_PLATFORMS,
  type PostingPlatform,
} from "@/lib/postings";

const CHANNEL_INITIALS: Record<PostingPlatform, string> = {
  FB_MARKETPLACE: "F",
  DEPOP: "D",
  EBAY: "E",
};

export default function ChannelIndicator({
  postings,
}: {
  postings: readonly ListingPostingDto[];
}) {
  const live = new Set(livePlatforms(postings));

  return (
    <span
      role="img"
      aria-label={postingAccessibleLabel(postings)}
      className="inline-flex gap-1"
    >
      {POSTING_PLATFORMS.map((platform) => {
        const isLive = live.has(platform);

        return (
          <span
            key={platform}
            aria-hidden="true"
            className={`inline-flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${
              isLive
                ? "bg-foreground text-background"
                : "bg-black/[.06] text-black/35 dark:bg-white/10 dark:text-white/35"
            }`}
          >
            {CHANNEL_INITIALS[platform]}
          </span>
        );
      })}
    </span>
  );
}

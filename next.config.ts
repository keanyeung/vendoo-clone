import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? "item-photos";
const storagePattern =
  supabaseUrl === undefined
    ? null
    : new URL(
        `/storage/v1/object/public/${encodeURIComponent(storageBucket)}/**`,
        supabaseUrl,
      );

const nextConfig: NextConfig = {
  images: {
    remotePatterns: storagePattern === null ? [] : [storagePattern],
    imageSizes: [32, 40, 48, 56, 64, 96, 128, 256, 384],
    qualities: [75],
  },
};

export default nextConfig;

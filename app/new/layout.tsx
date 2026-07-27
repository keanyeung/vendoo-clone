import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Listing",
};

export default function NewListingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

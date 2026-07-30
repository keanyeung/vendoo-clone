"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/listings", label: "Listings" },
  { href: "/analytics", label: "Analytics" },
] as const;

function isActive(pathname: string, href: string): boolean {
  // "/" would prefix-match every route, so only the exact path counts as Home.
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppHeader() {
  const pathname = usePathname();

  // app/login/layout.tsx is nested inside the root layout, so it cannot remove
  // anything the root renders. Opting out here is what keeps /login chrome-free.
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-background/90 backdrop-blur-sm dark:border-white/15">
      <div className="mx-auto flex h-15 max-w-[1120px] items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-7">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            Vendoo Clone
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-md px-2.5 text-sm ${
                    active
                      ? "bg-black/[.06] font-medium dark:bg-white/[.09]"
                      : "text-black/60 dark:text-white/60"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-sm font-semibold text-background"
          >
            <span aria-hidden="true">+</span>New listing
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-black/15 px-3 text-sm text-black/70 hover:bg-black/[.04] dark:border-white/20 dark:text-white/70 dark:hover:bg-white/[.06]"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

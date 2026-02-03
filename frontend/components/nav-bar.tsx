"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";
import { ModeToggle } from "./theme-toggle";

type NavLink = { label: string; href: string };

export function NavBar({
  logo = "Mock",
  logoHref = "/",
  links = [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Docs", href: "/docs" },
    { label: "About", href: "/about" },
  ],
}: {
  logo?: string;
  logoHref?: string;
  links?: NavLink[];
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <div
        className={cn(
          "pointer-events-none flex w-full justify-center",
          "transition-all duration-300 ease-out",
          scrolled ? "py-0" : "py-3",
        )}
      >
        <div
          className={cn(
            "pointer-events-auto",
            "transition-all duration-300 ease-out",
            scrolled
              ? "w-full rounded-none border-b"
              : "w-[min(1100px,calc(100%-2rem))] rounded-full border",
            "bg-card/80 supports-[backdrop-filter]:bg-card/60 supports-[backdrop-filter]:backdrop-blur",
            "border-border shadow-lg",
          )}
        >
          <div
            className={cn(
              "mx-auto flex items-center justify-between gap-4",
              "px-4 sm:px-6",
              "transition-[padding] duration-300 ease-out",
              scrolled ? "h-14" : "h-12",
              scrolled ? "max-w-[1100px]" : "max-w-none",
            )}
          >
            <Link
              href={logoHref}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-foreground hover:text-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="hidden sm:inline  ">
                {logo}
                <span className="bg-amber-400 rounded-lg p-1 text-black mx-1">
                  Hub
                </span>
              </span>
            </Link>

            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label="Primary"
            >
              {links.slice(0, 4).map((l) => {
                const active =
                  l.href === "/"
                    ? pathname === "/"
                    : pathname === l.href || pathname.startsWith(l.href + "/");
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "rounded-full px-3 py-2 text-sm transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <ModeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PiggyBank, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/classes", label: "เก็บเงิน", icon: PiggyBank },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
];

/** Bottom tab bar on phones, inline links in the header on larger screens. */
export function AppNav({ variant }: { variant: "bottom" | "top" }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="เมนูหลัก"
      className={cn(
        variant === "bottom"
          ? "fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden print:hidden"
          : "hidden items-center gap-1 sm:flex",
      )}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-center font-medium transition-colors",
              variant === "bottom"
                ? "h-16 flex-col gap-1 text-xs"
                : "h-9 gap-2 rounded-lg px-3 text-sm hover:bg-accent",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              variant === "top" && active && "bg-accent",
            )}
          >
            <Icon className={variant === "bottom" ? "size-6" : "size-4"} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

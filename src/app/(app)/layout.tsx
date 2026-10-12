import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { requireUser } from "@/server/dal";
import { AppNav } from "./app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <Link href="/classes" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <PiggyBank className="size-5" aria-hidden />
            </span>
            กระปุกห้องเรียน
          </Link>
          <div className="flex items-center gap-3">
            <AppNav variant="top" />
            <span
              className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
              title={user.email}
              aria-label={`เข้าสู่ระบบในชื่อ ${user.name}`}
            >
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 sm:pb-12 print:max-w-none print:p-0">{children}</main>
      <AppNav variant="bottom" />
    </div>
  );
}

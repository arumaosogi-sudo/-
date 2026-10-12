"use client";

import { usePathname, useRouter } from "next/navigation";
import { formatMonthKey } from "@/lib/format";

export function MonthFilter({ months, value }: { months: string[]; value?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">แสดง</span>
      <select
        value={value ?? ""}
        onChange={(e) => router.replace(e.target.value ? `${pathname}?month=${e.target.value}` : pathname)}
        className="h-10 rounded-lg border bg-background px-3 text-base"
      >
        <option value="">ทุกเดือน</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonthKey(m)}
          </option>
        ))}
      </select>
    </label>
  );
}

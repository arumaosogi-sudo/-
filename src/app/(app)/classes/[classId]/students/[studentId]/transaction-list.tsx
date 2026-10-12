"use client";

import { useState, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, MoreVertical, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bangkokDateKey, formatBaht, formatDateTime, formatDay, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { reverseTransactionAction } from "../../../money-actions";

export type Entry = {
  id: string;
  type: "deposit" | "withdraw";
  amountSatang: number;
  note: string | null;
  reversesId: string | null;
  reversedById: string | null;
  createdAt: Date;
};

const signed = (e: Entry) => (e.type === "deposit" ? e.amountSatang : -e.amountSatang);

export function TransactionList({ entries, readOnly }: { entries: Entry[]; readOnly: boolean }) {
  const [reversing, setReversing] = useState<Entry | null>(null);

  // Entries arrive newest first; group them by calendar day in Bangkok.
  const days: { key: string; date: Date; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const key = bangkokDateKey(entry.createdAt);
    const last = days.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, date: entry.createdAt, entries: [entry] });
  }

  return (
    <>
      <div className="grid gap-4">
        {days.map((day) => {
          const net = day.entries.reduce((sum, e) => sum + signed(e), 0);
          return (
            <section key={day.key} aria-label={formatDay(day.date)}>
              <div className="mb-1.5 flex items-center justify-between px-1 text-sm text-muted-foreground">
                <h3 className="font-medium">{formatDay(day.date)}</h3>
                <span className="tabular-nums">
                  รวม {net >= 0 ? "+" : "−"}
                  {formatBaht(Math.abs(net))} ฿
                </span>
              </div>
              <ul className="divide-y rounded-xl border bg-card">
                {day.entries.map((e) => (
                  <EntryRow key={e.id} entry={e} canReverse={!readOnly && !e.reversesId && !e.reversedById} onReverse={setReversing} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {entries.length >= 500 && (
        <p className="text-center text-sm text-muted-foreground">แสดง 500 รายการล่าสุด เลือกเดือนเพื่อดูรายการที่เก่ากว่า</p>
      )}
      <ReverseDialog entry={reversing} onClose={() => setReversing(null)} />
    </>
  );
}

function EntryRow({ entry: e, canReverse, onReverse }: { entry: Entry; canReverse: boolean; onReverse: (e: Entry) => void }) {
  const isReversal = e.reversesId !== null;
  const isReversed = e.reversedById !== null;
  const deposit = e.type === "deposit";
  const Icon = isReversal ? Undo2 : deposit ? ArrowDownLeft : ArrowUpRight;

  return (
    <li className={cn("flex items-center gap-3 py-3 pl-4", canReverse ? "pr-1" : "pr-4")}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          isReversal || isReversed
            ? "bg-muted text-muted-foreground"
            : deposit
              ? "bg-deposit-soft text-deposit"
              : "bg-withdraw-soft text-withdraw",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 font-medium">
          {isReversal ? "ยกเลิกรายการ" : deposit ? "ฝากเงิน" : "ถอนเงิน"}
          {isReversed && (
            <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground">ยกเลิกแล้ว</span>
          )}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          <time dateTime={e.createdAt.toISOString()} title={formatDateTime(e.createdAt)}>
            {formatTime(e.createdAt)} น.
          </time>
          {e.note && ` · ${e.note}`}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 font-semibold tabular-nums",
          isReversal || isReversed ? "text-muted-foreground" : deposit ? "text-deposit" : "text-withdraw",
          isReversed && "line-through",
        )}
      >
        {deposit ? "+" : "−"}
        {formatBaht(e.amountSatang)}
      </p>
      {canReverse && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-touch" aria-label="ตัวเลือกรายการ">
              <MoreVertical aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="py-2.5 text-base" variant="destructive" onSelect={() => onReverse(e)}>
              <Undo2 aria-hidden />
              ยกเลิกรายการนี้
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function ReverseDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!entry) return;
    startTransition(async () => {
      const result = await reverseTransactionAction(entry.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      onClose();
    });
  }

  const label = entry?.type === "deposit" ? "การฝาก" : "การถอน";

  return (
    <AlertDialog open={entry !== null} onOpenChange={(o) => !o && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ยกเลิก{label} {entry && formatBaht(entry.amountSatang)} บาท?
          </AlertDialogTitle>
          <AlertDialogDescription>
            ระบบจะบันทึกรายการกลับเพื่อปรับยอดให้ถูกต้อง รายการเดิมยังแสดงในประวัติพร้อมป้าย “ยกเลิกแล้ว”
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>ไม่ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(ev) => {
              ev.preventDefault();
              confirm();
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            ยกเลิกรายการ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

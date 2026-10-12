"use client";

import { useState, useTransition } from "react";
import { Loader2, MoreVertical, Printer, RefreshCw, UserRound, X } from "lucide-react";
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
import type { ActionResult } from "@/lib/validation";
import { regenerateCodeAction, removeGuardianAction } from "../../parent-actions";

type Row = {
  id: string;
  number: number;
  fullName: string;
  nickname: string | null;
  code: string;
  guardians: { id: string; name: string | null; linkedAt: Date }[];
};

type Pending = { title: string; description: string; confirm: string; run: () => Promise<ActionResult> };

export function PrintButton() {
  return (
    <Button size="touch" onClick={() => window.print()}>
      <Printer aria-hidden />
      พิมพ์ใบเชิญ
    </Button>
  );
}

export function ParentRows({ students }: { students: Row[] }) {
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [busy, startTransition] = useTransition();

  function run() {
    if (!confirming) return;
    startTransition(async () => {
      const result = await confirming.run();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      setConfirming(null);
    });
  }

  return (
    <>
      <ul className="divide-y rounded-xl border bg-card print:hidden">
        {students.map((s) => (
          <li key={s.id} className="flex items-start gap-3 py-3 pr-2 pl-4">
            <span className="w-7 shrink-0 pt-0.5 text-right text-sm tabular-nums text-muted-foreground">{s.number}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {s.fullName}
                {s.nickname && <span className="font-normal text-muted-foreground"> ({s.nickname})</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                รหัส <span className="font-mono text-base font-semibold tracking-widest text-foreground">{s.code}</span>
              </p>
              {s.guardians.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.guardians.map((g) => (
                    <li
                      key={g.id}
                      className="inline-flex items-center gap-1 rounded-full bg-deposit-soft py-0.5 pr-0.5 pl-2 text-xs font-medium text-deposit"
                    >
                      <UserRound className="size-3" aria-hidden />
                      {g.name ?? "ผู้ปกครอง"}
                      <button
                        type="button"
                        aria-label={`ยกเลิกการเชื่อมต่อ ${g.name ?? "ผู้ปกครอง"}`}
                        className="rounded-full p-1 hover:bg-deposit/20"
                        onClick={() =>
                          setConfirming({
                            title: `ยกเลิกการเชื่อมต่อ ${g.name ?? "ผู้ปกครอง"}?`,
                            description: `ผู้ปกครองคนนี้จะไม่ได้รับแจ้งยอดเงินออมของ ${s.fullName} อีก`,
                            confirm: "ยกเลิกการเชื่อมต่อ",
                            run: () => removeGuardianAction(g.id),
                          })
                        }
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">ยังไม่มีผู้ปกครองเชื่อมต่อ</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-touch" aria-label={`ตัวเลือกสำหรับ ${s.fullName}`}>
                  <MoreVertical aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="py-2.5 text-base"
                  onSelect={() =>
                    setConfirming({
                      title: `สร้างรหัสใหม่ให้ ${s.fullName}?`,
                      description: "ใช้เมื่อรหัสเดิมหลุดไปถึงคนอื่น รหัสเดิมจะใช้ไม่ได้อีก ผู้ปกครองที่เชื่อมไว้แล้วยังได้รับแจ้งเตือนตามปกติ",
                      confirm: "สร้างรหัสใหม่",
                      run: () => regenerateCodeAction(s.id),
                    })
                  }
                >
                  <RefreshCw aria-hidden />
                  สร้างรหัสใหม่
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && !busy && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirming?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ไม่ใช่ตอนนี้</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                run();
              }}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {confirming?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

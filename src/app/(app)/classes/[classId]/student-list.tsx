"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, Loader2, MoreVertical, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { formatBaht } from "@/lib/format";
import { removeStudentAction, updateStudentAction } from "../actions";
import { MoneyDialog } from "../money-dialog";
import { sendStudentBalanceAction } from "../parent-actions";

export type StudentRow = {
  id: string;
  number: number;
  fullName: string;
  nickname: string | null;
  balanceSatang: number;
  depositedTodaySatang: number;
  guardianCount: number;
};

type ListProps = { students: StudentRow[]; classroomId: string; readOnly: boolean };

export function StudentList({ students, classroomId, readOnly }: ListProps) {
  const [paying, setPaying] = useState<StudentRow | null>(null);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [removing, setRemoving] = useState<StudentRow | null>(null);
  const router = useRouter();
  const historyHref = (studentId: string) => `/classes/${classroomId}/students/${studentId}`;

  async function sendBalance(s: StudentRow) {
    const id = toast.loading(`กำลังส่งยอดของ ${s.fullName}...`);
    try {
      const r = await sendStudentBalanceAction(s.id);
      if (r.ok) toast.success(r.message, { id });
      else toast.error(r.error, { id });
    } catch {
      toast.error("ส่งไม่สำเร็จ ลองใหม่อีกครั้ง", { id });
    }
  }

  return (
    <>
      <ul className="divide-y rounded-xl border bg-card">
        {students.map((s) => (
          <li key={s.id} className="flex items-center gap-1 pr-2">
            <button
              type="button"
              onClick={() => (readOnly ? router.push(historyHref(s.id)) : setPaying(s))}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-3 pl-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={readOnly ? `ดูประวัติของ ${s.fullName}` : `ฝากหรือถอนเงินให้ ${s.fullName}`}
            >
              <span className="w-7 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{s.number}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.fullName}</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {s.nickname && <span className="truncate">{s.nickname}</span>}
                  {s.guardianCount > 0 && (
                    <span className="shrink-0 rounded-full bg-[#06C755]/15 px-2 text-xs font-medium text-[#05a847] dark:text-[#3ddc84]" title="ผู้ปกครองเชื่อมต่อ LINE แล้ว">
                      LINE
                    </span>
                  )}
                  {s.depositedTodaySatang > 0 && (
                    <span className="shrink-0 rounded-full bg-deposit-soft px-2 text-xs font-medium text-deposit">
                      วันนี้ +{formatBaht(s.depositedTodaySatang)}
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatBaht(s.balanceSatang)} <span className="text-sm font-normal text-muted-foreground">฿</span>
              </span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-touch" aria-label={`ตัวเลือกสำหรับ ${s.fullName}`}>
                  <MoreVertical aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="py-2.5 text-base" onSelect={() => router.push(historyHref(s.id))}>
                  <History aria-hidden />
                  ดูประวัติ
                </DropdownMenuItem>
                {s.guardianCount > 0 && (
                  <DropdownMenuItem className="py-2.5 text-base" onSelect={() => sendBalance(s)}>
                    <Send aria-hidden />
                    ส่งยอดให้ผู้ปกครองทาง LINE
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="py-2.5 text-base" onSelect={() => setEditing(s)}>
                  <Pencil aria-hidden />
                  แก้ไขข้อมูล
                </DropdownMenuItem>
                <DropdownMenuItem className="py-2.5 text-base" variant="destructive" onSelect={() => setRemoving(s)}>
                  <Trash2 aria-hidden />
                  นำออกจากห้อง
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลนักเรียน</DialogTitle>
          </DialogHeader>
          {editing && <EditStudentForm student={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <RemoveStudentDialog student={removing} onClose={() => setRemoving(null)} />

      <MoneyDialog
        student={paying}
        onClose={() => setPaying(null)}
        historyHref={paying ? historyHref(paying.id) : undefined}
      />
    </>
  );
}

function EditStudentForm({ student, onDone }: { student: StudentRow; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(updateStudentAction.bind(null, student.id), null);
  useActionFeedback(state, onDone);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid grid-cols-[5.5rem_1fr] gap-3">
        <FormField label="เลขที่" name="number" inputMode="numeric" defaultValue={values?.number ?? student.number} errors={fieldErrors?.number} required />
        <FormField label="ชื่อ-นามสกุล" name="fullName" defaultValue={values?.fullName ?? student.fullName} errors={fieldErrors?.fullName} required />
      </div>
      <FormField label="ชื่อเล่น (ไม่บังคับ)" name="nickname" defaultValue={values?.nickname ?? student.nickname ?? ""} errors={fieldErrors?.nickname} />
      <DialogFooter>
        <Button type="submit" size="touch" disabled={pending} className="w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          บันทึก
        </Button>
      </DialogFooter>
    </form>
  );
}

function RemoveStudentDialog({ student, onClose }: { student: StudentRow | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!student) return;
    startTransition(async () => {
      const result = await removeStudentAction(student.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      onClose();
    });
  }

  return (
    <AlertDialog open={student !== null} onOpenChange={(o) => !o && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>นำ {student?.fullName} ออกจากห้อง?</AlertDialogTitle>
          <AlertDialogDescription>
            {student && student.balanceSatang !== 0
              ? `นักเรียนคนนี้ยังมีเงินออม ${formatBaht(student.balanceSatang)} บาท ควรถอนคืนให้นักเรียนก่อน เมื่อนำออกแล้วยอดนี้จะไม่นับรวมในห้องอีก (ประวัติการฝากยังถูกเก็บไว้)`
              : "ถ้านักเรียนเคยมีประวัติการฝากเงิน ประวัติจะยังถูกเก็บไว้"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            นำออกจากห้อง
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

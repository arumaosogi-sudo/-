"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, History, Loader2 } from "lucide-react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBaht } from "@/lib/format";
import { parseBahtToSatang, QUICK_AMOUNTS } from "@/lib/money";
import { cn } from "@/lib/utils";
import { recordTransactionAction } from "./money-actions";
import { showRecordToast } from "./record-toast";

export type MoneyDialogStudent = {
  id: string;
  fullName: string;
  nickname: string | null;
  balanceSatang: number;
};

type Props = {
  student: MoneyDialogStudent | null;
  onClose: () => void;
  /** Link to the student's history page; hidden when already there. */
  historyHref?: string;
};

type Kind = "deposit" | "withdraw";
/** What the teacher typed, kept so "แก้ไข" on the confirm step returns to it. */
type Draft = { amount: string; note: string };
type Pending = { type: Kind; amountSatang: number; note: string };

export function MoneyDialog({ student, onClose, historyHref }: Props) {
  return (
    <Dialog open={student !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {student && <MoneyPanel student={student} onDone={onClose} historyHref={historyHref} />}
      </DialogContent>
    </Dialog>
  );
}

/** Two steps: choose an amount, then confirm it before anything is saved. */
function MoneyPanel({ student, onDone, historyHref }: { student: MoneyDialogStudent; onDone: () => void; historyHref?: string }) {
  const [type, setType] = useState<Kind>("deposit");
  const [drafts, setDrafts] = useState<Record<Kind, Draft>>({
    deposit: { amount: "", note: "" },
    withdraw: { amount: "", note: "" },
  });
  const [pending, setPending] = useState<Pending | null>(null);

  if (pending) {
    return <ConfirmStep student={student} pending={pending} onBack={() => setPending(null)} onDone={onDone} />;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">
          {student.fullName}
          {student.nickname && <span className="font-normal text-muted-foreground"> ({student.nickname})</span>}
        </DialogTitle>
        <DialogDescription>
          คงเหลือ <span className="text-lg font-semibold text-foreground tabular-nums">{formatBaht(student.balanceSatang)}</span> บาท
        </DialogDescription>
      </DialogHeader>

      <Tabs value={type} onValueChange={(v) => setType(v as Kind)}>
        <TabsList className="grid h-11 w-full grid-cols-2">
          <TabsTrigger value="deposit" className="text-base data-[state=active]:text-deposit">
            ฝากเงิน
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="text-base data-[state=active]:text-withdraw">
            ถอนเงิน
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="mt-4 grid gap-4">
          <QuickAmounts onPick={(baht) => setPending({ type: "deposit", amountSatang: baht * 100, note: "" })} />
          <AmountForm
            type="deposit"
            student={student}
            draft={drafts.deposit}
            onDraft={(d) => setDrafts((all) => ({ ...all, deposit: d }))}
            onReview={setPending}
          />
        </TabsContent>
        <TabsContent value="withdraw" className="mt-4">
          <AmountForm
            type="withdraw"
            student={student}
            draft={drafts.withdraw}
            onDraft={(d) => setDrafts((all) => ({ ...all, withdraw: d }))}
            onReview={setPending}
          />
        </TabsContent>
      </Tabs>

      {historyHref && (
        <Button variant="ghost" asChild className="justify-self-center">
          <Link href={historyHref}>
            <History aria-hidden />
            ดูประวัติการฝาก-ถอน
          </Link>
        </Button>
      )}
    </>
  );
}

function QuickAmounts({ onPick }: { onPick: (baht: number) => void }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">เลือกจำนวนเงินที่ฝาก</p>
      <div className="grid grid-cols-5 gap-2">
        {QUICK_AMOUNTS.map((baht) => (
          <Button
            key={baht}
            type="button"
            variant="outline"
            onClick={() => onPick(baht)}
            className="h-14 border-deposit/30 bg-deposit-soft text-lg font-semibold text-deposit hover:bg-deposit-soft/70 hover:text-deposit"
            aria-label={`ฝาก ${baht} บาท`}
          >
            {baht}
          </Button>
        ))}
      </div>
    </div>
  );
}

function AmountForm({
  type,
  student,
  draft,
  onDraft,
  onReview,
}: {
  type: Kind;
  student: MoneyDialogStudent;
  draft: Draft;
  onDraft: (draft: Draft) => void;
  onReview: (pending: Pending) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const isWithdraw = type === "withdraw";
  const empty = isWithdraw && student.balanceSatang <= 0;

  // Checked here so the confirm step only ever shows a valid amount;
  // the server checks everything again when it saves.
  function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const satang = parseBahtToSatang(draft.amount);
    if (satang === null) {
      setError("จำนวนเงินไม่ถูกต้อง (มากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง)");
      amountRef.current?.focus();
      return;
    }
    if (isWithdraw && satang > student.balanceSatang) {
      setError(`ถอนได้ไม่เกินยอดคงเหลือ ${formatBaht(student.balanceSatang)} บาท`);
      amountRef.current?.focus();
      return;
    }
    setError(null);
    onReview({ type, amountSatang: satang, note: draft.note.trim().slice(0, 100) });
  }

  return (
    <form onSubmit={review} className="grid gap-3" noValidate>
      <p className="text-sm font-medium">{isWithdraw ? "จำนวนที่ถอน" : "หรือใส่จำนวนอื่น"}</p>
      <div className="flex gap-2">
        <div className="flex-1">
          <FormField
            ref={amountRef}
            id={`amount-${type}`}
            label="จำนวนเงิน (บาท)"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={draft.amount}
            onChange={(e) => onDraft({ ...draft, amount: e.target.value })}
            errors={error ? [error] : undefined}
            disabled={empty}
          />
        </div>
        {isWithdraw && !empty && (
          <Button
            type="button"
            variant="outline"
            className="mt-[1.375rem] h-11"
            onClick={() => onDraft({ ...draft, amount: String(student.balanceSatang / 100) })}
          >
            ถอนทั้งหมด
          </Button>
        )}
      </div>
      <FormField
        id={`note-${type}`}
        label="หมายเหตุ (ไม่บังคับ)"
        name="note"
        maxLength={100}
        value={draft.note}
        onChange={(e) => onDraft({ ...draft, note: e.target.value })}
        disabled={empty}
      />
      {empty && <p className="text-sm text-muted-foreground">ยังไม่มีเงินให้ถอน</p>}
      <Button
        type="submit"
        size="touch"
        disabled={empty}
        className={isWithdraw ? "bg-withdraw text-withdraw-foreground hover:bg-withdraw/90" : "bg-deposit text-deposit-foreground hover:bg-deposit/90"}
      >
        ถัดไป: ตรวจสอบก่อนบันทึก
      </Button>
    </form>
  );
}

function ConfirmStep({
  student,
  pending,
  onBack,
  onDone,
}: {
  student: MoneyDialogStudent;
  pending: Pending;
  onBack: () => void;
  onDone: () => void;
}) {
  const [saving, startTransition] = useTransition();
  const isWithdraw = pending.type === "withdraw";
  const after = student.balanceSatang + (isWithdraw ? -pending.amountSatang : pending.amountSatang);
  const Icon = isWithdraw ? ArrowUpRight : ArrowDownLeft;

  function confirm() {
    const form = new FormData();
    form.set("type", pending.type);
    form.set("amount", (pending.amountSatang / 100).toFixed(2));
    form.set("note", pending.note);
    startTransition(async () => {
      const result = await recordTransactionAction(student.id, null, form);
      showRecordToast(result);
      if (result.ok) onDone();
      else onBack();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">ยืนยันการ{isWithdraw ? "ถอน" : "ฝาก"}เงิน</DialogTitle>
        <DialogDescription>ตรวจสอบให้ถูกต้องก่อนกดยืนยัน</DialogDescription>
      </DialogHeader>

      <div className={cn("grid gap-3 rounded-xl border p-4", isWithdraw ? "border-withdraw/30 bg-withdraw-soft" : "border-deposit/30 bg-deposit-soft")}>
        <p className="font-medium">
          {student.fullName}
          {student.nickname && <span className="font-normal text-muted-foreground"> ({student.nickname})</span>}
        </p>
        <p className={cn("flex items-center gap-2 text-3xl font-semibold tabular-nums", isWithdraw ? "text-withdraw" : "text-deposit")}>
          <Icon className="size-7 shrink-0" aria-hidden />
          {isWithdraw ? "ถอน" : "ฝาก"} {formatBaht(pending.amountSatang)} บาท
        </p>
        {pending.note && <p className="text-sm text-muted-foreground">หมายเหตุ: {pending.note}</p>}
        <dl className="grid grid-cols-2 gap-2 border-t pt-3 text-sm">
          <dt className="text-muted-foreground">ยอดตอนนี้</dt>
          <dd className="text-right tabular-nums">{formatBaht(student.balanceSatang)} บาท</dd>
          <dt className="font-medium">ยอดหลังบันทึก</dt>
          <dd className="text-right text-base font-semibold tabular-nums">{formatBaht(after)} บาท</dd>
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="touch" disabled={saving} onClick={onBack}>
          แก้ไข
        </Button>
        <Button
          type="button"
          size="touch"
          disabled={saving}
          onClick={confirm}
          autoFocus
          className={isWithdraw ? "bg-withdraw text-withdraw-foreground hover:bg-withdraw/90" : "bg-deposit text-deposit-foreground hover:bg-deposit/90"}
        >
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          ยืนยัน{isWithdraw ? "ถอน" : "ฝาก"}
        </Button>
      </div>
    </>
  );
}

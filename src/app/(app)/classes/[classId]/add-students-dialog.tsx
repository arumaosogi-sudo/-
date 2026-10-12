"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { parseStudentList } from "@/lib/parse-students";
import type { ActionResult } from "@/lib/validation";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

type Props = {
  addOne: Action;
  addMany: Action;
  nextNumber: number;
  /** Opens on the paste tab — nicer for an empty class. */
  preferBulk?: boolean;
  triggerLabel?: string;
};

export function AddStudentsDialog({ addOne, addMany, nextNumber, preferBulk, triggerLabel = "เพิ่มนักเรียน" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="touch">
          <UserPlus aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>เพิ่มนักเรียน</DialogTitle>
          <DialogDescription>เพิ่มทีละคน หรือคัดลอกรายชื่อจาก Excel / Google Sheets มาวางได้เลย</DialogDescription>
        </DialogHeader>
        {open && (
          <Tabs defaultValue={preferBulk ? "bulk" : "one"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="one">ทีละคน</TabsTrigger>
              <TabsTrigger value="bulk">วางรายชื่อ</TabsTrigger>
            </TabsList>
            <TabsContent value="one">
              <SingleForm action={addOne} nextNumber={nextNumber} />
            </TabsContent>
            <TabsContent value="bulk">
              <BulkForm action={addMany} nextNumber={nextNumber} onDone={() => setOpen(false)} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SingleForm({ action, nextNumber }: { action: Action; nextNumber: number }) {
  const [state, formAction, pending] = useActionState(action, null);
  // Bump the key after each success so the form resets for the next student.
  const [formKey, setFormKey] = useState(0);
  useActionFeedback(state, () => setFormKey((k) => k + 1));
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form key={formKey} action={formAction} className="mt-4 grid gap-4">
      <div className="grid grid-cols-[5.5rem_1fr] gap-3">
        <FormField
          label="เลขที่"
          name="number"
          inputMode="numeric"
          defaultValue={values?.number ?? nextNumber}
          errors={fieldErrors?.number}
          required
        />
        <FormField
          label="ชื่อ-นามสกุล"
          name="fullName"
          defaultValue={values?.fullName}
          errors={fieldErrors?.fullName}
          autoFocus
          required
        />
      </div>
      <FormField label="ชื่อเล่น (ไม่บังคับ)" name="nickname" defaultValue={values?.nickname} errors={fieldErrors?.nickname} />
      <DialogFooter>
        <Button type="submit" size="touch" disabled={pending} className="w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          เพิ่มและกรอกคนถัดไป
        </Button>
      </DialogFooter>
    </form>
  );
}

function BulkForm({ action, nextNumber, onDone }: { action: Action; nextNumber: number; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [text, setText] = useState("");
  useActionFeedback(state, onDone);
  const preview = useMemo(() => parseStudentList(text, nextNumber - 1), [text, nextNumber]);

  return (
    <form action={formAction} className="mt-4 grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="student-list">รายชื่อนักเรียน (บรรทัดละ 1 คน)</Label>
        <Textarea
          id="student-list"
          name="list"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          className="text-base"
        />
        <p className="text-sm text-muted-foreground">
          ใส่เลขที่นำหน้าหรือไม่ก็ได้ · ชื่อเล่นใส่ในวงเล็บท้ายชื่อ
        </p>
      </div>

      {preview.length > 0 && (
        <div className="rounded-lg border bg-muted/40">
          <p className="border-b px-3 py-2 text-sm font-medium">ตัวอย่าง: จะเพิ่ม {preview.length} คน</p>
          <ul className="max-h-40 overflow-y-auto px-3 py-2 text-sm">
            {preview.map((s, i) => (
              <li key={i} className="flex gap-2 py-0.5">
                <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{s.number}</span>
                <span className="truncate">
                  {s.fullName}
                  {s.nickname && <span className="text-muted-foreground"> ({s.nickname})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter>
        <Button type="submit" size="touch" disabled={pending || preview.length === 0} className="w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {preview.length > 0 ? `เพิ่มนักเรียน ${preview.length} คน` : "เพิ่มนักเรียน"}
        </Button>
      </DialogFooter>
    </form>
  );
}

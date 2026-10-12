"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
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
import { useActionFeedback } from "@/hooks/use-action-feedback";
import type { ActionResult } from "@/lib/validation";

type Props = {
  trigger: ReactNode;
  title: string;
  description?: string;
  submitLabel: string;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  defaults: { name?: string; schoolYear: string };
};

export function ClassroomFormDialog({ trigger, title, description, submitLabel, action, defaults }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {/* Remount the form each time so errors from last time are cleared. */}
        {open && <ClassroomForm action={action} defaults={defaults} submitLabel={submitLabel} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ClassroomForm({
  action,
  defaults,
  submitLabel,
  onDone,
}: Pick<Props, "action" | "defaults" | "submitLabel"> & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, null);

  useActionFeedback(state, onDone);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={formAction} className="grid gap-4">
      <FormField
        label="ชื่อห้อง"
        name="name"
        defaultValue={values?.name ?? defaults.name}
        errors={fieldErrors?.name}
        autoFocus
        required
      />
      <FormField
        label="ปีการศึกษา (พ.ศ.)"
        name="schoolYear"
        inputMode="numeric"
        maxLength={4}
        defaultValue={values?.schoolYear ?? defaults.schoolYear}
        errors={fieldErrors?.schoolYear}
        required
      />
      <DialogFooter>
        <Button type="submit" size="touch" disabled={pending} className="w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Unplug } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { disconnectLineChannelAction, repairWebhookAction, saveLineChannelAction } from "./actions";

/** Channel ID / secret / access token form. Saving verifies everything with LINE. */
export function LineConnectForm({ channelId, onDone }: { channelId?: string; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(saveLineChannelAction, null);
  useActionFeedback(state, onDone);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={formAction} className="grid gap-4">
      <FormField
        label="Channel ID"
        name="channelId"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={values?.channelId ?? channelId}
        errors={fieldErrors?.channelId}
        required
      />
      <FormField
        label="Channel secret"
        name="channelSecret"
        type="password"
        autoComplete="off"
        defaultValue={values?.channelSecret}
        errors={fieldErrors?.channelSecret}
        required
      />
      <FormField
        label="Channel access token (long-lived)"
        name="accessToken"
        type="password"
        autoComplete="off"
        defaultValue={values?.accessToken}
        errors={fieldErrors?.accessToken}
        required
      />
      <Button type="submit" size="touch" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "กำลังตรวจสอบกับ LINE..." : "บันทึกและทดสอบการเชื่อมต่อ"}
      </Button>
    </form>
  );
}

export function DisconnectLineButton() {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="touch" className="w-full sm:w-auto">
          <Unplug aria-hidden />
          ยกเลิกการเชื่อมต่อ
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยกเลิกการเชื่อมต่อ LINE?</AlertDialogTitle>
          <AlertDialogDescription>
            ผู้ปกครองจะไม่ได้รับข้อความและการตอบกลับอัตโนมัติจนกว่าจะเชื่อมต่อใหม่ (การเชื่อมต่อของผู้ปกครองยังถูกเก็บไว้)
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>ไม่ใช่ตอนนี้</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const r = await disconnectLineChannelAction();
                if (r.ok) toast.success(r.message);
                else toast.error(r.error);
                setOpen(false);
              });
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            ยกเลิกการเชื่อมต่อ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** For accounts created with email before LINE Login: links the teacher's LINE for future sign-ins. */
export function LinkLineLoginButton() {
  const [pending, setPending] = useState(false);

  return (
    <Button
      size="touch"
      disabled={pending}
      className="w-full bg-[#06C755] text-white hover:bg-[#05b34c] sm:w-auto"
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.linkSocial({ provider: "line", callbackURL: "/settings" });
        if (error) {
          setPending(false);
          toast.error(authErrorMessage(error));
        }
      }}
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      เชื่อมบัญชี LINE สำหรับเข้าสู่ระบบ
    </Button>
  );
}

/** Re-points the OA's webhook at this app using the saved keys. */
export function RepairWebhookButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="touch"
      disabled={pending}
      className="w-full sm:w-auto sm:justify-self-start"
      onClick={() =>
        startTransition(async () => {
          const r = await repairWebhookAction();
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
        })
      }
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      แก้ Webhook ให้ชี้มาที่แอปนี้
    </Button>
  );
}

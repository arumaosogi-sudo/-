"use client";

import { useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendStudentBalanceAction } from "./parent-actions";

/** Sends this student's balance to their LINE-linked parents right now. */
export function SendBalanceButton({ studentId, guardianCount }: { studentId: string; guardianCount: number }) {
  const [pending, startTransition] = useTransition();

  if (guardianCount === 0) {
    return <p className="text-sm text-muted-foreground">ผู้ปกครองยังไม่ได้เชื่อมต่อ LINE</p>;
  }

  return (
    <Button
      variant="outline"
      size="touch"
      disabled={pending}
      className="w-full sm:w-auto"
      onClick={() =>
        startTransition(async () => {
          const result = await sendStudentBalanceAction(studentId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
      ส่งยอดให้ผู้ปกครองทาง LINE ({guardianCount} คน)
    </Button>
  );
}

"use client";

import { toast } from "sonner";
import { undoTransactionAction, type RecordResult } from "./money-actions";

/** Success toast with an "ยกเลิก" (undo) button, or an error toast. */
export function showRecordToast(result: RecordResult) {
  if (!result.ok) {
    toast.error(result.error);
    return;
  }
  toast.success(result.message, {
    duration: 5000,
    action: {
      label: "ยกเลิก",
      onClick: async () => {
        const undo = await undoTransactionAction(result.transactionId);
        if (undo.ok) toast.info(undo.message);
        else toast.error(undo.error);
      },
    },
  });
}

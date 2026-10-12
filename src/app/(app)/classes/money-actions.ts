"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatBaht } from "@/lib/format";
import { UNDO_WINDOW_MS } from "@/lib/money";
import { idSchema, transactionSchema, type ActionResult } from "@/lib/validation";
import { requireUser } from "@/server/dal";
import * as money from "@/server/money";

export type RecordResult =
  | { ok: true; message: string; transactionId: string; balanceSatang: number }
  | Extract<ActionResult, { ok: false }>;

// Balances show up on the class list, class page and student page.
const refresh = () => revalidatePath("/classes", "layout");

async function record(
  studentId: string,
  input: { type: "deposit" | "withdraw"; amountSatang: number; note: string | null },
): Promise<RecordResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(studentId).success) return { ok: false, error: "ไม่พบนักเรียน" };

  const result = await money.recordTransaction(user.id, { studentId, ...input });
  if (!result.ok) return result;
  refresh();
  const verb = input.type === "deposit" ? "ฝาก" : "ถอน";
  return {
    ok: true,
    message: `${verb} ${formatBaht(input.amountSatang)} บาทแล้ว · คงเหลือ ${formatBaht(result.balanceSatang)} บาท`,
    transactionId: result.id,
    balanceSatang: result.balanceSatang,
  };
}

export async function recordTransactionAction(
  studentId: string,
  _prev: RecordResult | null,
  formData: FormData,
): Promise<RecordResult> {
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "กรุณาตรวจสอบข้อมูลอีกครั้ง",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: Object.fromEntries([...formData].map(([k, v]) => [k, String(v)])),
    };
  }
  const { type, amount, note } = parsed.data;
  return record(studentId, { type, amountSatang: amount, note });
}

export async function undoTransactionAction(transactionId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(transactionId).success) return { ok: false, error: "ไม่พบรายการ" };

  // The server window (UNDO_WINDOW_MS) is far longer than the 5-second toast,
  // so a tap on "ยกเลิก" still works over a slow connection.
  const result = await money.undoTransaction(user.id, transactionId, UNDO_WINDOW_MS);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "ยกเลิกรายการแล้ว" };
}

export async function reverseTransactionAction(transactionId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(transactionId).success) return { ok: false, error: "ไม่พบรายการ" };

  const result = await money.reverseTransaction(user.id, transactionId);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: "ยกเลิกรายการแล้ว ยอดเงินถูกปรับให้ถูกต้อง" };
}

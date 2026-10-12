"use server";

import { revalidatePath } from "next/cache";
import { idSchema, type ActionResult } from "@/lib/validation";
import { requireUser } from "@/server/dal";
import { regenerateLinkCode, removeGuardian, sendStudentToParents } from "@/server/notify";

/** Sends one student's current balance to that student's parents right now. */
export async function sendStudentBalanceAction(studentId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(studentId).success) return { ok: false, error: "ไม่พบนักเรียน" };

  const result = await sendStudentToParents(user.id, studentId);
  if (result.noChannel) return { ok: false, error: "ยังไม่ได้เชื่อม LINE Official Account ของคุณ (ตั้งค่า → LINE)" };
  const total = result.sent + result.failed;
  if (total === 0) return { ok: false, error: "นักเรียนคนนี้ยังไม่มีผู้ปกครองเชื่อมต่อ LINE" };
  revalidatePath("/settings");
  if (result.failed) return { ok: false, error: `ส่งไม่สำเร็จ ${result.failed} จาก ${total} คน ลองใหม่อีกครั้ง` };
  return {
    ok: true,
    message: result.dryRun
      ? `โหมดทดลอง: จำลองการส่งถึงผู้ปกครอง ${result.sent} คน`
      : `ส่งยอดเงินออมถึงผู้ปกครอง ${result.sent} คนแล้ว`,
  };
}

export async function regenerateCodeAction(studentId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(studentId).success) return { ok: false, error: "ไม่พบนักเรียน" };
  const row = await regenerateLinkCode(user.id, studentId);
  if (!row) return { ok: false, error: "ไม่พบนักเรียน" };
  revalidatePath(`/classes/${row.classroomId}/parents`);
  return { ok: true, message: "สร้างรหัสใหม่แล้ว รหัสเดิมใช้ไม่ได้อีก (ผู้ปกครองที่เชื่อมไว้แล้วยังรับแจ้งเตือนได้)" };
}

export async function removeGuardianAction(guardianId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(guardianId).success) return { ok: false, error: "ไม่พบผู้ปกครอง" };
  const row = await removeGuardian(user.id, guardianId);
  if (!row) return { ok: false, error: "ไม่พบผู้ปกครอง" };
  revalidatePath(`/classes/${row.classroomId}/parents`);
  revalidatePath(`/classes/${row.classroomId}`);
  return { ok: true, message: "ยกเลิกการเชื่อมต่อแล้ว ผู้ปกครองจะไม่ได้รับแจ้งเตือนอีก" };
}

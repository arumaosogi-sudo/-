"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as dal from "@/server/dal";
import {
  bulkStudentsSchema,
  classroomSchema,
  idSchema,
  studentSchema,
  type ActionResult,
} from "@/lib/validation";
import { parseStudentList } from "@/lib/parse-students";

const invalid = (error: z.ZodError, formData: FormData): ActionResult => ({
  ok: false,
  error: "กรุณาตรวจสอบข้อมูลอีกครั้ง",
  fieldErrors: z.flattenError(error).fieldErrors,
  values: Object.fromEntries([...formData].map(([k, v]) => [k, String(v)])),
});

// ---------------------------------------------------------------------------
// Classrooms
// ---------------------------------------------------------------------------

export async function createClassroomAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await dal.requireUser();
  const parsed = classroomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const { id } = await dal.createClassroom(user.id, parsed.data);
  revalidatePath("/classes");
  redirect(`/classes/${id}`);
}

export async function updateClassroomAction(
  classroomId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await dal.requireUser();
  if (!idSchema.safeParse(classroomId).success) return { ok: false, error: "ไม่พบห้องเรียน" };
  const parsed = classroomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  if (!(await dal.updateClassroom(user.id, classroomId, parsed.data))) {
    return { ok: false, error: "ไม่พบห้องเรียน" };
  }
  revalidatePath("/classes");
  revalidatePath(`/classes/${classroomId}`);
  return { ok: true, message: "บันทึกแล้ว" };
}

export async function setClassroomArchivedAction(classroomId: string, archived: boolean): Promise<ActionResult> {
  const user = await dal.requireUser();
  if (!idSchema.safeParse(classroomId).success) return { ok: false, error: "ไม่พบห้องเรียน" };

  const ok = await dal.updateClassroom(user.id, classroomId, { archivedAt: archived ? new Date() : null });
  if (!ok) return { ok: false, error: "ไม่พบห้องเรียน" };
  revalidatePath("/classes");
  revalidatePath(`/classes/${classroomId}`);
  return { ok: true, message: archived ? "เก็บห้องเรียนเข้าคลังแล้ว" : "นำห้องเรียนกลับมาแล้ว" };
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function addStudentAction(
  classroomId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await dal.requireUser();
  if (!idSchema.safeParse(classroomId).success) return { ok: false, error: "ไม่พบห้องเรียน" };
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  await dal.addStudents(user.id, classroomId, [parsed.data]);
  revalidatePath(`/classes/${classroomId}`);
  return { ok: true, message: `เพิ่ม ${parsed.data.fullName} แล้ว` };
}

export async function addStudentsBulkAction(
  classroomId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await dal.requireUser();
  if (!idSchema.safeParse(classroomId).success) return { ok: false, error: "ไม่พบห้องเรียน" };

  await dal.getClassroom(user.id, classroomId);
  const startAfter = (await dal.nextStudentNumber(classroomId)) - 1;
  const list = parseStudentList(String(formData.get("list") ?? ""), startAfter);
  const parsed = bulkStudentsSchema.safeParse(list.map((s) => ({ ...s, nickname: s.nickname ?? "" })));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "รายชื่อไม่ถูกต้อง" };
  }

  await dal.addStudents(user.id, classroomId, parsed.data);
  revalidatePath(`/classes/${classroomId}`);
  return { ok: true, message: `เพิ่มนักเรียน ${parsed.data.length} คนแล้ว` };
}

export async function updateStudentAction(
  studentId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await dal.requireUser();
  if (!idSchema.safeParse(studentId).success) return { ok: false, error: "ไม่พบนักเรียน" };
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const owned = await dal.updateStudent(user.id, studentId, parsed.data);
  if (!owned) return { ok: false, error: "ไม่พบนักเรียน" };
  revalidatePath(`/classes/${owned.classroomId}`);
  return { ok: true, message: "บันทึกแล้ว" };
}

export async function removeStudentAction(studentId: string): Promise<ActionResult> {
  const user = await dal.requireUser();
  if (!idSchema.safeParse(studentId).success) return { ok: false, error: "ไม่พบนักเรียน" };

  const result = await dal.removeStudent(user.id, studentId);
  if (!result) return { ok: false, error: "ไม่พบนักเรียน" };
  revalidatePath(`/classes/${result.classroomId}`);
  return {
    ok: true,
    message: result.archived ? "ย้ายออกจากห้องแล้ว (ประวัติการฝากยังถูกเก็บไว้)" : "ลบนักเรียนแล้ว",
  };
}

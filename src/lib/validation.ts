import { z } from "zod";
import { parseBahtToSatang } from "./money";

const name = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `กรุณากรอก${label}`)
    .max(max, `${label}ยาวเกิน ${max} ตัวอักษร`);

export const classroomSchema = z.object({
  name: name("ชื่อห้อง", 50),
  schoolYear: z
    .string()
    .trim()
    .regex(/^25\d{2}$/, "ปีการศึกษาต้องเป็นปี พ.ศ. 4 หลัก เช่น 2569"),
});

export const studentSchema = z.object({
  number: z.coerce
    .number({ error: "กรุณากรอกเลขที่" })
    .int("เลขที่ต้องเป็นจำนวนเต็ม")
    .min(1, "เลขที่ต้องมากกว่า 0")
    .max(999, "เลขที่มากเกินไป"),
  fullName: name("ชื่อ-นามสกุล", 100),
  nickname: z
    .string()
    .trim()
    .max(30, "ชื่อเล่นยาวเกิน 30 ตัวอักษร")
    .transform((v) => v || null),
});

export const bulkStudentsSchema = z.array(studentSchema).min(1, "ไม่พบรายชื่อ").max(100, "เพิ่มได้ครั้งละไม่เกิน 100 คน");

export const idSchema = z.uuid();

type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors;
      /** Submitted values, so forms can refill inputs React resets after an action. */
      values?: Record<string, string>;
    };

export const transactionSchema = z.object({
  type: z.enum(["deposit", "withdraw"], { error: "กรุณาเลือกฝากหรือถอน" }),
  amount: z
    .string()
    .trim()
    .min(1, "กรุณากรอกจำนวนเงิน")
    .transform((v, ctx) => {
      const satang = parseBahtToSatang(v);
      if (satang === null) {
        ctx.addIssue({ code: "custom", message: "จำนวนเงินไม่ถูกต้อง (มากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง)" });
        return z.NEVER;
      }
      return satang;
    }),
  note: z
    .string()
    .trim()
    .max(100, "หมายเหตุยาวเกิน 100 ตัวอักษร")
    .optional()
    .transform((v) => v || null),
});

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

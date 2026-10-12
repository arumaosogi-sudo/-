import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema, type Database } from "@/db";
import { formatBaht } from "@/lib/format";
import { effectiveTotal, signedAmount, studentBalance } from "./dal";

const { classrooms, students, transactions } = schema;

// Like dal.ts, every function here is scoped to the signed-in teacher.
// Writes run in a DB transaction that locks the student row first, so two
// entries for the same child can't both pass the balance check at once.

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type MoneyResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function getStudentDetail(teacherId: string, studentId: string) {
  const [row] = await db
    .select({
      id: students.id,
      number: students.number,
      fullName: students.fullName,
      nickname: students.nickname,
      archivedAt: students.archivedAt,
      classroomId: classrooms.id,
      classroomName: classrooms.name,
      classroomArchivedAt: classrooms.archivedAt,
      balanceSatang: studentBalance.mapWith(Number),
      depositedSatang: effectiveTotal("deposit").mapWith(Number),
      withdrawnSatang: effectiveTotal("withdraw").mapWith(Number),
      guardianCount: sql<number>`(
        select count(*) from guardians g where g.student_id = "students"."id"
      )`.mapWith(Number),
    })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(students.id, studentId), eq(classrooms.teacherId, teacherId)));
  if (!row) notFound();
  return row;
}

const monthKey = sql.raw(`to_char("transactions"."created_at" at time zone 'Asia/Bangkok', 'YYYY-MM')`);

/** Ledger rows for a student (newest first), optionally limited to one month. */
export async function listTransactions(teacherId: string, studentId: string, month?: string) {
  await getStudentDetail(teacherId, studentId);
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amountSatang: transactions.amountSatang,
      note: transactions.note,
      reversesId: transactions.reversesId,
      createdAt: transactions.createdAt,
      reversedById: sql<string | null>`(
        select r.id from transactions r where r.reverses_id = "transactions"."id"
      )`,
    })
    .from(transactions)
    .where(and(eq(transactions.studentId, studentId), month ? sql`${monthKey} = ${month}` : undefined))
    .orderBy(desc(transactions.createdAt))
    .limit(500);
}

/** Months ("YYYY-MM", newest first) in which the student has any entries. Call after an ownership check. */
export async function listTransactionMonths(studentId: string) {
  const rows = await db
    .selectDistinct({ month: sql<string>`${monthKey}` })
    .from(transactions)
    .where(eq(transactions.studentId, studentId));
  return rows.map((r) => r.month).sort().reverse();
}

async function lockOwnedStudent(tx: Tx, teacherId: string, studentId: string) {
  const [row] = await tx
    .select({
      id: students.id,
      classroomId: students.classroomId,
      archivedAt: students.archivedAt,
      classroomArchivedAt: classrooms.archivedAt,
    })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(students.id, studentId), eq(classrooms.teacherId, teacherId)))
    .for("update", { of: students });
  return row ?? null;
}

async function balanceOf(tx: Tx, studentId: string) {
  const [row] = await tx
    .select({ balance: sql<number>`coalesce(sum(${signedAmount}), 0)`.mapWith(Number) })
    .from(sql`transactions t`)
    .where(sql`t.student_id = ${studentId}`);
  return row.balance;
}

const insufficient = (balance: number) => `ยอดเงินไม่พอ (คงเหลือ ${formatBaht(balance)} บาท)`;

export async function recordTransaction(
  teacherId: string,
  input: { studentId: string; type: "deposit" | "withdraw"; amountSatang: number; note: string | null },
): Promise<MoneyResult<{ id: string; classroomId: string; balanceSatang: number }>> {
  return db.transaction(async (tx) => {
    const student = await lockOwnedStudent(tx, teacherId, input.studentId);
    if (!student) return { ok: false, error: "ไม่พบนักเรียน" };
    if (student.archivedAt || student.classroomArchivedAt) {
      return { ok: false, error: "ห้องหรือนักเรียนนี้อยู่ในคลัง บันทึกเงินไม่ได้" };
    }

    const balance = await balanceOf(tx, input.studentId);
    if (input.type === "withdraw" && input.amountSatang > balance) {
      return { ok: false, error: insufficient(balance) };
    }

    const [row] = await tx
      .insert(transactions)
      .values({ ...input, createdBy: teacherId })
      .returning({ id: transactions.id });
    const delta = input.type === "deposit" ? input.amountSatang : -input.amountSatang;
    return { ok: true, id: row.id, classroomId: student.classroomId, balanceSatang: balance + delta };
  });
}

/** Loads an entry of this teacher's, locks its student, and reports whether it was already reversed. */
async function loadEntry(tx: Tx, teacherId: string, transactionId: string) {
  const [entry] = await tx
    .select({
      id: transactions.id,
      studentId: transactions.studentId,
      type: transactions.type,
      amountSatang: transactions.amountSatang,
      reversesId: transactions.reversesId,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(students, eq(students.id, transactions.studentId))
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(transactions.id, transactionId), eq(classrooms.teacherId, teacherId)));
  if (!entry) return null;

  const student = await lockOwnedStudent(tx, teacherId, entry.studentId);
  if (!student) return null;
  const [reversal] = await tx
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.reversesId, transactionId));
  return { entry, student, reversed: Boolean(reversal) };
}

/** Deletes an entry recorded moments ago (the "ยกเลิก" button on the toast). */
export async function undoTransaction(
  teacherId: string,
  transactionId: string,
  windowMs: number,
): Promise<MoneyResult<{ classroomId: string; studentId: string }>> {
  return db.transaction(async (tx) => {
    const found = await loadEntry(tx, teacherId, transactionId);
    if (!found) return { ok: false, error: "ไม่พบรายการ" };
    const { entry, student, reversed } = found;

    if (Date.now() - entry.createdAt.getTime() > windowMs || reversed || entry.reversesId) {
      return { ok: false, error: "เลยเวลายกเลิกแล้ว ใช้ “ยกเลิกรายการ” ในหน้าประวัติแทน" };
    }
    if (entry.type === "deposit" && (await balanceOf(tx, entry.studentId)) < entry.amountSatang) {
      return { ok: false, error: "ยกเลิกไม่ได้ เพราะเงินก้อนนี้ถูกถอนไปแล้ว" };
    }

    await tx.delete(transactions).where(eq(transactions.id, transactionId));
    return { ok: true, classroomId: student.classroomId, studentId: entry.studentId };
  });
}

/** Cancels an older entry by recording the opposite amount; both stay in history. */
export async function reverseTransaction(
  teacherId: string,
  transactionId: string,
): Promise<MoneyResult<{ classroomId: string; studentId: string }>> {
  return db.transaction(async (tx) => {
    const found = await loadEntry(tx, teacherId, transactionId);
    if (!found) return { ok: false, error: "ไม่พบรายการ" };
    const { entry, student, reversed } = found;

    if (entry.reversesId) return { ok: false, error: "รายการนี้เป็นรายการยกเลิกอยู่แล้ว" };
    if (reversed) return { ok: false, error: "รายการนี้ถูกยกเลิกไปแล้ว" };

    const balance = await balanceOf(tx, entry.studentId);
    if (entry.type === "deposit" && balance < entry.amountSatang) {
      return { ok: false, error: `ยกเลิกไม่ได้ ${insufficient(balance)}` };
    }

    await tx.insert(transactions).values({
      studentId: entry.studentId,
      type: entry.type === "deposit" ? "withdraw" : "deposit",
      amountSatang: entry.amountSatang,
      reversesId: entry.id,
      createdBy: teacherId,
    });
    return { ok: true, classroomId: student.classroomId, studentId: entry.studentId };
  });
}

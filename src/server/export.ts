import "server-only";
import ExcelJS from "exceljs";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatDateTime } from "@/lib/format";
import { effectiveTotal, studentBalance } from "./dal";

const { classrooms, students, transactions } = schema;

const MONEY = '#,##0.00;[Red]-#,##0.00';

/** Builds an .xlsx report for one of this teacher's classrooms, or null if not theirs. */
export async function classroomWorkbook(teacherId: string, classroomId: string) {
  const [classroom] = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)));
  if (!classroom) return null;

  const summary = await db
    .select({
      number: students.number,
      fullName: students.fullName,
      nickname: students.nickname,
      deposited: effectiveTotal("deposit").mapWith(Number),
      withdrawn: effectiveTotal("withdraw").mapWith(Number),
      balance: studentBalance.mapWith(Number),
    })
    .from(students)
    .where(and(eq(students.classroomId, classroomId), isNull(students.archivedAt)))
    .orderBy(asc(students.number));

  const entries = await db
    .select({
      createdAt: transactions.createdAt,
      number: students.number,
      fullName: students.fullName,
      type: transactions.type,
      amount: transactions.amountSatang,
      reversesId: transactions.reversesId,
      note: transactions.note,
    })
    .from(transactions)
    .innerJoin(students, eq(students.id, transactions.studentId))
    .where(eq(students.classroomId, classroomId))
    .orderBy(asc(transactions.createdAt));

  const wb = new ExcelJS.Workbook();
  wb.creator = "กระปุกห้องเรียน";
  wb.created = new Date();

  // Sheet 1: one row per student.
  const s1 = wb.addWorksheet("สรุปยอด", { views: [{ state: "frozen", ySplit: 3 }] });
  s1.addRow([`ห้อง ${classroom.name} · ปีการศึกษา ${classroom.schoolYear}`]).font = { bold: true, size: 14 };
  s1.addRow([`ข้อมูล ณ ${formatDateTime(new Date())}`]).font = { color: { argb: "FF6B7773" } };
  const h1 = s1.addRow(["เลขที่", "ชื่อ-นามสกุล", "ชื่อเล่น", "ฝากทั้งหมด (บาท)", "ถอนทั้งหมด (บาท)", "คงเหลือ (บาท)"]);
  for (const s of summary) {
    s1.addRow([s.number, s.fullName, s.nickname ?? "", s.deposited / 100, s.withdrawn / 100, s.balance / 100]);
  }
  const total = s1.addRow([
    "",
    "รวมทั้งห้อง",
    "",
    summary.reduce((a, s) => a + s.deposited, 0) / 100,
    summary.reduce((a, s) => a + s.withdrawn, 0) / 100,
    summary.reduce((a, s) => a + s.balance, 0) / 100,
  ]);
  total.font = { bold: true };
  s1.columns = [{ width: 8 }, { width: 32 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 16 }];
  for (const col of [4, 5, 6]) s1.getColumn(col).numFmt = MONEY;

  // Sheet 2: every ledger entry, oldest first.
  const s2 = wb.addWorksheet("รายการฝาก-ถอน", { views: [{ state: "frozen", ySplit: 1 }] });
  const h2 = s2.addRow(["วันที่-เวลา", "เลขที่", "ชื่อ-นามสกุล", "รายการ", "จำนวน (บาท)", "หมายเหตุ"]);
  for (const e of entries) {
    const label = e.reversesId ? "ยกเลิกรายการ" : e.type === "deposit" ? "ฝาก" : "ถอน";
    const signed = (e.type === "deposit" ? e.amount : -e.amount) / 100;
    s2.addRow([formatDateTime(e.createdAt), e.number, e.fullName, label, signed, e.note ?? ""]);
  }
  s2.columns = [{ width: 20 }, { width: 8 }, { width: 32 }, { width: 14 }, { width: 16 }, { width: 30 }];
  s2.getColumn(5).numFmt = MONEY;

  for (const header of [h1, h2]) {
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F9E7A" } };
    });
  }

  return { buffer: await wb.xlsx.writeBuffer(), classroom };
}

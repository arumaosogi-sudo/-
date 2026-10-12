import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatBaht } from "@/lib/format";
import { idSchema, monthKeySchema } from "@/lib/validation";
import { requireUser } from "@/server/dal";
import { getStudentDetail, listTransactionMonths, listTransactions } from "@/server/money";
import { SendBalanceButton } from "../../../send-balance-button";
import { MonthFilter } from "./month-filter";
import { StudentMoneyButton } from "./student-money-button";
import { TransactionList } from "./transaction-list";

type Props = PageProps<"/classes/[classId]/students/[studentId]">;

async function loadStudent(params: Props["params"]) {
  const { classId, studentId } = await params;
  if (!idSchema.safeParse(classId).success || !idSchema.safeParse(studentId).success) notFound();
  const user = await requireUser();
  const student = await getStudentDetail(user.id, studentId);
  if (student.classroomId !== classId) notFound();
  return { user, student };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { student } = await loadStudent(params);
  return { title: `ประวัติ ${student.fullName}` };
}

export default async function StudentPage({ params, searchParams }: Props) {
  const { user, student } = await loadStudent(params);
  const rawMonth = (await searchParams).month;
  const month = typeof rawMonth === "string" && monthKeySchema.safeParse(rawMonth).success ? rawMonth : undefined;

  const [entries, months] = await Promise.all([
    listTransactions(user.id, student.id, month),
    listTransactionMonths(student.id),
  ]);
  const readOnly = student.archivedAt !== null || student.classroomArchivedAt !== null;

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href={`/classes/${student.classroomId}`}
          className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {student.classroomName}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {student.fullName}
          {student.nickname && <span className="font-normal text-muted-foreground"> ({student.nickname})</span>}
        </h1>
        <p className="text-sm text-muted-foreground">
          เลขที่ {student.number}
          {student.archivedAt && " · ย้ายออกจากห้องแล้ว"}
        </p>
      </div>

      <section aria-label="สรุปเงินออม" className="grid gap-3">
        <div className="flex items-end justify-between gap-4 rounded-xl bg-primary p-5 text-primary-foreground">
          <div>
            <p className="text-sm opacity-90">เงินออมคงเหลือ</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums sm:text-4xl">{formatBaht(student.balanceSatang)} ฿</p>
          </div>
          {!readOnly && (
            <StudentMoneyButton
              student={{
                id: student.id,
                fullName: student.fullName,
                nickname: student.nickname,
                balanceSatang: student.balanceSatang,
              }}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">ฝากทั้งหมด</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-deposit">
              {student.depositedSatang > 0 && "+"}
              {formatBaht(student.depositedSatang)} ฿
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">ถอนทั้งหมด</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-withdraw">
              {student.withdrawnSatang > 0 && "−"}
              {formatBaht(student.withdrawnSatang)} ฿
            </p>
          </div>
        </div>
        {!readOnly && <SendBalanceButton studentId={student.id} guardianCount={student.guardianCount} />}
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">ประวัติการฝาก-ถอน</h2>
          {months.length > 0 && <MonthFilter months={months} value={month} />}
        </div>
        {entries.length > 0 ? (
          <TransactionList entries={entries} readOnly={readOnly} />
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            {month ? "ไม่มีรายการในเดือนนี้" : "ยังไม่มีรายการฝาก-ถอน"}
          </p>
        )}
      </section>
    </div>
  );
}

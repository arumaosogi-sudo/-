import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { formatBaht } from "@/lib/format";
import { idSchema } from "@/lib/validation";
import { getClassroom, listStudents, requireUser } from "@/server/dal";
import { addStudentAction, addStudentsBulkAction, updateClassroomAction } from "../actions";
import { AddStudentsDialog } from "./add-students-dialog";
import { ClassroomMenu } from "./classroom-menu";
import { StudentList } from "./student-list";

async function loadClassroom(classId: string) {
  if (!idSchema.safeParse(classId).success) notFound();
  const user = await requireUser();
  return getClassroom(user.id, classId);
}

export async function generateMetadata({ params }: PageProps<"/classes/[classId]">): Promise<Metadata> {
  const classroom = await loadClassroom((await params).classId);
  return { title: classroom.name };
}

export default async function ClassroomPage({ params }: PageProps<"/classes/[classId]">) {
  const { classId } = await params;
  const user = await requireUser();
  const classroom = await loadClassroom(classId);
  const students = await listStudents(user.id, classId);

  const totalSatang = students.reduce((sum, s) => sum + s.balanceSatang, 0);
  const todaySatang = students.reduce((sum, s) => sum + s.depositedTodaySatang, 0);
  const todayCount = students.filter((s) => s.depositedTodaySatang > 0).length;
  const linkedCount = students.filter((s) => s.guardianCount > 0).length;
  const nextNumber = students.reduce((max, s) => Math.max(max, s.number), 0) + 1;
  const archived = classroom.archivedAt !== null;

  const addDialog = (
    <AddStudentsDialog
      addOne={addStudentAction.bind(null, classId)}
      addMany={addStudentsBulkAction.bind(null, classId)}
      nextNumber={nextNumber}
      preferBulk={students.length === 0}
    />
  );

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href={archived ? "/classes?archived=1" : "/classes"}
          className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          ห้องเรียนทั้งหมด
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{classroom.name}</h1>
            <p className="text-sm text-muted-foreground">ปีการศึกษา {classroom.schoolYear}</p>
          </div>
          <ClassroomMenu
            classroom={{ id: classroom.id, name: classroom.name, schoolYear: classroom.schoolYear, archived }}
            updateAction={updateClassroomAction.bind(null, classId)}
          />
        </div>
      </div>

      {archived && (
        <p className="flex items-center gap-2 rounded-lg border border-withdraw/30 bg-withdraw-soft px-4 py-3 text-sm">
          <Archive className="size-4 shrink-0 text-withdraw" aria-hidden />
          ห้องนี้อยู่ในคลัง ดูข้อมูลได้ตามปกติ และนำกลับมาใช้งานได้จากเมนู ⋮
        </p>
      )}

      <section aria-label="สรุปห้องเรียน" className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-primary p-4 text-primary-foreground">
          <p className="text-sm opacity-90">เงินออมรวมทั้งห้อง</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{formatBaht(totalSatang)} ฿</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">จำนวนนักเรียน</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
            {students.length} <span className="text-base font-normal text-muted-foreground">คน</span>
          </p>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-xl border border-deposit/20 bg-deposit-soft px-4 py-3">
          <p className="text-sm">
            วันนี้ฝากแล้ว <span className="font-semibold">{todayCount}</span> คน
          </p>
          <p className="font-semibold tabular-nums text-deposit">+{formatBaht(todaySatang)} ฿</p>
        </div>
      </section>

      {students.length > 0 && (
        <Link
          href={`/classes/${classId}/parents`}
          className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#06C755] text-white">
            <MessageCircle className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">ผู้ปกครอง (LINE)</span>
            <span className="block text-sm text-muted-foreground">
              เชื่อมต่อแล้ว {linkedCount} จาก {students.length} คน · พิมพ์ใบเชิญ
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">รายชื่อนักเรียน</h2>
          {students.length > 0 && !archived && addDialog}
        </div>

        {students.length > 0 ? (
          <>
            {!archived && <p className="-mt-1 text-sm text-muted-foreground">แตะชื่อนักเรียนเพื่อฝากหรือถอนเงิน</p>}
            <StudentList students={students} classroomId={classId} readOnly={archived} />
          </>
        ) : (
          <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">ยังไม่มีนักเรียนในห้องนี้</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              คัดลอกรายชื่อจาก Excel หรือ Google Sheets มาวางได้ทีเดียวทั้งห้อง
            </p>
            {!archived && addDialog}
          </div>
        )}
      </section>
    </div>
  );
}

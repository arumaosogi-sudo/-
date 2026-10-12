import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ChevronRight, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentSchoolYear, formatBaht } from "@/lib/format";
import { listClassrooms, requireUser } from "@/server/dal";
import { createClassroomAction } from "./actions";
import { ClassroomFormDialog } from "./classroom-form-dialog";

export const metadata: Metadata = { title: "ห้องเรียนของฉัน" };

export default async function ClassesPage({ searchParams }: PageProps<"/classes">) {
  const user = await requireUser();
  const showArchived = (await searchParams).archived === "1";
  const classes = await listClassrooms(user.id, { archived: showArchived });

  const createButton = (
    <ClassroomFormDialog
      title="สร้างห้องเรียนใหม่"
      description="ตั้งชื่อห้องให้จำง่าย แล้วค่อยเพิ่มรายชื่อนักเรียนในขั้นถัดไป"
      submitLabel="สร้างห้องเรียน"
      action={createClassroomAction}
      defaults={{ schoolYear: currentSchoolYear() }}
      trigger={
        <Button size="touch">
          <Plus aria-hidden />
          สร้างห้องเรียน
        </Button>
      }
    />
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">สวัสดี {user.name}</p>
          <h1 className="text-2xl font-semibold">{showArchived ? "ห้องเรียนในคลัง" : "ห้องเรียนของฉัน"}</h1>
        </div>
        {!showArchived && classes.length > 0 && createButton}
      </div>

      {classes.length === 0 ? (
        showArchived ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">ยังไม่มีห้องเรียนในคลัง</p>
        ) : (
          <Onboarding action={createButton} />
        )
      ) : (
        <ul className="grid gap-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/classes/${c.id}`}
                className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{c.name}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="size-4" aria-hidden />
                    นักเรียน {c.studentCount} คน · ปีการศึกษา {c.schoolYear}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">เงินออมรวม</p>
                  <p className="text-lg font-semibold tabular-nums text-deposit">{formatBaht(c.totalSatang)} ฿</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="text-center">
        <Button variant="ghost" asChild>
          <Link href={showArchived ? "/classes" : "/classes?archived=1"}>
            <Archive aria-hidden />
            {showArchived ? "กลับไปห้องเรียนปัจจุบัน" : "ดูห้องเรียนในคลัง"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Onboarding({ action }: { action: React.ReactNode }) {
  const steps = [
    { title: "สร้างห้องเรียน", body: "ตั้งชื่อห้อง เช่น ป.3/2" },
    { title: "เพิ่มรายชื่อนักเรียน", body: "พิมพ์ทีละคน หรือคัดลอกจาก Excel มาวางทีเดียว" },
    { title: "เริ่มบันทึกเงินฝาก", body: "แตะชื่อนักเรียน แล้วเลือกจำนวนเงิน" },
  ];

  return (
    <div className="rounded-2xl border bg-card p-6 sm:p-8">
      <h2 className="text-xl font-semibold">เริ่มต้นใช้งานใน 3 ขั้นตอน</h2>
      <ol className="mt-5 grid gap-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span
              className={
                "flex size-9 shrink-0 items-center justify-center rounded-full font-semibold " +
                (i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")
              }
            >
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6">{action}</div>
    </div>
  );
}

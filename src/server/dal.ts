import "server-only";
import { and, asc, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";

const { classrooms, students, transactions } = schema;

// Every read and write below is scoped to the signed-in teacher. Pages and
// server actions must go through these functions instead of querying `db`.

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

// Correlated subqueries are written with fully qualified names: Drizzle drops
// the table prefix from columns of the outer table, which makes "id" ambiguous.
export const signedAmount = sql.raw(
  `case when t.type = 'deposit' then t.amount_satang else -t.amount_satang end`,
);
/** Savings of the students currently in the class; students moved out keep their history but no longer count. */
const classroomTotal = sql<number>`(
  select coalesce(sum(${signedAmount}), 0) from transactions t
  join students s on s.id = t.student_id
  where s.classroom_id = "classrooms"."id" and s.archived_at is null
)`;
const activeStudentCount = sql<number>`(
  select count(*) from students s
  where s.classroom_id = "classrooms"."id" and s.archived_at is null
)`;
export const studentBalance = sql<number>`(
  select coalesce(sum(${signedAmount}), 0) from transactions t
  where t.student_id = "students"."id"
)`;
const startOfTodayBangkok = sql.raw(
  `(date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok')`,
);
const studentDepositedToday = sql<number>`(
  select coalesce(sum(t.amount_satang), 0) from transactions t
  where t.student_id = "students"."id" and t.type = 'deposit'
    and t.reverses_id is null and t.created_at >= ${startOfTodayBangkok}
    and not exists (select 1 from transactions r where r.reverses_id = t.id)
)`;
/** Totals that ignore entries cancelled by a reversal (and the reversals themselves). */
export const effectiveTotal = (type: "deposit" | "withdraw") => sql<number>`(
  select coalesce(sum(t.amount_satang), 0) from transactions t
  where t.student_id = "students"."id" and t.type = ${type} and t.reverses_id is null
    and not exists (select 1 from transactions r where r.reverses_id = t.id)
)`;

// ---------------------------------------------------------------------------
// Classrooms
// ---------------------------------------------------------------------------

export async function listClassrooms(teacherId: string, { archived = false } = {}) {
  return db
    .select({
      id: classrooms.id,
      name: classrooms.name,
      schoolYear: classrooms.schoolYear,
      archivedAt: classrooms.archivedAt,
      studentCount: activeStudentCount.mapWith(Number),
      totalSatang: classroomTotal.mapWith(Number),
    })
    .from(classrooms)
    .where(
      and(
        eq(classrooms.teacherId, teacherId),
        archived ? isNotNull(classrooms.archivedAt) : isNull(classrooms.archivedAt),
      ),
    )
    .orderBy(desc(classrooms.schoolYear), asc(classrooms.name));
}

/** Returns the classroom or throws notFound() if it isn't this teacher's. */
export async function getClassroom(teacherId: string, classroomId: string) {
  const [row] = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)));
  if (!row) notFound();
  return row;
}

export async function createClassroom(teacherId: string, data: { name: string; schoolYear: string }) {
  const [row] = await db
    .insert(classrooms)
    .values({ teacherId, ...data })
    .returning({ id: classrooms.id });
  return row;
}

export async function updateClassroom(
  teacherId: string,
  classroomId: string,
  data: Partial<{ name: string; schoolYear: string; archivedAt: Date | null }>,
) {
  const rows = await db
    .update(classrooms)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
    .returning({ id: classrooms.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function listStudents(teacherId: string, classroomId: string) {
  await getClassroom(teacherId, classroomId);
  return db
    .select({
      id: students.id,
      number: students.number,
      fullName: students.fullName,
      nickname: students.nickname,
      balanceSatang: studentBalance.mapWith(Number),
      depositedTodaySatang: studentDepositedToday.mapWith(Number),
      guardianCount: sql<number>`(
        select count(*) from guardians g where g.student_id = "students"."id"
      )`.mapWith(Number),
    })
    .from(students)
    .where(and(eq(students.classroomId, classroomId), isNull(students.archivedAt)))
    .orderBy(asc(students.number), asc(students.fullName));
}

export async function nextStudentNumber(classroomId: string) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${students.number}), 0)`.mapWith(Number) })
    .from(students)
    .where(and(eq(students.classroomId, classroomId), isNull(students.archivedAt)));
  return row.max + 1;
}

type StudentInput = { number: number; fullName: string; nickname: string | null };

export async function addStudents(teacherId: string, classroomId: string, list: StudentInput[]) {
  await getClassroom(teacherId, classroomId);
  await db.insert(students).values(list.map((s) => ({ ...s, classroomId })));
}

/** Loads a student only if it belongs to one of this teacher's classrooms. */
async function getOwnedStudent(teacherId: string, studentId: string) {
  const [row] = await db
    .select({ id: students.id, classroomId: students.classroomId })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(students.id, studentId), eq(classrooms.teacherId, teacherId)));
  return row ?? null;
}

export async function updateStudent(teacherId: string, studentId: string, data: StudentInput) {
  const owned = await getOwnedStudent(teacherId, studentId);
  if (!owned) return null;
  await db
    .update(students)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(students.id, studentId));
  return owned;
}

/**
 * Students with money history are archived (their ledger must be kept);
 * students with no transactions yet are deleted outright.
 */
export async function removeStudent(teacherId: string, studentId: string) {
  const owned = await getOwnedStudent(teacherId, studentId);
  if (!owned) return null;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(transactions)
    .where(eq(transactions.studentId, studentId));

  if (count > 0) {
    await db
      .update(students)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(students.id, studentId));
    return { ...owned, archived: true };
  }
  await db.delete(students).where(eq(students.id, studentId));
  return { ...owned, archived: false };
}

/** Whether this teacher can sign in with LINE (accounts made with email before LINE Login may not). */
export async function hasLineLogin(userId: string) {
  const [row] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "line")));
  return Boolean(row);
}

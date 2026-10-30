import "server-only";
import { randomInt } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatDateTime } from "@/lib/format";
import { bangkokParts, bangkokWeek, isDue, type Schedule } from "@/lib/schedule";
import { signedAmount } from "./dal";
import { push } from "./line";
import { getTeacherChannel } from "./line-channels";
import { balanceMessage, type StudentSummary, type WeekEntry } from "./line-messages";

const { classrooms, guardians, notificationLogs, notificationSettings, students, transactions } = schema;

// Teacher-facing functions take a teacherId and only touch that teacher's
// data. Parent-facing ones (used by the LINE webhook) are scoped to the LINE
// channel the message arrived on: a parent link only counts while the
// student's teacher still sends through that same channel.

/** Joins the student's teacher settings, requiring the guardian's channel to be the teacher's current one. */
const sameChannel = and(
  eq(notificationSettings.teacherId, classrooms.teacherId),
  eq(notificationSettings.lineChannelId, guardians.lineChannelId),
)!;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: Schedule = { enabled: false, sendWeekday: 5, sendHour: 18, lastSentOn: null };

export async function getSettings(teacherId: string): Promise<Schedule> {
  const [row] = await db.select().from(notificationSettings).where(eq(notificationSettings.teacherId, teacherId));
  return row ?? DEFAULT_SETTINGS;
}

export async function saveSettings(teacherId: string, data: { enabled: boolean; sendWeekday: number; sendHour: number }) {
  await db
    .insert(notificationSettings)
    .values({ teacherId, ...data })
    .onConflictDoUpdate({ target: notificationSettings.teacherId, set: { ...data, updatedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Link codes & parents (teacher side)
// ---------------------------------------------------------------------------

const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

async function assignCode(studentId: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await db.update(students).set({ lineLinkCode: newCode() }).where(eq(students.id, studentId));
      return;
    } catch (err) {
      // Retry only on the (rare) unique collision.
      if (!String((err as { cause?: { code?: string } })?.cause?.code ?? err).includes("23505")) throw err;
    }
  }
  throw new Error("Could not generate a unique link code");
}

async function ownsClassroom(teacherId: string, classroomId: string) {
  const [row] = await db
    .select({ id: classrooms.id })
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)));
  return Boolean(row);
}

/** Students of a class with their link code (created on first view) and linked parents. */
export async function listParentLinks(teacherId: string, classroomId: string) {
  if (!(await ownsClassroom(teacherId, classroomId))) return null;

  const missing = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.classroomId, classroomId), isNull(students.archivedAt), isNull(students.lineLinkCode)));
  for (const s of missing) await assignCode(s.id);

  const rows = await db
    .select({
      id: students.id,
      number: students.number,
      fullName: students.fullName,
      nickname: students.nickname,
      code: students.lineLinkCode,
      guardianId: guardians.id,
      guardianName: guardians.displayName,
      linkedAt: guardians.consentedAt,
    })
    .from(students)
    .leftJoin(guardians, eq(guardians.studentId, students.id))
    .where(and(eq(students.classroomId, classroomId), isNull(students.archivedAt)))
    .orderBy(asc(students.number), asc(guardians.createdAt));

  const byStudent = new Map<
    string,
    { id: string; number: number; fullName: string; nickname: string | null; code: string; guardians: { id: string; name: string | null; linkedAt: Date }[] }
  >();
  for (const r of rows) {
    const entry = byStudent.get(r.id) ?? {
      id: r.id,
      number: r.number,
      fullName: r.fullName,
      nickname: r.nickname,
      code: r.code!,
      guardians: [],
    };
    if (r.guardianId) entry.guardians.push({ id: r.guardianId, name: r.guardianName, linkedAt: r.linkedAt! });
    byStudent.set(r.id, entry);
  }
  return [...byStudent.values()];
}

export async function regenerateLinkCode(teacherId: string, studentId: string) {
  const [row] = await db
    .select({ classroomId: students.classroomId })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(students.id, studentId), eq(classrooms.teacherId, teacherId)));
  if (!row) return null;
  await assignCode(studentId);
  return row;
}

export async function removeGuardian(teacherId: string, guardianId: string) {
  const [row] = await db
    .select({ id: guardians.id, classroomId: students.classroomId })
    .from(guardians)
    .innerJoin(students, eq(students.id, guardians.studentId))
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(guardians.id, guardianId), eq(classrooms.teacherId, teacherId)));
  if (!row) return null;
  await db.delete(guardians).where(eq(guardians.id, guardianId));
  return row;
}

/** Distinct parents who would receive this teacher's notifications. */
export async function countLinkedParents(teacherId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${guardians.lineUserId})`.mapWith(Number) })
    .from(guardians)
    .innerJoin(students, eq(students.id, guardians.studentId))
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .innerJoin(notificationSettings, sameChannel)
    .where(and(eq(classrooms.teacherId, teacherId), isNull(students.archivedAt), isNull(classrooms.archivedAt)));
  return row.count;
}

export async function recentLogs(teacherId: string, limit = 10) {
  return db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.teacherId, teacherId))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Summaries & sending
// ---------------------------------------------------------------------------

/**
 * Balance plus this Bangkok week's entries for every linked (parent, child)
 * pair matching `where`. An entry cancelled within the same week is hidden
 * together with its cancellation, so parents only see what really happened.
 */
async function summaries(where: SQL) {
  const week = bangkokWeek(new Date());
  const balance = sql<number>`(
    select coalesce(sum(${signedAmount}), 0) from transactions t where t.student_id = "students"."id"
  )`.mapWith(Number);

  const rows = await db
    .select({
      lineUserId: guardians.lineUserId,
      studentId: students.id,
      fullName: students.fullName,
      nickname: students.nickname,
      classroomName: classrooms.name,
      balanceSatang: balance,
    })
    .from(guardians)
    .innerJoin(students, eq(students.id, guardians.studentId))
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .innerJoin(notificationSettings, sameChannel)
    .where(and(where, isNull(students.archivedAt), isNull(classrooms.archivedAt)))
    .orderBy(asc(classrooms.name), asc(students.number));

  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  const entries = studentIds.length
    ? await db
        .select({
          id: transactions.id,
          studentId: transactions.studentId,
          type: transactions.type,
          amountSatang: transactions.amountSatang,
          reversesId: transactions.reversesId,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .where(and(inArray(transactions.studentId, studentIds), gte(transactions.createdAt, week.start)))
        .orderBy(asc(transactions.createdAt))
    : [];
  const ids = new Set(entries.map((e) => e.id));
  const reversedIds = new Set(entries.map((e) => e.reversesId).filter(Boolean));
  const weekByStudent = new Map<string, { net: number; list: WeekEntry[] }>();
  for (const e of entries) {
    const w = weekByStudent.get(e.studentId) ?? { net: 0, list: [] };
    w.net += e.type === "deposit" ? e.amountSatang : -e.amountSatang;
    const cancelledPair = reversedIds.has(e.id) || (e.reversesId !== null && ids.has(e.reversesId));
    if (!cancelledPair) w.list.push({ createdAt: e.createdAt, type: e.type, amountSatang: e.amountSatang });
    weekByStudent.set(e.studentId, w);
  }

  const byParent = new Map<string, StudentSummary[]>();
  for (const { lineUserId, ...s } of rows) {
    const w = weekByStudent.get(s.studentId);
    const list = byParent.get(lineUserId) ?? [];
    list.push({ ...s, weekLabel: week.label, weekSatang: w?.net ?? 0, weekEntries: w?.list ?? [] });
    byParent.set(lineUserId, list);
  }
  return byParent;
}

/** Pushes a balance summary to every parent linked to this teacher's students. */
export function sendToParents(teacherId: string, kind: "scheduled" | "manual") {
  return pushSummaries(teacherId, kind, eq(classrooms.teacherId, teacherId));
}

/** Pushes one student's balance to that student's parents only (e.g. when a parent asks). */
export function sendStudentToParents(teacherId: string, studentId: string) {
  return pushSummaries(teacherId, "manual", and(eq(students.id, studentId), eq(classrooms.teacherId, teacherId))!);
}

async function pushSummaries(teacherId: string, kind: "scheduled" | "manual", where: SQL) {
  const channel = await getTeacherChannel(teacherId);
  const result = { sent: 0, failed: 0, dryRun: process.env.LINE_DRY_RUN === "1", noChannel: !channel };
  if (!channel) return result;

  const byParent = await summaries(where);
  const dateLabel = formatDateTime(new Date());
  for (const [lineUserId, list] of byParent) {
    const res = await push(channel.creds, lineUserId, [balanceMessage(list, dateLabel)]);
    const status = !res.ok ? "failed" : res.dryRun ? "dry_run" : "sent";
    if (res.ok) result.sent++;
    else result.failed++;
    await db.insert(notificationLogs).values({
      teacherId,
      lineUserId,
      studentCount: list.length,
      kind,
      status,
      error: res.ok ? null : res.error,
    });
  }
  return result;
}

/**
 * Called by the scheduler. Each due teacher is "claimed" by stamping today's
 * date first, so overlapping runs can't send twice. Teachers are processed a
 * few at a time so a run for 40 classes stays well inside the function limit.
 */
export async function runDueNotifications(now = new Date()) {
  const today = bangkokParts(now).date;
  const all = await db
    .select()
    .from(notificationSettings)
    .where(and(eq(notificationSettings.enabled, true), isNotNull(notificationSettings.lineChannelId)));
  const due = all.filter((s) => isDue(s, now));
  const report: { teacherId: string; sent: number; failed: number }[] = [];

  async function runForTeacher(teacherId: string) {
    const claimed = await db
      .update(notificationSettings)
      .set({ lastSentOn: today })
      .where(
        and(
          eq(notificationSettings.teacherId, teacherId),
          sql`${notificationSettings.lastSentOn} is distinct from ${today}`,
        ),
      )
      .returning({ teacherId: notificationSettings.teacherId });
    if (claimed.length === 0) return;

    const r = await sendToParents(teacherId, "scheduled");
    report.push({ teacherId, sent: r.sent, failed: r.failed });
  }

  for (let i = 0; i < due.length; i += 5) {
    await Promise.all(due.slice(i, i + 5).map((s) => runForTeacher(s.teacherId)));
  }
  return report;
}

// ---------------------------------------------------------------------------
// Parent side (LINE webhook)
// ---------------------------------------------------------------------------

/**
 * An active student for a link code, or null. The code only works on the LINE
 * channel the student's teacher uses, so a code sent to another OA is rejected.
 */
export async function findStudentByCode(code: string, channelRowId: string) {
  const [row] = await db
    .select({ id: students.id, fullName: students.fullName, nickname: students.nickname, classroomName: classrooms.name })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .innerJoin(
      notificationSettings,
      and(eq(notificationSettings.teacherId, classrooms.teacherId), eq(notificationSettings.lineChannelId, channelRowId)),
    )
    .where(and(eq(students.lineLinkCode, code), isNull(students.archivedAt), isNull(classrooms.archivedAt)));
  return row ?? null;
}

export async function linkGuardian(studentId: string, channelRowId: string, lineUserId: string, displayName: string | null) {
  await db
    .insert(guardians)
    .values({ studentId, lineChannelId: channelRowId, lineUserId, displayName, consentedAt: new Date() })
    .onConflictDoUpdate({
      target: [guardians.studentId, guardians.lineUserId],
      set: { lineChannelId: channelRowId, displayName, consentedAt: new Date() },
    });
}

export async function unlinkParent(lineUserId: string, channelRowId: string) {
  const rows = await db
    .delete(guardians)
    .where(and(eq(guardians.lineUserId, lineUserId), eq(guardians.lineChannelId, channelRowId)))
    .returning({ id: guardians.id });
  return rows.length;
}

/** Current balances for everything this parent is linked to on this channel (the "ยอดเงิน" command). */
export async function summariesForParent(lineUserId: string, channelRowId: string) {
  const byParent = await summaries(and(eq(guardians.lineUserId, lineUserId), eq(guardians.lineChannelId, channelRowId))!);
  return byParent.get(lineUserId) ?? [];
}

import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { classrooms, lineChannels, notificationSettings, students, transactions, user } = schema;

/** A teacher account with no activity for this long is deleted together with all of its data. */
export const INACTIVE_DAYS = 365;

/**
 * Activity = the latest of sign-up, a session refresh (login or use of the app)
 * and any money entry the teacher recorded.
 */
const lastActivity = sql`greatest(
  "user"."created_at",
  coalesce((select max(s.updated_at) from session s where s.user_id = "user"."id"), "user"."created_at"),
  coalesce((select max(t.created_at) from transactions t where t.created_by = "user"."id"), "user"."created_at")
)`;

export async function findInactiveTeachers(now = new Date()) {
  const cutoff = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`${lastActivity} < ${cutoff.toISOString()}::timestamptz`);
  return rows.map((r) => r.id);
}

/**
 * Deletes inactive teacher accounts and everything they own (classes,
 * students, ledger, linked parents, sessions). Pass dryRun to only count.
 * Ledger rows are removed explicitly first: students -> transactions is RESTRICT.
 */
export async function purgeInactiveTeachers({ dryRun = false } = {}) {
  const ids = await findInactiveTeachers();
  if (dryRun || ids.length === 0) return { dryRun, matched: ids.length, deleted: 0 };

  for (const teacherId of ids) {
    await db.transaction(async (tx) => {
      const [setting] = await tx
        .select({ channelId: notificationSettings.lineChannelId })
        .from(notificationSettings)
        .where(eq(notificationSettings.teacherId, teacherId));

      const ownStudents = tx
        .select({ id: students.id })
        .from(students)
        .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
        .where(eq(classrooms.teacherId, teacherId));
      // Reversal rows point at the entries they cancel; detach them before deleting.
      await tx.update(transactions).set({ reversesId: null }).where(inArray(transactions.studentId, ownStudents));
      await tx.delete(transactions).where(inArray(transactions.studentId, ownStudents));
      await tx.delete(user).where(eq(user.id, teacherId));

      // A LINE OA nobody sends through any more is removed too (its secrets are stored in our DB).
      if (setting?.channelId) {
        await tx
          .delete(lineChannels)
          .where(
            sql`${lineChannels.id} = ${setting.channelId} and not exists (
              select 1 from notification_settings n where n.line_channel_id = ${lineChannels.id}
            )`,
          );
      }
    });
  }
  return { dryRun, matched: ids.length, deleted: ids.length };
}

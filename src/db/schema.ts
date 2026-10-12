import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (field names follow Better Auth's default schema)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

export const classrooms = pgTable(
  "classrooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Thai Buddhist-era school year, e.g. "2569" */
    schoolYear: text("school_year").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("classrooms_teacher_id_idx").on(t.teacherId)],
);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    /** เลขที่ in the class register */
    number: integer("number").notNull(),
    fullName: text("full_name").notNull(),
    nickname: text("nickname"),
    /** 6-digit code a parent sends to the LINE Official Account to link this child. */
    lineLinkCode: text("line_link_code").unique(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("students_classroom_id_idx").on(t.classroomId)],
);

export const transactionType = pgEnum("transaction_type", ["deposit", "withdraw"]);

/**
 * Ledger. Balances are always SUM()'d from here and rows are never edited.
 * A mistake is corrected by inserting an opposite row that points to the
 * original via `reversesId`. The only deletion is the short "undo" right after
 * recording (see UNDO_WINDOW_MS), so parents never see simple typos.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    type: transactionType("type").notNull(),
    /** Stored in satang (1 baht = 100) to avoid floating-point errors */
    amountSatang: integer("amount_satang").notNull(),
    note: text("note"),
    reversesId: uuid("reverses_id").references((): AnyPgColumn => transactions.id, { onDelete: "restrict" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_student_id_created_at_idx").on(t.studentId, t.createdAt),
    // An entry can be reversed at most once.
    uniqueIndex("transactions_reverses_id_unique").on(t.reversesId),
    check("transactions_amount_positive", sql`${t.amountSatang} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Parent notifications (LINE)
// ---------------------------------------------------------------------------

/**
 * A LINE Official Account (Messaging API channel) that teachers send through.
 * Usually one per teacher; several teachers entering the same Channel ID share
 * one row (e.g. a school-wide OA). Secret and token are stored encrypted.
 */
export const lineChannels = pgTable("line_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** LINE's numeric Channel ID, as entered by the teacher (for reference). */
  channelId: text("channel_id").notNull(),
  /** The OA's own user ID from /v2/bot/info: identifies the OA, so teachers sharing one get one row. */
  botUserId: text("bot_user_id").notNull().unique(),
  channelSecretEnc: text("channel_secret_enc").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  /** A secret waiting for the webhook test to prove it, see saveLineChannel(). */
  pendingSecretEnc: text("pending_secret_enc"),
  basicId: text("basic_id"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A parent's LINE account linked to a child. One parent may link siblings. */
export const guardians = pgTable(
  "guardians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** LINE user IDs are only meaningful within the channel (provider) they came from. */
    lineChannelId: uuid("line_channel_id")
      .notNull()
      .references(() => lineChannels.id, { onDelete: "cascade" }),
    lineUserId: text("line_user_id").notNull(),
    displayName: text("display_name"),
    /** When the parent tapped "ยินยอม" (PDPA consent) in LINE. */
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("guardians_student_line_user_unique").on(t.studentId, t.lineUserId),
    index("guardians_line_user_id_idx").on(t.lineUserId),
  ],
);

export const notificationSettings = pgTable("notification_settings", {
  teacherId: text("teacher_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** The LINE OA this teacher sends through (null = not connected yet). */
  lineChannelId: uuid("line_channel_id").references(() => lineChannels.id, { onDelete: "set null" }),
  enabled: boolean("enabled").notNull().default(false),
  everyDays: integer("every_days").notNull().default(7),
  /** Hour of day in Bangkok time (0-23) to send at. */
  sendHour: integer("send_hour").notNull().default(18),
  /** Bangkok calendar date ("YYYY-MM-DD") of the last scheduled send. */
  lastSentOn: text("last_sent_on"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lineUserId: text("line_user_id").notNull(),
    studentCount: integer("student_count").notNull(),
    kind: text("kind", { enum: ["scheduled", "manual"] }).notNull(),
    /** "dry_run" = LINE isn't configured yet, nothing was actually sent. */
    status: text("status", { enum: ["sent", "failed", "dry_run"] }).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notification_logs_teacher_created_idx").on(t.teacherId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  teacher: one(user, { fields: [classrooms.teacherId], references: [user.id] }),
  students: many(students),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  classroom: one(classrooms, { fields: [students.classroomId], references: [classrooms.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  student: one(students, { fields: [transactions.studentId], references: [students.id] }),
}));

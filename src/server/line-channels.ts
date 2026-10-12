import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "./crypto";
import {
  getBotInfo,
  getWebhookEndpoint,
  setWebhookEndpoint,
  testWebhook,
  verifySignature,
  type LineCredentials,
} from "./line";

const { lineChannels, notificationSettings } = schema;

export type TeacherChannel = {
  id: string;
  channelId: string;
  basicId: string | null;
  displayName: string | null;
  creds: LineCredentials;
};

function toChannel(row: typeof lineChannels.$inferSelect): TeacherChannel {
  return {
    id: row.id,
    channelId: row.channelId,
    basicId: row.basicId,
    displayName: row.displayName,
    creds: { channelSecret: decrypt(row.channelSecretEnc), accessToken: decrypt(row.accessTokenEnc) },
  };
}

/** The LINE OA a teacher sends through, or null if they haven't connected one. */
export async function getTeacherChannel(teacherId: string): Promise<TeacherChannel | null> {
  const [row] = await db
    .select({ channel: lineChannels })
    .from(notificationSettings)
    .innerJoin(lineChannels, eq(lineChannels.id, notificationSettings.lineChannelId))
    .where(eq(notificationSettings.teacherId, teacherId));
  return row ? toChannel(row.channel) : null;
}

/**
 * Verifies a webhook request for a channel. A secret a teacher just entered
 * waits in `pendingSecretEnc` until LINE's test request proves it; when it
 * matches, it replaces the stored secret.
 */
export async function verifyChannelSignature(channelRowId: string, rawBody: string, signature: string | null) {
  const [row] = await db.select().from(lineChannels).where(eq(lineChannels.id, channelRowId));
  if (!row) return null;
  if (verifySignature(rawBody, signature, decrypt(row.channelSecretEnc))) return toChannel(row);
  if (row.pendingSecretEnc && verifySignature(rawBody, signature, decrypt(row.pendingSecretEnc))) {
    const [updated] = await db
      .update(lineChannels)
      .set({ channelSecretEnc: row.pendingSecretEnc, pendingSecretEnc: null, updatedAt: new Date() })
      .where(eq(lineChannels.id, row.id))
      .returning();
    return toChannel(updated);
  }
  return null;
}

export const webhookUrl = (baseUrl: string, channelRowId: string) => `${baseUrl}/api/line/webhook/${channelRowId}`;

type SaveResult =
  | { ok: true; displayName: string | null; basicId: string | null; webhookConfigured: boolean; webhookActive: boolean }
  | { ok: false; field?: "channelId" | "channelSecret" | "accessToken"; error: string };

/**
 * Connects a teacher to a LINE OA:
 * 1. the access token must be valid; it identifies the OA (bot user ID)
 * 2. the OA's Basic ID and name are read from LINE
 * 3. the webhook is pointed at this app and LINE sends a signed test request,
 *    which proves the Channel secret (skipped when `baseUrl` isn't public HTTPS)
 */
export async function saveLineChannel(
  teacherId: string,
  input: { channelId: string; channelSecret: string; accessToken: string },
  baseUrl: string,
): Promise<SaveResult> {
  // A valid token is enough to read the OA's identity; LINE offers no way to
  // check a long-lived token against the Channel ID, so the bot user ID is
  // what identifies the OA.
  const info = await getBotInfo(input.accessToken);
  if (!info?.userId) {
    return { ok: false, field: "accessToken", error: "Channel access token ใช้ไม่ได้ ลองกด Issue ใหม่แล้วคัดลอกมาอีกครั้ง" };
  }

  const [existing] = await db.select().from(lineChannels).where(eq(lineChannels.botUserId, info.userId));
  const secretEnc = encrypt(input.channelSecret);
  const fields = {
    channelId: input.channelId,
    accessTokenEnc: encrypt(input.accessToken),
    basicId: info.basicId ?? null,
    displayName: info.displayName ?? null,
    updatedAt: new Date(),
  };
  const row = existing
    ? (
        await db
          .update(lineChannels)
          // A shared channel keeps its proven secret until the new one passes the test.
          .set({ ...fields, pendingSecretEnc: secretEnc })
          .where(eq(lineChannels.id, existing.id))
          .returning()
      )[0]
    : (await db.insert(lineChannels).values({ botUserId: info.userId, channelSecretEnc: secretEnc, ...fields }).returning())[0];

  let webhookConfigured = false;
  let webhookActive = false;
  if (baseUrl.startsWith("https://")) {
    const endpoint = webhookUrl(baseUrl, row.id);
    const set = await setWebhookEndpoint(input.accessToken, endpoint);
    if (!set.ok) {
      if (!existing) await db.delete(lineChannels).where(eq(lineChannels.id, row.id));
      return { ok: false, error: `ตั้งค่า Webhook ไม่สำเร็จ (${set.error})` };
    }
    const test = await testWebhook(input.accessToken, endpoint);
    if (!test.success) {
      if (existing) {
        await db.update(lineChannels).set({ pendingSecretEnc: null }).where(eq(lineChannels.id, row.id));
      } else {
        await db.delete(lineChannels).where(eq(lineChannels.id, row.id));
      }
      return test.statusCode === 401
        ? { ok: false, field: "channelSecret", error: "Channel secret ไม่ถูกต้อง" }
        : { ok: false, error: `LINE ทดสอบ Webhook ไม่ผ่าน (${test.statusCode || test.reason})` };
    }
    webhookConfigured = true;
    // The test passed: either the new secret was promoted, or the stored one
    // was already right and the pending value is a duplicate or a typo.
    await db.update(lineChannels).set({ pendingSecretEnc: null }).where(eq(lineChannels.id, row.id));
    webhookActive = Boolean((await getWebhookEndpoint(input.accessToken))?.active);
  }

  await db
    .insert(notificationSettings)
    .values({ teacherId, lineChannelId: row.id })
    .onConflictDoUpdate({ target: notificationSettings.teacherId, set: { lineChannelId: row.id, updatedAt: new Date() } });

  return { ok: true, displayName: row.displayName, basicId: row.basicId, webhookConfigured, webhookActive };
}

/** Stops using LINE for this teacher. Parent links are kept in case they reconnect. */
export async function disconnectLineChannel(teacherId: string) {
  await db
    .update(notificationSettings)
    .set({ lineChannelId: null, enabled: false, updatedAt: new Date() })
    .where(eq(notificationSettings.teacherId, teacherId));
}

/** Points the teacher's OA webhook back at this app (e.g. after someone changed it in LINE). */
export async function repairWebhook(teacherId: string, baseUrl: string) {
  const channel = await getTeacherChannel(teacherId);
  if (!channel) return { ok: false as const, error: "ยังไม่ได้เชื่อม LINE Official Account" };
  const endpoint = webhookUrl(baseUrl, channel.id);
  const set = await setWebhookEndpoint(channel.creds.accessToken, endpoint);
  if (!set.ok) return { ok: false as const, error: `ตั้งค่า Webhook ไม่สำเร็จ (${set.error})` };
  const test = await testWebhook(channel.creds.accessToken, endpoint);
  if (!test.success) return { ok: false as const, error: `LINE ทดสอบ Webhook ไม่ผ่าน (${test.statusCode || test.reason})` };
  return { ok: true as const };
}

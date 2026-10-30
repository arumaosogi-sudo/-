"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { SEND_HOURS, WEEKDAYS } from "@/lib/schedule";
import type { ActionResult } from "@/lib/validation";
import { requireUser } from "@/server/dal";
import { disconnectLineChannel, repairWebhook, saveLineChannel } from "@/server/line-channels";
import { countLinkedParents, saveSettings, sendToParents } from "@/server/notify";

const settingsSchema = z.object({
  enabled: z.literal("on").optional().transform(Boolean),
  sendWeekday: z.coerce.number().refine((d) => WEEKDAYS.some((w) => w.day === d), "เลือกวันไม่ถูกต้อง"),
  sendHour: z.coerce.number().refine((h) => SEND_HOURS.includes(h), "เลือกเวลาไม่ถูกต้อง"),
});

export async function saveNotificationSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  await saveSettings(user.id, parsed.data);
  revalidatePath("/settings");
  return { ok: true, message: parsed.data.enabled ? "บันทึกแล้ว ระบบจะแจ้งผู้ปกครองตามรอบที่ตั้งไว้" : "บันทึกแล้ว (ปิดการแจ้งเตือนอยู่)" };
}

/** Sends a summary to every linked parent right now, without changing the schedule. */
export async function sendNowAction(): Promise<ActionResult> {
  const user = await requireUser();
  if ((await countLinkedParents(user.id)) === 0) {
    return { ok: false, error: "ยังไม่มีผู้ปกครองเชื่อมต่อ LINE" };
  }
  const result = await sendToParents(user.id, "manual");
  revalidatePath("/settings");
  if (result.noChannel) return { ok: false, error: "ยังไม่ได้เชื่อม LINE Official Account ของคุณ" };

  if (result.dryRun) return { ok: true, message: `โหมดทดลอง: จำลองการส่งถึงผู้ปกครอง ${result.sent} คน (LINE_DRY_RUN)` };
  if (result.failed) return { ok: false, error: `ส่งสำเร็จ ${result.sent} คน ไม่สำเร็จ ${result.failed} คน` };
  return { ok: true, message: `ส่งถึงผู้ปกครอง ${result.sent} คนแล้ว` };
}

// ---------------------------------------------------------------------------
// LINE Official Account connection
// ---------------------------------------------------------------------------

const lineChannelSchema = z.object({
  channelId: z.string().trim().regex(/^\d{6,12}$/, "Channel ID ต้องเป็นตัวเลขเท่านั้น"),
  channelSecret: z.string().trim().regex(/^[0-9a-f]{32}$/i, "Channel secret ต้องเป็นตัวอักษร 32 ตัว (0-9, a-f)"),
  accessToken: z.string().trim().min(100, "Channel access token สั้นเกินไป ตรวจสอบว่าคัดลอกมาครบ"),
});

/** The public base URL of this request, used for the webhook address. */
async function requestBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function saveLineChannelAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const values = Object.fromEntries([...formData].map(([k, v]) => [k, String(v)]));
  const parsed = lineChannelSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "กรุณาตรวจสอบข้อมูลอีกครั้ง", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const result = await saveLineChannel(user.id, parsed.data, await requestBaseUrl());
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      fieldErrors: result.field ? { [result.field]: [result.error] } : undefined,
      values,
    };
  }
  revalidatePath("/settings");
  revalidatePath("/classes", "layout");
  const name = result.displayName ? `"${result.displayName}"` : "LINE Official Account";
  return {
    ok: true,
    message: result.webhookConfigured
      ? result.webhookActive
        ? `เชื่อมต่อ ${name} สำเร็จ ตั้งค่า Webhook ให้แล้ว`
        : `เชื่อมต่อ ${name} แล้ว แต่ต้องเปิด "Use webhook" ใน LINE Developers ก่อน (ดูวิธีในหน้านี้)`
      : `บันทึก ${name} แล้ว (ยังไม่ได้ตั้ง Webhook เพราะไม่ได้เปิดผ่าน https)`,
  };
}

export async function disconnectLineChannelAction(): Promise<ActionResult> {
  const user = await requireUser();
  await disconnectLineChannel(user.id);
  revalidatePath("/settings");
  revalidatePath("/classes", "layout");
  return { ok: true, message: "ยกเลิกการเชื่อมต่อ LINE แล้ว และปิดการแจ้งเตือนอัตโนมัติ" };
}

export async function repairWebhookAction(): Promise<ActionResult> {
  const user = await requireUser();
  const result = await repairWebhook(user.id, await requestBaseUrl());
  if (!result.ok) return result;
  revalidatePath("/settings");
  return { ok: true, message: "ตั้งค่า Webhook ใหม่แล้ว และ LINE ทดสอบผ่าน" };
}

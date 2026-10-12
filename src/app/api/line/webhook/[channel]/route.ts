import { NextResponse } from "next/server";
import { formatDateTime } from "@/lib/format";
import { idSchema } from "@/lib/validation";
import { getDisplayName, reply, type LineMessage } from "@/server/line";
import { verifyChannelSignature, type TeacherChannel } from "@/server/line-channels";
import { balanceMessage, HELP_TEXT, linkConfirmMessage, text, withQuickReplies } from "@/server/line-messages";
import { findStudentByCode, linkGuardian, summariesForParent, unlinkParent } from "@/server/notify";

// One webhook per LINE Official Account: https://<domain>/api/line/webhook/<channel row id>.
// The app sets this URL in LINE automatically when a teacher saves their keys.

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
  postback?: { data: string };
};

export async function POST(request: Request, { params }: RouteContext<"/api/line/webhook/[channel]">) {
  const { channel: channelRowId } = await params;
  if (!idSchema.safeParse(channelRowId).success) {
    return NextResponse.json({ error: "unknown channel" }, { status: 404 });
  }
  const raw = await request.text();
  const channel = await verifyChannelSignature(channelRowId, raw, request.headers.get("x-line-signature"));
  if (!channel) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const { events = [] } = JSON.parse(raw) as { events?: LineEvent[] };
  for (const event of events) {
    try {
      await handle(channel, event);
    } catch (err) {
      // Never fail the whole webhook (LINE would retry every event).
      console.error("[LINE webhook]", err);
    }
  }
  return NextResponse.json({ ok: true });
}

async function handle(channel: TeacherChannel, event: LineEvent) {
  const userId = event.source?.type === "user" ? event.source.userId : undefined;
  if (!userId) return; // Group chats aren't supported.

  if (event.type === "unfollow") {
    await unlinkParent(userId, channel.id);
    return;
  }

  const token = event.replyToken;
  if (!token) return;
  const answer = (...messages: LineMessage[]) => reply(channel.creds, token, withQuickReplies(messages));

  if (event.type === "follow") {
    await answer(text(`สวัสดีค่ะ 👋 ยินดีต้อนรับสู่กระปุกห้องเรียน\n\n${HELP_TEXT}`));
    return;
  }

  if (event.type === "postback" && event.postback?.data.startsWith("link:")) {
    const code = event.postback.data.slice("link:".length);
    const student = await findStudentByCode(code, channel.id);
    if (!student) {
      await answer(text("รหัสนี้ใช้ไม่ได้แล้ว กรุณาขอรหัสใหม่จากคุณครู"));
      return;
    }
    await linkGuardian(student.id, channel.id, userId, await getDisplayName(channel.creds, userId));
    const list = await summariesForParent(userId, channel.id);
    const current = list.filter((s) => s.studentId === student.id);
    await answer(
      text(`เชื่อมต่อสำเร็จ ✅ ท่านจะได้รับแจ้งยอดเงินออมของ ${student.fullName} ตามรอบที่คุณครูตั้งไว้`),
      ...(current.length ? [balanceMessage(current, formatDateTime(new Date()))] : []),
    );
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") return;
  const input = (event.message.text ?? "").trim();

  if (/^\d{6}$/.test(input)) {
    const student = await findStudentByCode(input, channel.id);
    await answer(
      student
        ? linkConfirmMessage(input, student)
        : text("ไม่พบรหัสนี้ กรุณาตรวจสอบรหัส 6 หลักจากคุณครูอีกครั้ง"),
    );
    return;
  }

  if (/^(ยอด|ยอดเงิน|เช็คยอด|เช็กยอด|ประวัติ|สัปดาห์นี้|balance)$/i.test(input)) {
    const list = await summariesForParent(userId, channel.id);
    await answer(
      list.length
        ? balanceMessage(list, formatDateTime(new Date()))
        : text(`ยังไม่ได้เชื่อมต่อกับนักเรียน\n\n${HELP_TEXT}`),
    );
    return;
  }

  if (/^(ยกเลิก|หยุด|stop)$/i.test(input)) {
    const removed = await unlinkParent(userId, channel.id);
    await answer(
      text(removed ? "หยุดการแจ้งเตือนแล้ว หากต้องการรับอีกครั้ง พิมพ์รหัส 6 หลักจากคุณครูได้เลย" : "ท่านยังไม่ได้รับการแจ้งเตือนอยู่แล้ว"),
    );
    return;
  }

  if (/^(วิธีใช้|ช่วยเหลือ|วิธีเชื่อมต่อ|help)$/i.test(input)) {
    await answer(text(HELP_TEXT));
    return;
  }

  if (input === "ไม่ใช่") {
    await answer(text("ยกเลิกแล้ว หากรหัสไม่ถูกต้อง กรุณาสอบถามคุณครูอีกครั้ง"));
    return;
  }

  await answer(text(HELP_TEXT));
}

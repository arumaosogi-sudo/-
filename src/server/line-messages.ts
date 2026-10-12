import "server-only";
import { formatBaht } from "@/lib/format";
import type { LineMessage } from "./line";

// Message content sent to parents. Colors match the app's mint-green brand.

const BRAND = "#2f9e7a";
const DEPOSIT = "#1f8a5b";
const WITHDRAW = "#d9771a";
const MUTED = "#8a8f8d";

export type WeekEntry = { createdAt: Date; type: "deposit" | "withdraw"; amountSatang: number };

export type StudentSummary = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  classroomName: string;
  balanceSatang: number;
  /** This Bangkok week (Monday–Sunday): label, net change and entries (oldest first). */
  weekLabel: string;
  weekSatang: number;
  weekEntries: WeekEntry[];
};

const childName = (s: { fullName: string; nickname: string | null }) =>
  s.nickname ? `น้อง${s.nickname}` : s.fullName;

const entryTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const signedBaht = (satang: number) => `${satang >= 0 ? "+" : "−"}${formatBaht(Math.abs(satang))}`;

/** Shows at most this many entries per child; older ones are summarised in one line. */
const MAX_ENTRIES = 8;

function weekRows(s: StudentSummary) {
  if (s.weekEntries.length === 0) {
    return [{ type: "text", text: "ยังไม่มีรายการในสัปดาห์นี้", size: "sm", color: MUTED, margin: "sm" }];
  }
  const newestFirst = [...s.weekEntries].reverse();
  const shown = newestFirst.slice(0, MAX_ENTRIES);
  const rows: Record<string, unknown>[] = shown.map((e) => {
    const amount = e.type === "deposit" ? e.amountSatang : -e.amountSatang;
    return {
      type: "box",
      layout: "horizontal",
      margin: "sm",
      contents: [
        { type: "text", text: entryTime.format(e.createdAt), size: "xs", color: MUTED, flex: 5 },
        { type: "text", text: e.type === "deposit" ? "ฝาก" : "ถอน", size: "xs", flex: 2 },
        {
          type: "text",
          text: signedBaht(amount),
          size: "xs",
          weight: "bold",
          align: "end",
          flex: 3,
          color: amount >= 0 ? DEPOSIT : WITHDRAW,
        },
      ],
    };
  });
  if (newestFirst.length > MAX_ENTRIES) {
    rows.push({ type: "text", text: `และอีก ${newestFirst.length - MAX_ENTRIES} รายการก่อนหน้า`, size: "xxs", color: MUTED, margin: "sm" });
  }
  return rows;
}

function summaryBubble(s: StudentSummary, dateLabel: string) {
  const week = s.weekSatang;
  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: BRAND,
      paddingAll: "16px",
      contents: [
        { type: "text", text: "กระปุกห้องเรียน", color: "#ffffffcc", size: "xs" },
        { type: "text", text: s.classroomName, color: "#ffffff", weight: "bold", size: "md" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: s.fullName, weight: "bold", size: "md", wrap: true },
        ...(s.nickname ? [{ type: "text", text: `(${s.nickname})`, size: "sm", color: MUTED }] : []),
        { type: "text", text: "เงินออมคงเหลือ", size: "sm", color: MUTED, margin: "lg" },
        { type: "text", text: `${formatBaht(s.balanceSatang)} บาท`, size: "xxl", weight: "bold", color: DEPOSIT },
        { type: "separator", margin: "lg" },
        { type: "text", text: `สัปดาห์นี้ (${s.weekLabel})`, size: "sm", weight: "bold", margin: "lg" },
        ...weekRows(s),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            { type: "text", text: "รวมสัปดาห์นี้", size: "sm", color: MUTED, flex: 3 },
            {
              type: "text",
              text: `${signedBaht(week)} บาท`,
              size: "sm",
              weight: "bold",
              align: "end",
              flex: 2,
              color: week > 0 ? DEPOSIT : week < 0 ? WITHDRAW : MUTED,
            },
          ],
        },
        { type: "text", text: `ข้อมูล ณ ${dateLabel} · เริ่มนับใหม่ทุกวันจันทร์`, size: "xxs", color: MUTED, margin: "md", wrap: true },
      ],
    },
  };
}

/** One push per parent: a single bubble, or a carousel for siblings. */
export function balanceMessage(students: StudentSummary[], dateLabel: string): LineMessage {
  const bubbles = students.slice(0, 12).map((s) => summaryBubble(s, dateLabel));
  const altText = students.map((s) => `${childName(s)} มีเงินออม ${formatBaht(s.balanceSatang)} บาท`).join(", ");
  return {
    type: "flex",
    altText: altText.slice(0, 400),
    contents: bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles },
  };
}

export const text = (message: string): LineMessage => ({ type: "text", text: message });

export const HELP_TEXT =
  "วิธีดูเงินออมของบุตรหลาน\n" +
  "1. ขอรหัส 6 หลักของนักเรียนจากคุณครู\n" +
  "2. พิมพ์รหัสนั้นส่งมาในแชตนี้\n" +
  "3. กด \"ยินยอม\" เพื่อยืนยัน\n\n" +
  "จากนั้นกดปุ่ม \"ยอดเงิน\" ด้านล่างได้ตลอดเวลา จะเห็นยอดคงเหลือและรายการฝาก-ถอนของสัปดาห์นี้\n" +
  "มีลูกหลายคน: ส่งรหัสของแต่ละคนได้เลย\n" +
  "พิมพ์ \"ยกเลิก\" เพื่อหยุดรับการแจ้งเตือน";

/** Shortcut buttons shown under a reply, so parents don't have to type commands. */
export function withQuickReplies(messages: LineMessage[]): LineMessage[] {
  if (messages.length === 0) return messages;
  const quickReply = {
    items: [
      { type: "action", action: { type: "message", label: "💰 ยอดเงิน", text: "ยอดเงิน" } },
      { type: "action", action: { type: "message", label: "❓ วิธีใช้", text: "วิธีใช้" } },
    ],
  };
  return [...messages.slice(0, -1), { ...messages[messages.length - 1], quickReply }];
}

/** Asks the parent to confirm the child and give PDPA consent before linking. */
export function linkConfirmMessage(code: string, student: { fullName: string; nickname: string | null; classroomName: string }): LineMessage {
  const who = `${student.fullName}${student.nickname ? ` (${student.nickname})` : ""}`;
  return {
    type: "template",
    altText: `ยืนยันรับแจ้งยอดเงินออมของ ${who}`,
    template: {
      type: "confirm",
      text: `รับแจ้งยอดเงินออมของ ${who} ห้อง ${student.classroomName}?\nระบบจะใช้บัญชี LINE ของท่านเพื่อส่งยอดเงินออมเท่านั้น`.slice(0, 240),
      actions: [
        { type: "postback", label: "ยินยอม", data: `link:${code}`, displayText: "ยินยอม" },
        { type: "message", label: "ไม่ใช่", text: "ไม่ใช่" },
      ],
    },
  };
}

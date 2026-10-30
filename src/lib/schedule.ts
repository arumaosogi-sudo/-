/** Days a teacher can pick for the weekly send (ISO numbering, Monday = 1). */
export const WEEKDAYS = [
  { day: 1, label: "วันจันทร์" },
  { day: 2, label: "วันอังคาร" },
  { day: 3, label: "วันพุธ" },
  { day: 4, label: "วันพฤหัสบดี" },
  { day: 5, label: "วันศุกร์" },
  { day: 6, label: "วันเสาร์" },
  { day: 7, label: "วันอาทิตย์" },
] as const;

/** Hours a teacher can pick (the scheduler runs once an hour). */
export const SEND_HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00–21:00

/** Free LINE OA plan quota per month (check LINE's current pricing). */
export const FREE_MONTHLY_MESSAGES = 300;

export type Schedule = {
  enabled: boolean;
  sendWeekday: number;
  sendHour: number;
  lastSentOn: string | null;
};

/** Bangkok wall-clock parts for an instant. */
export function bangkokParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** ISO weekday (Monday = 1 … Sunday = 7) of a "YYYY-MM-DD" date. */
function isoWeekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}

/**
 * Due on the chosen weekday once the chosen hour has passed, if nothing was
 * sent yet today. A late hourly run still sends later that day; a whole missed
 * day is skipped rather than sent on the wrong day.
 */
export function isDue(s: Schedule, now: Date) {
  if (!s.enabled) return false;
  const { date, hour } = bangkokParts(now);
  return isoWeekday(date) === s.sendWeekday && hour >= s.sendHour && s.lastSentOn !== date;
}

/** Bangkok date + hour of the next scheduled send, or null when disabled. */
export function nextSend(s: Schedule, now: Date): { date: string; hour: number } | null {
  if (!s.enabled) return null;
  const { date, hour } = bangkokParts(now);
  if (isoWeekday(date) === s.sendWeekday && s.lastSentOn !== date) {
    // Today is the day: at the chosen hour if it's still ahead, otherwise on the next hourly run.
    if (hour < s.sendHour) return { date, hour: s.sendHour };
    if (hour < 23) return { date, hour: hour + 1 };
  }
  const ahead = (s.sendWeekday - isoWeekday(date) + 7) % 7 || 7;
  return { date: addDays(date, ahead), hour: s.sendHour };
}

/** Rough monthly message usage: one push per linked parent per weekly send. */
export function estimateMonthlyMessages(parentCount: number) {
  return Math.ceil((30 / 7) * parentCount);
}

/**
 * The Bangkok calendar week (Monday–Sunday) containing `now`: its first
 * instant and a Thai label such as "28 ก.ย. – 4 ต.ค.". Parents see entries
 * from this week; the list starts over every Monday.
 */
export function bangkokWeek(now: Date) {
  const { date } = bangkokParts(now);
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(date, -weekday);
  const sunday = addDays(monday, 6);
  const fmt = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
  const at = (d: string) => new Date(`${d}T12:00:00+07:00`);
  return {
    start: new Date(`${monday}T00:00:00+07:00`),
    label: `${fmt.format(at(monday))} – ${fmt.format(at(sunday))}`,
  };
}

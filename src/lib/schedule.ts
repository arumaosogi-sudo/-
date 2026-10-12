/** Frequency choices shown in Settings, in days. */
export const FREQUENCY_OPTIONS = [
  { days: 1, label: "ทุกวัน" },
  { days: 2, label: "ทุก 2 วัน" },
  { days: 3, label: "ทุก 3 วัน" },
  { days: 7, label: "ทุกสัปดาห์" },
  { days: 14, label: "ทุก 2 สัปดาห์" },
  { days: 30, label: "ทุกเดือน (30 วัน)" },
] as const;

/** Hours a teacher can pick (the scheduler runs once an hour). */
export const SEND_HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00–21:00

/** Free LINE OA plan quota per month (check LINE's current pricing). */
export const FREE_MONTHLY_MESSAGES = 300;

export type Schedule = {
  enabled: boolean;
  everyDays: number;
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

/** Whole days from date a to date b ("YYYY-MM-DD"). */
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Due when it's past the chosen hour today and at least `everyDays` days have
 * passed since the last send. A missed hourly run still sends later that day.
 */
export function isDue(s: Schedule, now: Date) {
  if (!s.enabled) return false;
  const { date, hour } = bangkokParts(now);
  if (hour < s.sendHour) return false;
  return s.lastSentOn === null || daysBetween(s.lastSentOn, date) >= s.everyDays;
}

/** Bangkok date + hour of the next scheduled send, or null when disabled. */
export function nextSend(s: Schedule, now: Date): { date: string; hour: number } | null {
  if (!s.enabled) return null;
  const { date, hour } = bangkokParts(now);
  const earliest = s.lastSentOn ? addDays(s.lastSentOn, s.everyDays) : date;
  if (daysBetween(date, earliest) > 0) return { date: earliest, hour: s.sendHour };
  // Due today: at the chosen hour if it's still ahead, otherwise on the next hourly run.
  return { date, hour: hour < s.sendHour ? s.sendHour : Math.min(hour + 1, 23) };
}

/** Rough monthly message usage: one push per linked parent per send. */
export function estimateMonthlyMessages(parentCount: number, everyDays: number) {
  return Math.ceil((30 / everyDays) * parentCount);
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

const wholeBaht = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const bahtWithSatang = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 125000 satang → "1,250", 125050 → "1,250.50" */
export function formatBaht(satang: number) {
  return (satang % 100 === 0 ? wholeBaht : bahtWithSatang).format(satang / 100);
}

/**
 * Thai school years start in May and use the Buddhist era, so September 2026
 * and March 2027 both belong to school year 2569.
 */
export function currentSchoolYear(now = new Date()) {
  const bangkok = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const year = bangkok.getFullYear() + 543;
  return String(bangkok.getMonth() < 4 ? year - 1 : year);
}

const TZ = "Asia/Bangkok";

const dateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormatter = new Intl.DateTimeFormat("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const monthFormatter = new Intl.DateTimeFormat("th-TH", { timeZone: TZ, month: "long", year: "numeric" });

/** "27 ก.ย. 69 14:05" */
export const formatDateTime = (d: Date) => dateTimeFormatter.format(d);
/** "ส. 27 ก.ย." */
export const formatDay = (d: Date) => dayFormatter.format(d);
/** "14:05" */
export const formatTime = (d: Date) => timeFormatter.format(d);

/** "2026-09" → "กันยายน 2569" */
export function formatMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return monthFormatter.format(new Date(Date.UTC(y, m - 1, 15)));
}

/** Calendar date in Bangkok as "YYYY-MM-DD", used to group entries by day. */
export function bangkokDateKey(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Preset buttons for quick deposits, in baht. */
export const QUICK_AMOUNTS = [5, 10, 20, 50, 100] as const;

/** Largest single entry: 100,000 baht. */
const MAX_AMOUNT_SATANG = 100_000 * 100;

/** How long after recording a teacher can undo (delete) an entry. */
export const UNDO_WINDOW_MS = 2 * 60 * 1000;

/**
 * Parses a baht amount typed by a teacher into satang, or null if invalid.
 * Accepts "20", "12.5", "12.50", "1,250.75". At most 2 decimal places.
 * Works on the string so 0.1 + 0.2 style float errors can't creep in.
 */
export function parseBahtToSatang(input: string): number | null {
  const text = input.replace(/[,\s฿]/g, "");
  const match = text.match(/^(\d{1,7})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const satang = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return satang > 0 && satang <= MAX_AMOUNT_SATANG ? satang : null;
}

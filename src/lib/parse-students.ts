export type ParsedStudent = { number: number; fullName: string; nickname: string | null };

/**
 * Parses a pasted student list, one student per line. Accepts:
 *   "สมชาย ใจดี"                    → auto-numbered
 *   "3. สมชาย ใจดี (ต้น)"            → number + nickname in parentheses
 *   "3<TAB>สมชาย ใจดี<TAB>ต้น"        → columns copied from Excel / Sheets
 * Students without a number continue from the highest number seen so far.
 */
export function parseStudentList(text: string, startAfter = 0): ParsedStudent[] {
  const result: ParsedStudent[] = [];
  let next = startAfter;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let number: number | null = null;
    let fullName: string;
    let nickname: string | null = null;

    if (line.includes("\t")) {
      const cols = line.split("\t").map((c) => c.trim()).filter(Boolean);
      if (cols.length && /^\d+$/.test(cols[0])) number = Number(cols.shift());
      fullName = cols[0] ?? "";
      nickname = cols[1] ?? null;
    } else {
      const numbered = line.match(/^(\d+)[.)\s]+(.*)$/);
      if (numbered) {
        number = Number(numbered[1]);
        fullName = numbered[2].trim();
      } else {
        fullName = line;
      }
      const nick = fullName.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (nick) {
        fullName = nick[1].trim();
        nickname = nick[2].trim();
      }
    }

    if (!fullName) continue;
    if (number === null) number = next + 1;
    next = Math.max(next, number);
    result.push({ number, fullName, nickname: nickname || null });
  }

  return result;
}

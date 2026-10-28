import { NextResponse } from "next/server";
import { rejectUnlessCron } from "@/server/cron-auth";
import { purgeInactiveTeachers } from "@/server/retention";

// Weekly Vercel Cron: deletes teacher accounts inactive for a year (see
// src/server/retention.ts). Add ?dryRun=1 to only count what would be deleted.

async function handler(request: Request) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  return NextResponse.json({ ok: true, ...(await purgeInactiveTeachers({ dryRun })) });
}

export { handler as GET, handler as POST };

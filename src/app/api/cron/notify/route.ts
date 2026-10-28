import { NextResponse } from "next/server";
import { rejectUnlessCron } from "@/server/cron-auth";
import { runDueNotifications } from "@/server/notify";

// Called once an hour by a scheduler (Upstash QStash, cron-job.org, GitHub
// Actions, ...) with header `Authorization: Bearer <CRON_SECRET>`.
// With QStash, send it as `Upstash-Forward-Authorization: Bearer <CRON_SECRET>`.

async function handler(request: Request) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  const report = await runDueNotifications();
  return NextResponse.json({ ok: true, teachers: report });
}

export { handler as GET, handler as POST };

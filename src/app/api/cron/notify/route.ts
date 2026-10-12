import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDueNotifications } from "@/server/notify";

// Called once an hour by a scheduler (Upstash QStash, cron-job.org, GitHub
// Actions, ...) with header `Authorization: Bearer <CRON_SECRET>`.
// With QStash, send it as `Upstash-Forward-Authorization: Bearer <CRON_SECRET>`.

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handler(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await runDueNotifications();
  return NextResponse.json({ ok: true, teachers: report });
}

export { handler as GET, handler as POST };

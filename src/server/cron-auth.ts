import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Returns an error response unless the request carries `Authorization: Bearer <CRON_SECRET>`. */
export function rejectUnlessCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

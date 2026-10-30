import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { formatDateTime, formatDay } from "@/lib/format";
import { estimateMonthlyMessages, FREE_MONTHLY_MESSAGES, nextSend } from "@/lib/schedule";
import { lineLoginEnabled } from "@/lib/auth";
import { hasLineLogin, requireUser } from "@/server/dal";
import { getTeacherChannel } from "@/server/line-channels";
import { countLinkedParents, getSettings, recentLogs } from "@/server/notify";
import { InstallApp } from "./install-app";
import { LinkLineLoginButton } from "./line-connect-form";
import { LineSection } from "./line-section";
import { NotificationForm, SendNowButton } from "./notification-form";
import { SignOutButton } from "./sign-out-button";
import { ThemeSwitcher } from "./theme-switcher";

export const metadata: Metadata = { title: "ตั้งค่า" };

const statusLabel = { sent: "ส่งแล้ว", failed: "ไม่สำเร็จ", dry_run: "โหมดทดลอง" } as const;

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, parentCount, logs, channel, lineLogin] = await Promise.all([
    getSettings(user.id),
    countLinkedParents(user.id),
    recentLogs(user.id, 8),
    getTeacherChannel(user.id),
    hasLineLogin(user.id),
  ]);
  const internalEmail = user.email.endsWith("@line.local");
  const next = nextSend(settings, new Date());
  const estimate = estimateMonthlyMessages(parentCount);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">ตั้งค่า</h1>

      <section className="grid gap-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">บัญชีที่เข้าสู่ระบบอยู่</h2>
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-secondary-foreground">
            {user.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {lineLogin ? "เข้าสู่ระบบด้วย LINE" : user.email}
              {lineLogin && !internalEmail && ` · ${user.email}`}
            </p>
          </div>
        </div>
        {!lineLogin && lineLoginEnabled && (
          <div className="grid gap-2 rounded-lg border border-withdraw/30 bg-withdraw-soft p-3 text-sm">
            <p>บัญชีนี้สร้างด้วยอีเมล กดเชื่อมบัญชี LINE ครั้งเดียว แล้วครั้งต่อไปเข้าสู่ระบบด้วย LINE ได้เลย ข้อมูลเดิมอยู่ครบ</p>
            <LinkLineLoginButton />
          </div>
        )}
        <SignOutButton />
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">โหมดการแสดงผล</h2>
        <ThemeSwitcher />
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">ติดตั้งแอปบนมือถือ</h2>
        <InstallApp />
      </section>

      <LineSection channel={channel} />

      <section className="grid gap-5 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">แจ้งเตือนผู้ปกครองทาง LINE</h2>
          <p className="text-sm text-muted-foreground">ส่งยอดเงินออมของนักเรียนให้ผู้ปกครองที่เชื่อมต่อ LINE ไว้แล้ว</p>
        </div>

        {!channel && (
          <p className="flex items-start gap-2 rounded-lg border border-withdraw/30 bg-withdraw-soft px-3 py-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-withdraw" aria-hidden />
            <span>เชื่อม LINE Official Account ของคุณด้านบนก่อน จึงจะส่งข้อความถึงผู้ปกครองได้</span>
          </p>
        )}

        <NotificationForm settings={settings} />

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/60 p-3">
            <dt className="text-muted-foreground">ผู้ปกครองที่เชื่อมต่อแล้ว</dt>
            <dd className="mt-1 text-lg font-semibold">{parentCount} คน</dd>
          </div>
          <div className="rounded-lg bg-muted/60 p-3">
            <dt className="text-muted-foreground">ส่งครั้งถัดไป</dt>
            <dd className="mt-1 text-lg font-semibold">
              {next ? `${formatDay(new Date(`${next.date}T12:00:00+07:00`))} ${String(next.hour).padStart(2, "0")}:00` : "ปิดอยู่"}
            </dd>
          </div>
          <div className="col-span-2 rounded-lg bg-muted/60 p-3">
            <dt className="text-muted-foreground">ประมาณการข้อความต่อเดือน</dt>
            <dd className="mt-1">
              <span className={estimate > FREE_MONTHLY_MESSAGES ? "font-semibold text-withdraw" : "font-semibold"}>
                ~{estimate} ข้อความ
              </span>{" "}
              <span className="text-muted-foreground">
                (แพ็กเกจฟรีของ LINE OA ประมาณ {FREE_MONTHLY_MESSAGES} ข้อความ/เดือน
                {estimate > FREE_MONTHLY_MESSAGES && " · ลองลดความถี่เพื่อไม่ให้เกินโควตา"})
              </span>
            </dd>
          </div>
        </dl>

        <p className="text-sm text-muted-foreground">
          ให้ผู้ปกครองเชื่อมต่อได้จากหน้าห้องเรียน → ปุ่ม <strong>ผู้ปกครอง (LINE)</strong>{" "}
          <Link href="/classes" className="underline underline-offset-2">
            ไปที่ห้องเรียน
          </Link>
          {" "}· ผู้ปกครองพิมพ์ “ยอดเงิน” ใน LINE เพื่อดูยอดล่าสุดได้ตลอดเวลาโดยไม่เสียโควตา
        </p>

        <SendNowButton parentCount={parentCount} />

        {logs.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">การส่งล่าสุด</h3>
            <ul className="divide-y rounded-lg border text-sm">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-muted-foreground">
                    {formatDateTime(log.createdAt)} · {log.kind === "manual" ? "ส่งเอง" : "อัตโนมัติ"} · นักเรียน {log.studentCount} คน
                  </span>
                  <span
                    className={
                      log.status === "sent" ? "text-deposit" : log.status === "failed" ? "text-destructive" : "text-muted-foreground"
                    }
                    title={log.error ?? undefined}
                  >
                    {statusLabel[log.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

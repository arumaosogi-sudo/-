import { headers } from "next/headers";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { getWebhookEndpoint } from "@/server/line";
import { webhookUrl, type TeacherChannel } from "@/server/line-channels";
import { DisconnectLineButton, LineConnectForm, RepairWebhookButton } from "./line-connect-form";

/** "LINE Official Account ของฉัน": connect status, key form and setup guide. */
export async function LineSection({ channel }: { channel: TeacherChannel | null }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const expectedWebhook = channel ? webhookUrl(`${proto}://${host}`, channel.id) : "";
  // Live from LINE, so a switched-off or redirected webhook is visible right here.
  const webhook = channel && proto === "https" ? await getWebhookEndpoint(channel.creds.accessToken) : null;

  return (
    <section id="line" className="grid scroll-mt-20 gap-5 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">LINE Official Account ของฉัน</h2>
        <p className="text-sm text-muted-foreground">
          ใช้ส่งยอดเงินออมและตอบกลับผู้ปกครองอัตโนมัติ ผ่านบัญชี LINE OA ของคุณเอง
        </p>
      </div>

      {channel ? (
        <>
          <div className="grid gap-1 rounded-lg border border-deposit/30 bg-deposit-soft p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-deposit">
              <CircleCheck className="size-4 shrink-0" aria-hidden />
              เชื่อมต่อแล้ว: {channel.displayName ?? "LINE Official Account"}
            </p>
            {channel.basicId && <p>Basic ID: <span className="font-mono">{channel.basicId}</span></p>}
            <p>Channel ID: <span className="font-mono">{channel.channelId}</span></p>
            <p className="break-all text-muted-foreground">
              Webhook: <span className="font-mono">{expectedWebhook}</span>
            </p>
          </div>
          {webhook && webhook.endpoint !== expectedWebhook && (
            <div className="grid gap-2 rounded-lg border border-withdraw/30 bg-withdraw-soft p-4 text-sm">
              <p className="flex items-start gap-2 font-medium">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-withdraw" aria-hidden />
                Webhook ใน LINE ชี้ไปที่อื่น ผู้ปกครองจะยังไม่ได้รับการตอบกลับ
              </p>
              <p className="break-all text-muted-foreground">ตอนนี้ชี้ไปที่: {webhook.endpoint || "(ว่าง)"}</p>
              <RepairWebhookButton />
            </div>
          )}
          {webhook && webhook.endpoint === expectedWebhook && !webhook.active && (
            <div className="grid gap-2 rounded-lg border border-withdraw/30 bg-withdraw-soft p-4 text-sm">
              <p className="flex items-start gap-2 font-medium">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-withdraw" aria-hidden />
                ยังไม่ได้เปิด &quot;Use webhook&quot; ใน LINE ผู้ปกครองส่งข้อความมาแล้วแอปจะยังไม่ได้รับ
              </p>
              <p>วิธีเปิด (ทำครั้งเดียว):</p>
              <ol className="grid list-decimal gap-1 pl-5">
                <li>
                  เปิด{" "}
                  <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    LINE Developers Console
                  </a>{" "}
                  → เลือก channel &quot;{channel.displayName ?? channel.channelId}&quot;
                </li>
                <li>แท็บ <strong>Messaging API</strong> → หัวข้อ Webhook settings → เปิดสวิตช์ <strong>Use webhook</strong></li>
                <li>กลับมาหน้านี้แล้วรีเฟรช คำเตือนนี้จะหายไป</li>
              </ol>
            </div>
          )}
          {webhook?.active && webhook.endpoint === expectedWebhook && (
            <p className="flex items-center gap-2 text-sm text-deposit">
              <CircleCheck className="size-4 shrink-0" aria-hidden />
              Webhook ทำงานอยู่ ผู้ปกครองพิมพ์รหัสหรือ &quot;ยอดเงิน&quot; ได้เลย
            </p>
          )}
          <details className="group rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">เปลี่ยน key (เช่น ออก token ใหม่ หรือใช้ OA ของโรงเรียน)</summary>
            <div className="mt-4">
              <LineConnectForm channelId={channel.channelId} />
            </div>
          </details>
          <DisconnectLineButton />
        </>
      ) : (
        <>
          <SetupGuide />
          <LineConnectForm />
        </>
      )}
    </section>
  );
}

function SetupGuide() {
  return (
    <details open className="rounded-lg border bg-muted/40 p-4 text-sm">
      <summary className="cursor-pointer font-medium">วิธีสร้างและหา key (ทำครั้งเดียว ประมาณ 10 นาที)</summary>
      <ol className="mt-3 grid list-decimal gap-2 pl-5">
        <li>
          สร้าง LINE Official Account (ฟรี) ที่{" "}
          <a href="https://manager.line.biz" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            manager.line.biz
          </a>
        </li>
        <li>ใน LINE Official Account Manager → <strong>ตั้งค่า</strong> → <strong>Messaging API</strong> → กด <strong>ใช้ Messaging API</strong></li>
        <li>
          เปิด{" "}
          <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            LINE Developers Console
          </a>{" "}
          → เลือก channel ของ OA นี้
        </li>
        <li>แท็บ <strong>Basic settings</strong>: คัดลอก <strong>Channel ID</strong> และ <strong>Channel secret</strong></li>
        <li>แท็บ <strong>Messaging API</strong>: ล่างสุด <strong>Channel access token (long-lived)</strong> กด <strong>Issue</strong> แล้วคัดลอก</li>
        <li>วางทั้ง 3 ค่าด้านล่าง แล้วกดบันทึก ระบบจะตั้ง Webhook ให้เองอัตโนมัติ</li>
        <li>
          กลับไปที่ LINE Official Account Manager → <strong>ตั้งค่าการตอบกลับ</strong> → <strong>ปิด</strong> &quot;ข้อความตอบกลับอัตโนมัติ&quot; (ไม่งั้นผู้ปกครองจะได้ข้อความซ้ำ)
        </li>
      </ol>
    </details>
  );
}

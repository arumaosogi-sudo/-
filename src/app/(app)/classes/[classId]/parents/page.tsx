import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { idSchema } from "@/lib/validation";
import { getClassroom, requireUser } from "@/server/dal";
import { addFriendUrl, prefilledMessageUrl } from "@/server/line";
import { getTeacherChannel } from "@/server/line-channels";
import { listParentLinks } from "@/server/notify";
import { ParentRows, PrintButton } from "./parent-rows";

export const metadata: Metadata = { title: "ผู้ปกครอง (LINE)" };

const qrSvg = (url: string) => QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

export default async function ParentsPage({ params }: PageProps<"/classes/[classId]/parents">) {
  const { classId } = await params;
  if (!idSchema.safeParse(classId).success) notFound();
  const user = await requireUser();
  const classroom = await getClassroom(user.id, classId);
  const students = (await listParentLinks(user.id, classId)) ?? [];
  const basicId = (await getTeacherChannel(user.id))?.basicId ?? null;

  const friendQr = basicId ? await qrSvg(addFriendUrl(basicId)) : null;
  const studentQrs = basicId
    ? await Promise.all(students.map((s) => qrSvg(prefilledMessageUrl(basicId, s.code))))
    : [];
  const linkedCount = students.filter((s) => s.guardians.length > 0).length;

  return (
    <div className="grid gap-6">
      <div className="print:hidden">
        <Link
          href={`/classes/${classId}`}
          className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {classroom.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">ผู้ปกครอง (LINE)</h1>
            <p className="text-sm text-muted-foreground">
              เชื่อมต่อแล้ว {linkedCount} จาก {students.length} คน
            </p>
          </div>
          {students.length > 0 && <PrintButton />}
        </div>
      </div>

      <ol className="grid gap-2 rounded-xl border bg-card p-5 text-sm print:hidden">
        <li>
          <strong>1.</strong> กด <strong>พิมพ์ใบเชิญ</strong> แล้วแจกให้ผู้ปกครอง (หรือส่งรหัส 6 หลักของนักเรียนแต่ละคนให้ผู้ปกครองทางแชต)
        </li>
        <li>
          <strong>2.</strong> ผู้ปกครองสแกน QR เพื่อเพิ่มเพื่อน LINE Official Account {basicId && <span className="font-mono">{basicId}</span>}
        </li>
        <li>
          <strong>3.</strong> สแกน QR ของบุตรหลาน (หรือพิมพ์รหัส 6 หลัก) ส่งในแชต แล้วกด <strong>ยินยอม</strong>
        </li>
      </ol>

      {!basicId && (
        <p className="flex items-start gap-2 rounded-lg border border-withdraw/30 bg-withdraw-soft px-4 py-3 text-sm print:hidden">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-withdraw" aria-hidden />
          <span>
            ยังไม่ได้เชื่อม LINE Official Account ของคุณ ผู้ปกครองจึงยังเชื่อมต่อไม่ได้{" "}
            <Link href="/settings#line" className="font-medium underline underline-offset-2">
              ไปที่ตั้งค่า LINE
            </Link>
          </span>
        </p>
      )}

      {students.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground print:hidden">
          ยังไม่มีนักเรียนในห้องนี้
        </p>
      ) : (
        <ParentRows students={students} />
      )}

      {/* Printable invitation slips, one per student. */}
      <div className="hidden grid-cols-2 gap-4 print:grid">
        {students.map((s, i) => (
          <div key={s.id} className="break-inside-avoid rounded-lg border border-black p-4 text-black">
            <p className="text-xs">กระปุกห้องเรียน · {classroom.name}</p>
            <p className="mt-1 text-lg font-semibold">
              {s.number}. {s.fullName}
              {s.nickname && ` (${s.nickname})`}
            </p>
            <p className="mt-2 text-sm">รับแจ้งยอดเงินออมทาง LINE:</p>
            <div className="mt-2 flex gap-3">
              {friendQr && (
                <figure className="w-28 text-center text-[10px]">
                  <div dangerouslySetInnerHTML={{ __html: friendQr }} />
                  <figcaption>1. สแกนเพิ่มเพื่อน</figcaption>
                </figure>
              )}
              {studentQrs[i] && (
                <figure className="w-28 text-center text-[10px]">
                  <div dangerouslySetInnerHTML={{ __html: studentQrs[i] }} />
                  <figcaption>2. สแกนแล้วกดส่ง</figcaption>
                </figure>
              )}
            </div>
            <p className="mt-2 text-sm">
              หรือพิมพ์รหัสนี้ในแชต: <span className="font-mono text-xl font-bold tracking-widest">{s.code}</span>
            </p>
            <p className="mt-1 text-[10px]">จากนั้นกด “ยินยอม” · พิมพ์ “ยอดเงิน” เพื่อดูยอดได้ตลอดเวลา</p>
          </div>
        ))}
      </div>
    </div>
  );
}

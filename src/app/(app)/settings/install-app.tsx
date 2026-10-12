import { headers } from "next/headers";
import QRCode from "qrcode";

/** QR code of this site's address plus install steps, for putting the app on another phone. */
export async function InstallApp() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/login`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <div className="grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-start">
      <div
        className="mx-auto w-40 rounded-xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
        role="img"
        aria-label={`QR code สำหรับเปิด ${url}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="grid gap-3 text-sm">
        <p className="break-all text-muted-foreground">{url}</p>
        <div className="grid gap-1.5">
          <p className="font-medium">Android</p>
          <p className="text-muted-foreground">
            ดาวน์โหลดไฟล์แอป (APK) แล้วเปิดติดตั้ง ถ้าเครื่องถาม ให้อนุญาต &quot;ติดตั้งแอปที่ไม่รู้จัก&quot; สำหรับเบราว์เซอร์นั้น
          </p>
          <a
            href={`${proto}://${host}/download/kid-savings-bank.apk`}
            download
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 sm:justify-self-start"
          >
            ดาวน์โหลดแอป Android (APK)
          </a>
          <p className="text-muted-foreground">หรือ สแกน QR → เปิดใน Chrome → เมนู ⋮ → ติดตั้งและสร้างทางลัด → ติดตั้ง</p>
        </div>
        <div>
          <p className="font-medium">iPhone (Safari)</p>
          <p className="text-muted-foreground">สแกน QR → เปิดใน Safari → ปุ่มแชร์ → เพิ่มไปยังหน้าจอโฮม</p>
        </div>
      </div>
    </div>
  );
}

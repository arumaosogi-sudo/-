# คู่มือติดตั้งและดูแลระบบ (กระปุกห้องเรียน)

แอปสำหรับคุณครูบันทึกเงินออมของนักเรียนในห้องเรียน และส่งยอดให้ผู้ปกครองทาง LINE รองรับครูหลายคน โดยแต่ละคนใช้ LINE Official Account ของตัวเอง

**Stack:** Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · Drizzle ORM · Neon Postgres (หรือ PGlite สำหรับเครื่องตัวเอง) · Better Auth · LINE Login + Messaging API

- ใช้งานจริง: **https://kid-savings-bank.vercel.app** (Vercel ทีม Aruma, โปรเจกต์ `kid-savings-bank`, region `cle1` · Neon us-east-2)

## เริ่มใช้งานบนเครื่องตัวเอง

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 ในเครื่องสมัครด้วยอีเมลได้ (สำหรับทดสอบ) ส่วนใน production ใช้ LINE อย่างเดียว

ถ้าไม่ได้ใส่ `DATABASE_URL` ใน `.env.local` แอปจะใช้ฐานข้อมูลในเครื่อง (PGlite เก็บไว้ที่ `.data/pglite`) และทุกครั้งที่รัน `npm run dev` ระบบจะรัน migration ให้ก่อน (สคริปต์ `predev`)

> **ข้อควรระวังของ PGlite:** เปิดฐานข้อมูลได้ทีละโปรเซสเท่านั้น ถ้าเปิดซ้อนกันข้อมูลจะหาย ระบบจึงมีไฟล์ล็อก `.data/pglite.lock` คอยกันไว้ ถ้าเจอข้อความ "already open" ให้ปิด dev server หรือสคริปต์ตัวอื่นก่อน
> ถ้าลบหรือเปลี่ยนชื่อไฟล์พิเศษของ Next.js (เช่น `instrumentation.ts`) ให้ลบโฟลเดอร์ `.next` ด้วย เพราะ Turbopack อาจยังรันไฟล์เก่าที่ค้างอยู่ใน cache

## Environment variables

ดูตัวอย่างที่ `.env.example` (ในเครื่อง: `.env.local` · production: ตั้งใน Vercel และมีสำเนาที่ `.env.production.vercel` ห้ามแชร์)

| ตัวแปร | คำอธิบาย |
|---|---|
| `DATABASE_URL` | connection string ของ Neon (แบบ pooled) ถ้าเว้นว่างจะใช้ PGlite ในเครื่อง |
| `BETTER_AUTH_SECRET` | ค่าสุ่มยาว 32 ไบต์ขึ้นไป |
| `BETTER_AUTH_URL` | URL ของแอป (production: `https://kid-savings-bank.vercel.app` ต้องตรงกับ callback ใน LINE Login) |
| `BETTER_AUTH_TRUSTED_ORIGINS` | origin อื่นที่อนุญาตให้ login (ไม่บังคับ) |
| `LINE_CLIENT_ID` / `LINE_CLIENT_SECRET` | LINE Login channel ของแอป (ใช้ร่วมกันทุกครู) |
| `LINE_CREDENTIALS_KEY` | กุญแจเข้ารหัส key LINE OA ของครู (32 ไบต์ base64) **ห้ามเปลี่ยนใน production** ไม่งั้นครูต้องกรอก key ใหม่ทุกคน |
| `LINE_DRY_RUN` | `1` = ไม่เรียก LINE จริง (ใช้ทดสอบในเครื่อง) |
| `CRON_SECRET` | รหัสลับของตัวส่งอัตโนมัติ |

## ฐานข้อมูล

```bash
npm run db:generate   # สร้างไฟล์ migration หลังแก้ src/db/schema.ts
npm run db:migrate    # ส่ง migration ไปที่ฐานข้อมูล (Neon ถ้ามี DATABASE_URL)
npm run db:studio     # เปิดหน้าดูข้อมูลใน browser
```

## Deploy

```bash
npx vercel deploy --prod --scope aruma3
```
migration รันอัตโนมัติก่อน build ผ่านสคริปต์ `vercel-build`

## โครงสร้างโค้ด

```
src/
  db/schema.ts             ตารางทั้งหมด
  db/client.ts             เลือก Neon หรือ PGlite อัตโนมัติ
  lib/auth.ts              Better Auth (LINE Login, บัญชีอีเมลเดิมเชื่อม LINE ได้)
  proxy.ts                 ส่งผู้ที่ยังไม่ login ไปหน้า /login
  server/dal.ts            ชั้นเข้าถึงข้อมูล: ทุก query ตรวจว่าเป็นข้อมูลของครูคนนั้นจริง
  server/money.ts          ฝาก / ถอน / ยกเลิก (ล็อกแถวนักเรียนใน DB transaction กันยอดติดลบ)
  server/line.ts           เรียก LINE Messaging API ด้วย key ของ OA นั้น ๆ
  server/line-channels.ts  บันทึก/ตรวจ key LINE OA ของครู, ตั้งและซ่อม Webhook
  server/line-messages.ts  การ์ดยอดเงิน (ยอดคงเหลือ + รายการสัปดาห์นี้), ข้อความวิธีใช้, ปุ่มลัด
  server/notify.ts         รหัสผู้ปกครอง, ส่งยอด, ตัวส่งอัตโนมัติ
  server/crypto.ts         เข้ารหัส key (AES-256-GCM)
  app/api/line/webhook/[channel]/  Webhook ของ OA แต่ละตัว
  app/api/cron/notify/     ตัวส่งอัตโนมัติ (Vercel Cron)
  app/api/cron/cleanup/    ลบบัญชีครูที่ไม่ได้ใช้งานเกิน 1 ปี พร้อมข้อมูลทั้งหมด (Vercel Cron ทุกวันอาทิตย์; ใส่ ?dryRun=1 เพื่อดูจำนวนโดยไม่ลบ)
  app/(app)/classes/       ห้องเรียน, นักเรียน, ฝาก-ถอน, ผู้ปกครอง (LINE), ส่งออก Excel
  app/(app)/settings/      ตั้งค่า: บัญชี, ธีม, ติดตั้งแอป, LINE OA ของฉัน, แจ้งเตือน
```

### หลักการสำคัญ

- **ยอดเงินไม่ถูกเก็บเป็นตัวเลขที่แก้ได้** คำนวณจากผลรวมของตาราง `transactions` เสมอ
- **แก้รายการผิดได้ 2 แบบ:** กด "ยกเลิก" บนแจ้งเตือนภายใน 5 วินาทีหลังบันทึก (รายการถูกลบ) หรือกด "ยกเลิกรายการนี้" ในหน้าประวัติ (บันทึกรายการกลับ ทั้งสองรายการยังแสดงอยู่)
- **ถอนเงินหรือยกเลิกการฝากไม่ได้ถ้ายอดไม่พอ** ยอดเงินจึงไม่มีทางติดลบ
- **เก็บเงินเป็นสตางค์ (integer)** เพื่อไม่ให้ทศนิยมคลาดเคลื่อน
- **นักเรียนที่มีประวัติการฝากจะไม่ถูกลบ** แค่ย้ายออกจากห้อง (archive)
- **ห้ามเรียก `db` ตรงจากหน้าเว็บหรือ action** ให้ผ่านฟังก์ชันใน `src/server/` ซึ่งตรวจสิทธิ์ของครูทุกครั้ง

## LINE

### LINE Login (ทำครั้งเดียวสำหรับทั้งแอป)
LINE Developers → LINE Login channel → Callback URL `https://kid-savings-bank.vercel.app/api/auth/callback/line` → สถานะ **Published**

### ครูแต่ละคน: เชื่อม LINE Official Account ของตัวเอง
ในแอป: ตั้งค่า → **LINE Official Account ของฉัน** (มีขั้นตอนภาษาไทยในหน้านั้น)
1. สร้าง OA ที่ manager.line.biz → เปิด Messaging API
2. วาง Channel ID, Channel secret, Channel access token (long-lived) → บันทึก
   - ระบบตรวจ token, ดึง Basic ID/ชื่อ OA, **ตั้ง Webhook ให้อัตโนมัติ** (`/api/line/webhook/<channel>`) และให้ LINE ทดสอบเพื่อยืนยัน secret
3. เปิดสวิตช์ **Use webhook** ใน LINE Developers (ถ้ายังปิด หน้าตั้งค่าจะเตือน)
4. ปิด "ข้อความตอบกลับอัตโนมัติ" ใน OA Manager

หน้าตั้งค่าเช็กสถานะ Webhook กับ LINE ทุกครั้งที่เปิด ถ้าชี้ไปที่อื่นจะมีปุ่ม "แก้ Webhook ให้ชี้มาที่แอปนี้"
OA ของโรงเรียน (อนาคต): ให้ครูทุกคนกรอก key ชุดเดียวกัน ระบบรู้เองว่าเป็น OA เดียวกัน

### ผู้ปกครอง
หน้าห้องเรียน → **ผู้ปกครอง (LINE)** → **พิมพ์ใบเชิญ** ผู้ปกครองเพิ่มเพื่อน OA → ส่งรหัส 6 หลักของลูก → กด **ยินยอม**
จากนั้นกดปุ่ม **💰 ยอดเงิน** ได้ตลอดเวลา: ยอดคงเหลือ + รายการฝาก-ถอนของสัปดาห์นี้ (เริ่มนับใหม่ทุกวันจันทร์) · พิมพ์ `ยกเลิก` เพื่อหยุดรับการแจ้งเตือน

### ส่งอัตโนมัติ
Vercel Cron เรียก `GET /api/cron/notify` วันละครั้ง 18:00 น. (เวลาไทย) ตาม `vercel.json` (แพ็กเกจฟรีรันได้วันละครั้ง) ระบบเช็กเองว่าครูคนไหนถึงรอบ (เรียกซ้ำก็ไม่ส่งซ้ำ)
ถ้าต้องการให้เลือกเวลาได้จริง ให้ใช้ตัวเรียกรายชั่วโมง เช่น Upstash QStash ส่ง header `Authorization: Bearer <CRON_SECRET>`

## ส่งออก Excel
หน้าห้องเรียน → เมนู ⋮ → **ส่งออกเป็น Excel** ได้ไฟล์ 2 ชีต: สรุปยอดรายคน และรายการฝาก-ถอนทั้งหมด

## แอป Android (APK)
ห่อเว็บแอปเป็นแอป Android ด้วย TWA (Bubblewrap) · package `app.vercel.kidsavingsbank`
- ดาวน์โหลด: https://kid-savings-bank.vercel.app/download/kid-savings-bank.apk (ปุ่มอยู่ใน ตั้งค่า → ติดตั้งแอปบนมือถือ)
- โปรเจกต์อยู่ที่ `android/` · กุญแจเซ็นแอป `android/kid-savings-bank.keystore` + รหัสใน `android/signing.env` **ห้ามหาย ห้าม commit** ไม่งั้นอัปเดตแอปทับของเดิมไม่ได้
- `public/.well-known/assetlinks.json` ต้องมี SHA-256 ของกุญแจนี้ แอปจึงเปิดเต็มจอโดยไม่มีแถบ URL
- เวอร์ชัน 1.0.1 (versionCode 2) เซ็นด้วยกุญแจใหม่ (SHA-256 `39:D0:7E:…:63:8E`) เพราะกุญแจของ 1.0.0 หาย เครื่องที่ลง 1.0.0 ไว้ต้องถอนแอปเดิมก่อนลงใหม่ · assetlinks มีทั้งกุญแจเก่าและใหม่ แอปเดิมจึงยังใช้ได้
- สร้างแบบไม่ใช้ Bubblewrap ก็ได้: JDK ของ Android Studio (`jbr`) → คัดลอก `android/` ไปโฟลเดอร์ที่ path เป็นภาษาอังกฤษล้วน → `gradlew assembleRelease` → `zipalign` + `apksigner sign` จาก Android SDK build-tools
- เนื้อหาแอปดึงจากเว็บเสมอ แก้เว็บแล้ว deploy ก็พอ ไม่ต้องสร้าง APK ใหม่ (สร้างใหม่เฉพาะเมื่อเปลี่ยนชื่อ/ไอคอน/สี)
- สร้าง APK ใหม่: เครื่องมือต้องใช้ JDK 17 (`D:\DevTools\jdk-17`) → เพิ่ม `appVersionCode` ใน `android/twa-manifest.json` → `cd android && npx @bubblewrap/cli update && npx @bubblewrap/cli build` (ตั้ง `BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD` จาก signing.env) แล้วคัดลอก `app-release-signed.apk` ไปที่ `public/download/kid-savings-bank.apk`

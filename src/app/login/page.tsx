import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PiggyBank } from "lucide-react";
import { lineLoginEnabled } from "@/lib/auth";
import { getSession } from "@/server/dal";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage() {
  if (await getSession()) redirect("/classes");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <PiggyBank className="size-9" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold">กระปุกห้องเรียน</h1>
          <p className="mt-1 text-muted-foreground">บันทึกเงินออมของนักเรียนได้ง่าย ๆ ในที่เดียว</p>
        </div>
        <AuthForm line={lineLoginEnabled} />
      </div>
    </main>
  );
}

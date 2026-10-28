"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authClient, authErrorMessage } from "@/lib/auth-client";

type Props = {
  /** LINE Login is configured. */
  line: boolean;
};

export function AuthForm({ line }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function run(action: () => Promise<{ error: { code?: string; message?: string } | null }>) {
    setPending(true);
    const { error } = await action();
    if (error) {
      setPending(false);
      toast.error(authErrorMessage(error));
      return;
    }
    router.replace("/classes");
    router.refresh();
  }

  function onLine() {
    setPending(true);
    authClient.signIn.social({ provider: "line", callbackURL: "/classes" }).then(({ error }) => {
      if (error) {
        setPending(false);
        toast.error(authErrorMessage(error));
      }
    });
  }

  function onEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    run(() =>
      mode === "signup"
        ? authClient.signUp.email({ name: String(form.get("name")).trim(), email, password })
        : authClient.signIn.email({ email, password }),
    );
  }

  return (
    <Card>
      <CardContent className="grid gap-5">
        {line ? (
          <Button
            type="button"
            size="touch"
            disabled={pending}
            onClick={onLine}
            className="bg-[#06C755] text-white hover:bg-[#05b34c]"
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            เข้าสู่ระบบด้วย LINE
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">ยังไม่ได้ตั้งค่า LINE Login (LINE_CLIENT_ID)</p>
        )}
        {line && <p className="-mt-2 text-center text-sm text-muted-foreground">ครั้งแรกระบบจะสร้างบัญชีให้อัตโนมัติ</p>}

        <details className="group rounded-lg border p-3 text-sm" open={!line}>
          <summary className="cursor-pointer text-muted-foreground">ใช้อีเมล</summary>
          <form onSubmit={onEmail} className="mt-3 grid gap-3">
            {mode === "signup" && <FormField label="ชื่อที่ใช้แสดง" name="name" autoComplete="name" required />}
            <FormField label="อีเมล" name="email" type="email" autoComplete="email" required />
            <FormField
              label="รหัสผ่าน"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
            <Button type="submit" variant="outline" size="touch" disabled={pending}>
              {mode === "signup" ? "สมัครด้วยอีเมล" : "เข้าสู่ระบบด้วยอีเมล"}
            </Button>
            <button
              type="button"
              className="text-muted-foreground underline underline-offset-2"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "ยังไม่มีบัญชี สมัครด้วยอีเมล" : "มีบัญชีแล้ว เข้าสู่ระบบ"}
            </button>
            {line && (
              <p className="text-muted-foreground">หลังเข้าสู่ระบบ ไปที่ ตั้งค่า → เชื่อมบัญชี LINE เพื่อใช้ LINE ครั้งต่อไป</p>
            )}
          </form>
        </details>
      </CardContent>
    </Card>
  );
}

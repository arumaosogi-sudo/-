"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SEND_HOURS, WEEKDAYS, type Schedule } from "@/lib/schedule";
import { saveNotificationSettingsAction, sendNowAction } from "./actions";

const selectClass = "h-11 w-full rounded-lg border bg-background px-3 text-base disabled:opacity-50";

export function NotificationForm({ settings }: { settings: Schedule }) {
  // Controlled + manual submit: React's automatic form reset after an action
  // would snap the switch and selects back to their initial values.
  const [enabled, setEnabled] = useState(settings.enabled);
  const [sendWeekday, setSendWeekday] = useState(settings.sendWeekday);
  const [sendHour, setSendHour] = useState(settings.sendHour);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    if (enabled) formData.set("enabled", "on");
    formData.set("sendWeekday", String(sendWeekday));
    formData.set("sendHour", String(sendHour));
    startTransition(async () => {
      const result = await saveNotificationSettingsAction(null, formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="notify-enabled" className="text-base">
          ส่งยอดเงินออมให้ผู้ปกครองอัตโนมัติ
        </Label>
        <Switch id="notify-enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="notify-weekday">ส่งทุกสัปดาห์ วัน</Label>
          <select
            id="notify-weekday"
            value={sendWeekday}
            onChange={(e) => setSendWeekday(Number(e.target.value))}
            disabled={!enabled}
            className={selectClass}
          >
            {WEEKDAYS.map((w) => (
              <option key={w.day} value={w.day}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="notify-hour">เวลาส่ง</Label>
          <select
            id="notify-hour"
            value={sendHour}
            onChange={(e) => setSendHour(Number(e.target.value))}
            disabled={!enabled}
            className={selectClass}
          >
            {SEND_HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00 น.
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" size="touch" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        บันทึกการตั้งค่า
      </Button>
    </form>
  );
}

export function SendNowButton({ parentCount }: { parentCount: number }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function send() {
    startTransition(async () => {
      const result = await sendNowAction();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="touch" disabled={parentCount === 0} className="w-full sm:w-auto">
          <Send aria-hidden />
          ส่งยอดให้ผู้ปกครองตอนนี้
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ส่งยอดเงินออมตอนนี้?</AlertDialogTitle>
          <AlertDialogDescription>
            จะส่งข้อความถึงผู้ปกครอง {parentCount} คน (นับเป็น {parentCount} ข้อความในโควตา LINE) รอบอัตโนมัติยังเป็นไปตามเดิม
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              send();
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            ส่งเลย
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

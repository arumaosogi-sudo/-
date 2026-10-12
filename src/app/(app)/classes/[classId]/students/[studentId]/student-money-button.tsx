"use client";

import { useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyDialog, type MoneyDialogStudent } from "../../../money-dialog";

export function StudentMoneyButton({ student }: { student: MoneyDialogStudent }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="touch" variant="secondary" onClick={() => setOpen(true)} className="shrink-0">
        <ArrowDownUp aria-hidden />
        ฝาก / ถอน
      </Button>
      <MoneyDialog student={open ? student : null} onClose={() => setOpen(false)} />
    </>
  );
}

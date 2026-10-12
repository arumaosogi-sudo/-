"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore, FileSpreadsheet, MoreVertical, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/validation";
import { setClassroomArchivedAction } from "../actions";
import { ClassroomFormDialog } from "../classroom-form-dialog";

type Props = {
  classroom: { id: string; name: string; schoolYear: string; archived: boolean };
  updateAction: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
};

export function ClassroomMenu({ classroom, updateAction }: Props) {
  const [pending, startTransition] = useTransition();

  function toggleArchive() {
    startTransition(async () => {
      const result = await setClassroomArchivedAction(classroom.id, !classroom.archived);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <ClassroomFormDialog
        title="แก้ไขห้องเรียน"
        submitLabel="บันทึก"
        action={updateAction}
        defaults={{ name: classroom.name, schoolYear: classroom.schoolYear }}
        trigger={
          <Button variant="outline" size="icon-touch" aria-label="แก้ไขห้องเรียน">
            <Pencil aria-hidden />
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-touch" aria-label="ตัวเลือกเพิ่มเติม" disabled={pending}>
            <MoreVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="py-2.5 text-base" asChild>
            <a href={`/classes/${classroom.id}/export`} download>
              <FileSpreadsheet aria-hidden />
              ส่งออกเป็น Excel
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem className="py-2.5 text-base" onSelect={toggleArchive}>
            {classroom.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {classroom.archived ? "นำกลับมาใช้งาน" : "เก็บเข้าคลัง (จบปีการศึกษา)"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

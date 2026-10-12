import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { bangkokDateKey } from "@/lib/format";
import { idSchema } from "@/lib/validation";
import { classroomWorkbook } from "@/server/export";

// GET /classes/<id>/export → Excel report (summary + all entries) for that class.
export async function GET(_request: Request, { params }: RouteContext<"/classes/[classId]/export">) {
  const { classId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!idSchema.safeParse(classId).success) return new Response("Not found", { status: 404 });

  const result = await classroomWorkbook(session.user.id, classId);
  if (!result) return new Response("Not found", { status: 404 });

  const filename = `เงินออม-${result.classroom.name}-${bangkokDateKey(new Date())}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
  return new Response(result.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="classroom.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

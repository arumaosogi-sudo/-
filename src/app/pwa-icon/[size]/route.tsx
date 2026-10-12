import { appIcon } from "@/lib/app-icon";

// /pwa-icon/192, /pwa-icon/512 and /pwa-icon/maskable for the web app manifest.
export async function GET(_request: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await params;
  if (size === "maskable") return appIcon(512, { maskable: true });
  if (size === "192" || size === "512") return appIcon(Number(size));
  return new Response("Not found", { status: 404 });
}

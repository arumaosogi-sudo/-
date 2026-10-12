import { appIcon } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own rounded mask, so use the full-bleed variant.
export default function AppleIcon() {
  return appIcon(180, { maskable: true });
}

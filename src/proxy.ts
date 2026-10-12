import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic redirect only (cookie presence). Real authorization happens in
// src/server/dal.ts on every page and action.
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  const { pathname } = request.nextUrl;
  // /login itself checks the real session and forwards signed-in users, so a
  // stale cookie can't cause a redirect loop here.
  if (!hasSession && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except API routes, static files and the PWA files a phone
  // fetches without a session (manifest, icons, service worker, offline page)
  // and .well-known/assetlinks.json, which proves the Android app owns this site,
  // plus the Android app download (/download/*.apk).
  matcher: [
    "/((?!api|_next/static|_next/image|\\.well-known|download|favicon.ico|manifest.webmanifest|sw.js|offline.html|icon|apple-icon|pwa-icon|.*\\.(?:png|jpg|svg|ico|webp)$).*)",
  ],
};

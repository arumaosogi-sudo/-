import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Thin wrapper over the LINE Messaging API (https://developers.line.biz/en/reference/messaging-api/).
// Every call takes the credentials of the teacher's own LINE Official Account.
// With LINE_DRY_RUN=1 (local development) nothing is sent; requests are
// printed to the server log instead.

const API = "https://api.line.me/v2/bot";

export type LineMessage = Record<string, unknown>;
export type LineCredentials = { channelSecret: string; accessToken: string };
type CallResult = { ok: true; dryRun: boolean } | { ok: false; dryRun: false; error: string; status: number };

const dryRun = () => process.env.LINE_DRY_RUN === "1";

/** Link that opens the OA's add-friend page. */
export const addFriendUrl = (basicId: string) => `https://line.me/R/ti/p/${encodeURIComponent(basicId)}`;

/** Link that opens a chat with the OA with `text` already typed in. */
export const prefilledMessageUrl = (basicId: string, text: string) =>
  `https://line.me/R/oaMessage/${encodeURIComponent(basicId)}/?${encodeURIComponent(text)}`;

/** Checks the X-Line-Signature header against the raw request body. */
export function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function call(token: string, method: "POST" | "PUT", path: string, body: unknown): Promise<CallResult> {
  if (dryRun()) {
    console.info(`[LINE dry run] ${method} ${path}`, JSON.stringify(body));
    return { ok: true, dryRun: true };
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true, dryRun: false };
  const detail = await res.text().catch(() => "");
  return { ok: false, dryRun: false, status: res.status, error: `LINE ${res.status}: ${detail.slice(0, 300)}` };
}

/** Reply to a webhook event. Replies are free and don't count toward the monthly quota. */
export const reply = (creds: LineCredentials, replyToken: string, messages: LineMessage[]) =>
  call(creds.accessToken, "POST", "/message/reply", { replyToken, messages });

/** Push a message to a user. Each push counts toward the OA's monthly quota. */
export const push = (creds: LineCredentials, to: string, messages: LineMessage[]) =>
  call(creds.accessToken, "POST", "/message/push", { to, messages });

/** A friend's display name, or null. */
export async function getDisplayName(creds: LineCredentials, userId: string): Promise<string | null> {
  if (dryRun()) return null;
  const res = await fetch(`${API}/profile/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${creds.accessToken}` },
  });
  if (!res.ok) return null;
  const profile = (await res.json()) as { displayName?: string };
  return profile.displayName ?? null;
}

// ---------------------------------------------------------------------------
// Checks used when a teacher saves their OA's keys
// ---------------------------------------------------------------------------

/** The OA's identity for a channel access token, or null if the token is invalid. */
export async function getBotInfo(accessToken: string) {
  const res = await fetch(`${API}/info`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  return (await res.json()) as { basicId?: string; displayName?: string; userId?: string };
}

/** Where LINE currently sends this OA's events, and whether "Use webhook" is switched on. */
export async function getWebhookEndpoint(accessToken: string) {
  if (dryRun()) return null;
  const res = await fetch(`${API}/channel/webhook/endpoint`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  return (await res.json()) as { endpoint?: string; active?: boolean };
}

export async function setWebhookEndpoint(accessToken: string, endpoint: string) {
  return call(accessToken, "PUT", "/channel/webhook/endpoint", { endpoint });
}

/** Asks LINE to send a signed test request to the webhook; returns the HTTP status our endpoint answered. */
export async function testWebhook(accessToken: string, endpoint: string) {
  const res = await fetch(`${API}/channel/webhook/test`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; statusCode?: number; reason?: string };
  return { success: Boolean(data.success), statusCode: data.statusCode ?? 0, reason: data.reason ?? "" };
}

import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for LINE credentials at rest. The key comes from
// LINE_CREDENTIALS_KEY (32 random bytes, base64). Changing the key makes
// stored credentials unreadable; teachers would have to enter them again.

function key() {
  const raw = process.env.LINE_CREDENTIALS_KEY;
  if (!raw) throw new Error("LINE_CREDENTIALS_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("LINE_CREDENTIALS_KEY must be 32 bytes (base64)");
  return buf;
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decrypt(token: string) {
  const [version, iv, tag, data] = token.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

const errorMessages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  INVALID_EMAIL: "รูปแบบอีเมลไม่ถูกต้อง",
  INVALID_PASSWORD: "รหัสผ่านไม่ถูกต้อง",
  PASSWORD_TOO_SHORT: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  PASSWORD_TOO_LONG: "รหัสผ่านยาวเกินไป",
  USER_ALREADY_EXISTS: "อีเมลนี้สมัครใช้งานแล้ว ลองเข้าสู่ระบบแทน",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "อีเมลนี้สมัครใช้งานแล้ว ลองเข้าสู่ระบบแทน",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "บัญชี LINE นี้ถูกใช้กับบัญชีอื่นในระบบแล้ว",
  EMAIL_PASSWORD_SIGN_UP_DISABLED: "สมัครใหม่ได้ด้วย LINE เท่านั้น",
};

export function authErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
  return (error.code && errorMessages[error.code]) || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

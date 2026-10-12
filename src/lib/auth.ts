import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";

// Teachers sign in with LINE Login (one LINE Login channel for the whole app,
// set via LINE_CLIENT_ID / LINE_CLIENT_SECRET). Email + password remains only
// so accounts created before LINE Login can sign in once and link LINE;
// new email sign-ups are disabled. In local development email sign-up stays
// on so the app can be tested without a real LINE account.
const isDev = process.env.NODE_ENV !== "production";

const line =
  process.env.LINE_CLIENT_ID && process.env.LINE_CLIENT_SECRET
    ? {
        clientId: process.env.LINE_CLIENT_ID,
        clientSecret: process.env.LINE_CLIENT_SECRET,
        // Only openid + profile: the email scope needs a separate approval from
        // LINE, so each teacher gets a stable internal address instead.
        disableDefaultScope: true,
        scope: ["openid", "profile"],
        mapProfileToUser: (profile: { sub: string; name?: string; email?: string }) => ({
          email: profile.email || `${profile.sub}@line.local`,
          emailVerified: true,
        }),
      }
    : undefined;

export const lineLoginEnabled = Boolean(line);
/** Email sign-up is only offered in local development. */
export const emailSignUpEnabled = isDev;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !emailSignUpEnabled,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  socialProviders: {
    ...(line && { line }),
  },
  account: {
    accountLinking: {
      enabled: true,
      // Linking happens only when a signed-in teacher presses "เชื่อมบัญชี LINE".
      disableImplicitLinking: true,
      // LINE accounts carry an internal address, not the teacher's email.
      allowDifferentEmails: true,
    },
  },
  session: {
    // Teachers stay signed in on their phone for 30 days.
    expiresIn: 60 * 60 * 24 * 30,
  },
  // On Vercel without BETTER_AUTH_URL, fall back to the deployment's own URL.
  baseURL: process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  // Extra origins allowed to sign in: Vercel's deployment / branch / production
  // domains, plus BETTER_AUTH_TRUSTED_ORIGINS (e.g. a tunnel URL for testing on a phone:
  // BETTER_AUTH_TRUSTED_ORIGINS=https://*.trycloudflare.com,http://192.168.1.10:3000).
  trustedOrigins: [
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
      .filter(Boolean)
      .map((host) => `https://${host}`),
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ],
  plugins: [nextCookies()],
});


import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { threadId } from "node:worker_threads";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * With DATABASE_URL set (production / Neon) we connect over Neon's serverless
 * driver. Without it we fall back to an embedded PGlite database stored in
 * `.data/pglite`, so the app runs locally with zero setup.
 */
export const usingPglite = !process.env.DATABASE_URL;

function createDb(): Database {
  if (!usingPglite) {
    return drizzleNeon({ connection: process.env.DATABASE_URL!, schema }) as unknown as Database;
  }
  const dataDir = process.env.PGLITE_DIR ?? ".data/pglite";
  mkdirSync(dataDir, { recursive: true });
  acquirePgliteLock(dataDir);
  return drizzlePglite({
    connection: { dataDir },
    schema,
  }) as unknown as Database;
}

/**
 * PGlite is a full Postgres inside this process. Two openers of one data
 * directory (another process, or a worker thread) overwrite each other's WAL
 * and silently lose data, so refuse loudly instead.
 */
function acquirePgliteLock(dataDir: string) {
  const lockFile = `${dataDir}.lock`;
  const me = `${process.pid}:${threadId}`;
  if (existsSync(lockFile)) {
    const owner = readFileSync(lockFile, "utf8").trim();
    const ownerPid = Number(owner.split(":")[0]);
    if (owner !== me && isAlive(ownerPid)) {
      throw new Error(
        `Local database ${dataDir} is already open (pid:thread ${owner}). ` +
          "Stop the other dev server / script first, or set DATABASE_URL.",
      );
    }
  }
  writeFileSync(lockFile, me);
  process.once("exit", () => {
    try {
      if (readFileSync(lockFile, "utf8").trim() === me) unlinkSync(lockFile);
    } catch {}
  });
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// One instance per process (survives dev hot reloads), opened on first use
// rather than on import: `next build` imports server modules in several worker
// processes, and none of them should open the local database.
const globalForDb = globalThis as unknown as { __db?: Database };
const getDb = () => (globalForDb.__db ??= createDb());

export const db = new Proxy({} as Database, {
  get(_, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export async function runMigrations() {
  const config = { migrationsFolder: "drizzle" };
  if (usingPglite) {
    await migratePglite(db as unknown as Parameters<typeof migratePglite>[0], config);
  } else {
    await migrateNeon(db as unknown as Parameters<typeof migrateNeon>[0], config);
  }
}

/** Closes the connection (used by scripts so PGlite shuts down cleanly). */
export async function closeDb() {
  await (db as unknown as { $client: { close?: () => Promise<void>; end?: () => Promise<void> } }).$client[
    usingPglite ? "close" : "end"
  ]?.();
}

export { schema };

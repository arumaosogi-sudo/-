// Applies pending SQL migrations from ./drizzle to the configured database.
// Runs automatically before `npm run dev` (predev), or manually:
//   npm run db:migrate   (uses DATABASE_URL from .env.local, else local PGlite)
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { runMigrations, closeDb, usingPglite } = await import("../src/db/client");
  console.log(`Migrating ${usingPglite ? "local PGlite database" : "Neon database"}...`);
  await runMigrations();
  await closeDb();
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

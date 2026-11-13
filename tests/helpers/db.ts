import { existsSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/server/db/schema";
import { runMigrations } from "@/server/db/migrate";
import { setDbForTests, type Db } from "@/server/db/client";
import { seedStory } from "@/server/narrative/seed";
import { invalidateContent } from "@/server/content/repository";
import { sessions } from "@/server/db/schema";
import type { Story } from "@/server/narrative/types";

const NARRATIVE_PATH = path.resolve(__dirname, "../../narrative/index.ts");
export const NARRATIVE_AVAILABLE = existsSync(NARRATIVE_PATH);

export async function loadStory(): Promise<{ story: Story; walkthrough: string[] }> {
  // caminho dinâmico: a narrativa é privada e não existe em clones públicos
  const mod = (await import(/* @vite-ignore */ NARRATIVE_PATH)) as { story: Story; WALKTHROUGH: string[] };
  return { story: mod.story, walkthrough: mod.WALKTHROUGH };
}

export async function createTestDb(options: { seed?: boolean } = {}): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  await client.waitReady;
  const db = drizzle(client, { schema }) as unknown as Db;
  await runMigrations(db);
  setDbForTests(db, () => client.close());
  invalidateContent();
  if (options.seed !== false && NARRATIVE_AVAILABLE) {
    const { story } = await loadStory();
    await seedStory(db, story, process.env.PUZZLE_HMAC_KEY as string);
  }
  return { db, close: () => client.close() };
}

export async function createSession(db: Db): Promise<string> {
  const rows = await db
    .insert(sessions)
    .values({ tokenHash: `test-${Math.random()}`, expiresAt: new Date(Date.now() + 86_400_000) })
    .returning({ id: sessions.id });
  return rows[0]!.id;
}

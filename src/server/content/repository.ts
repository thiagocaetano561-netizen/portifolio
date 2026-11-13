import "server-only";
import type { Db } from "../db/client";
import { challenges, commandRules, easterEggs, unlockRules, virtualFiles, chapters } from "../db/schema";

export type ChallengeRow = typeof challenges.$inferSelect;
export type RuleRow = typeof commandRules.$inferSelect;
export type FileRow = typeof virtualFiles.$inferSelect;
export type UnlockRow = typeof unlockRules.$inferSelect;
export type EggRow = typeof easterEggs.$inferSelect;
export type ChapterRow = typeof chapters.$inferSelect;

export interface ProtectedContent {
  challengesByCommand: Map<string, ChallengeRow[]>;
  rulesByCommand: Map<string, RuleRow[]>;
  filesByPath: Map<string, FileRow[]>;
  unlockRules: UnlockRow[];
  eggs: Map<string, EggRow>;
  chapters: ChapterRow[];
  /** Comandos com regras de autocompletar. */
  completionRules: RuleRow[];
}

const TTL_MS = process.env.NODE_ENV === "production" ? 60_000 : 2_000;
let cache: { at: number; value: Promise<ProtectedContent> } | null = null;

function group<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

async function load(db: Db): Promise<ProtectedContent> {
  const [ch, rules, files, unlocks, eggs, chaps] = await Promise.all([
    db.select().from(challenges),
    db.select().from(commandRules),
    db.select().from(virtualFiles),
    db.select().from(unlockRules),
    db.select().from(easterEggs),
    db.select().from(chapters),
  ]);
  ch.sort((a, b) => a.sort - b.sort);
  rules.sort((a, b) => b.priority - a.priority);
  files.sort((a, b) => b.priority - a.priority);
  return {
    challengesByCommand: group(ch, (c) => c.command),
    rulesByCommand: group(
      rules.filter((r) => r.mode !== "complete"),
      (r) => r.command,
    ),
    filesByPath: group(files, (f) => f.path),
    unlockRules: unlocks,
    eggs: new Map(eggs.map((e) => [e.id, e])),
    chapters: chaps.sort((a, b) => a.sort - b.sort),
    completionRules: rules.filter((r) => r.mode === "complete"),
  };
}

/** Conteúdo protegido, lido do PostgreSQL e mantido em cache curto no processo. */
export function getContent(db: Db): Promise<ProtectedContent> {
  const now = Date.now();
  if (!cache || now - cache.at > TTL_MS) {
    const value = load(db);
    cache = { at: now, value };
    value.catch(() => {
      cache = null;
    });
  }
  return cache.value;
}

export function invalidateContent() {
  cache = null;
}

export function satisfied(flags: ReadonlySet<string>, requires: readonly string[], forbids: readonly string[]) {
  for (const r of requires) if (!flags.has(r)) return false;
  for (const f of forbids) if (flags.has(f)) return false;
  return true;
}

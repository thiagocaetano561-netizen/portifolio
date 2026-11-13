import "server-only";
import { sql } from "drizzle-orm";
import type { Line } from "../../lib/terminal/protocol";
import type { Db } from "../db/client";
import { chapters, challenges, commandRules, contentMeta, easterEggs, unlockRules, virtualFiles } from "../db/schema";
import { answerVerifier } from "../security/crypto";
import { normalizeAnswer, normalizeArgs } from "../security/normalize";
import { toLines } from "../terminal/vfs";
import { invalidateContent } from "../content/repository";
import type { Story } from "./types";

const lines = (text: string | undefined): Line[] => (text ? toLines(text) : []);

/** Validação de autoria: falha cedo em vez de publicar um enigma impossível. */
export function lintStory(story: Story): string[] {
  const problems: string[] = [];
  const produced = new Set<string>();
  for (const c of story.challenges) {
    produced.add(`solved:${c.id}`);
    for (const f of [...(c.rewards ?? []), ...(c.failureFlags ?? [])]) produced.add(f);
  }
  for (const r of story.rules) for (const f of r.sets ?? []) produced.add(f);
  for (const f of story.files) for (const s of f.sets ?? []) produced.add(s);
  for (const u of story.unlocks) for (const s of u.sets) produced.add(s);

  const ids = new Set<string>();
  const eggIds = new Set(story.eggs.map((e) => e.id));
  const check = (flags: string[] | undefined, where: string) => {
    for (const f of flags ?? []) if (!produced.has(f)) problems.push(`${where}: flag '${f}' nunca é produzida`);
  };
  for (const c of story.challenges) {
    if (ids.has(c.id)) problems.push(`desafio duplicado: ${c.id}`);
    ids.add(c.id);
    if (c.answers.length === 0) problems.push(`${c.id}: sem respostas`);
    for (const a of c.answers) if (normalizeAnswer(c.normalization, a) === null) problems.push(`${c.id}: resposta não normaliza`);
    check(c.requires, c.id);
    if (c.egg && !eggIds.has(c.egg)) problems.push(`${c.id}: egg inexistente ${c.egg}`);
    if ((c.hints?.length ?? 0) > 3) problems.push(`${c.id}: no máximo 3 dicas`);
    if (c.hints?.length && !c.hintTitle) problems.push(`${c.id}: dicas sem hintTitle`);
    // Dicas nunca podem conter a resposta final.
    for (const h of c.hints ?? []) {
      const hn = normalizeAnswer("phrase", h) ?? "";
      for (const a of c.answers) {
        const an = normalizeAnswer("phrase", a) ?? "";
        if (an.length >= 4 && hn.includes(an)) problems.push(`${c.id}: uma dica contém a resposta`);
      }
    }
  }
  for (const r of story.rules) {
    check(r.requires, `regra ${r.command}`);
    if (r.egg && !eggIds.has(r.egg)) problems.push(`regra ${r.command}: egg inexistente ${r.egg}`);
  }
  for (const f of story.files) {
    check(f.requires, f.path);
    check(f.readRequires, f.path);
    if (f.egg && !eggIds.has(f.egg)) problems.push(`${f.path}: egg inexistente ${f.egg}`);
    if (!f.path.startsWith("/") || f.path.includes("..")) problems.push(`${f.path}: caminho inválido`);
  }
  for (const u of story.unlocks) check(u.when, `unlock ${u.sets.join(",")}`);
  return problems;
}

/** Linhas prontas para o banco. Não contêm respostas em texto puro — só verificadores HMAC. */
export interface SeedRows {
  version: string;
  chapters: (typeof chapters.$inferInsert)[];
  challenges: (typeof challenges.$inferInsert)[];
  rules: (typeof commandRules.$inferInsert)[];
  files: (typeof virtualFiles.$inferInsert)[];
  unlocks: (typeof unlockRules.$inferInsert)[];
  eggs: (typeof easterEggs.$inferInsert)[];
}

/**
 * Converte a narrativa em linhas do banco. As respostas viram verificadores
 * HMAC aqui; o resultado nunca contém o texto das respostas.
 */
export function compileStory(story: Story, hmacKey: string): SeedRows {
  const problems = lintStory(story);
  if (problems.length) throw new Error(`Narrativa inválida:\n- ${problems.join("\n- ")}`);
  return {
    version: story.version,
    chapters: story.chapters.map((c, i) => ({ ...c, sort: i })),
    challenges: story.challenges.map((c, i) => ({
        id: c.id,
        chapterId: c.chapter,
        command: c.command,
        normalization: c.normalization,
        verifiers: [...new Set(c.answers.map((a) => answerVerifier(hmacKey, c.id, normalizeAnswer(c.normalization, a) as string)))],
        requires: c.requires ?? [],
        forbids: c.forbids ?? [],
        requiredActions: (c.requiredActions ?? []).map((a) => ({ command: a.command, args: a.args.map((x) => normalizeArgs([x])) })),
        maxFailures: c.maxFailures ?? null,
        windowSeconds: c.windowSeconds ?? 900,
        rewards: c.rewards ?? [],
        failureFlags: c.failureFlags ?? [],
        successOutput: lines(c.success),
        failureOutput: lines(c.failure),
        missingActionsOutput: lines(c.missingActions),
        events: c.events ?? [],
        eggId: c.egg ?? null,
        sort: i,
        hintTitle: c.hintTitle ?? null,
        hints: c.hints ?? [],
      })),
    rules: story.rules.map((r) => ({
        command: r.command,
        argsMatch: r.args ? [...new Set(r.args.map((a) => normalizeArgs(a.split(/\s+/))))] : null,
        mode: r.mode ?? "replace",
        requires: r.requires ?? [],
        forbids: r.forbids ?? [],
        priority: r.priority ?? 0,
        output: lines(r.output),
        setsFlags: r.sets ?? [],
        events: r.events ?? [],
        eggId: r.egg ?? null,
      })),
    files: story.files.map((f) => ({
        path: f.path,
        kind: f.kind ?? "file",
        content: f.content ?? "",
        requires: f.requires ?? [],
        forbids: f.forbids ?? [],
        readRequires: f.readRequires ?? [],
        deniedMessage: f.denied ?? null,
        priority: f.priority ?? 0,
        setsFlags: f.sets ?? [],
        eggId: f.egg ?? null,
      })),
    unlocks: story.unlocks.map((u) => ({ whenAll: u.when, sets: u.sets, output: lines(u.output), events: u.events ?? [] })),
    eggs: story.eggs.map((e) => ({ ...e })),
  };
}

/**
 * Substitui todo o conteúdo protegido em uma transação. O progresso dos
 * visitantes não é tocado.
 */
export async function writeSeedRows(db: Db, rows: SeedRows) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM challenges`);
    await tx.execute(sql`DELETE FROM command_rules`);
    await tx.execute(sql`DELETE FROM virtual_files`);
    await tx.execute(sql`DELETE FROM unlock_rules`);
    await tx.execute(sql`DELETE FROM easter_eggs`);
    await tx.execute(sql`DELETE FROM chapters`);
    await tx.insert(chapters).values(rows.chapters);
    await tx.insert(challenges).values(rows.challenges);
    await tx.insert(commandRules).values(rows.rules);
    await tx.insert(virtualFiles).values(rows.files);
    await tx.insert(unlockRules).values(rows.unlocks);
    await tx.insert(easterEggs).values(rows.eggs);
    await tx
      .insert(contentMeta)
      .values({ key: "story_version", value: rows.version })
      .onConflictDoUpdate({ target: contentMeta.key, set: { value: rows.version } });
  });
  invalidateContent();
}

export async function seedStory(db: Db, story: Story, hmacKey: string) {
  await writeSeedRows(db, compileStory(story, hmacKey));
}

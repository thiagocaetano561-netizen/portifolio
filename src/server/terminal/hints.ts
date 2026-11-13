import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Line } from "../../lib/terminal/protocol";
import { satisfied, type ChallengeRow } from "../content/repository";
import { attempts, hintUsage } from "../db/schema";
import type { BuiltinContext, BuiltinResult } from "./builtins";

/** Tempo mínimo entre níveis de dica, a menos que o jogador tenha tentado e errado. */
export const HINT_COOLDOWN_SECONDS = 120;
const FAILURES_TO_SKIP_COOLDOWN = 2;

const dim = (t: string): Line => ({ k: "dim", t });

/**
 * Enigmas abertos que possuem dicas. Só aparecem enigmas que a sessão já
 * alcançou (pré-requisitos satisfeitos): nada de capítulos futuros.
 */
function openPuzzles(ctx: BuiltinContext): ChallengeRow[] {
  const seen = new Set<string>();
  const list: ChallengeRow[] = [];
  for (const group of ctx.content.challengesByCommand.values()) {
    for (const c of group) {
      if (!c.hintTitle || c.hints.length === 0) continue;
      if (ctx.flags.has(`solved:${c.id}`) || !satisfied(ctx.flags, c.requires, c.forbids)) continue;
      if (seen.has(c.hintTitle)) continue;
      seen.add(c.hintTitle);
      list.push(c);
    }
  }
  return list.sort((a, b) => a.sort - b.sort);
}

async function usageFor(ctx: BuiltinContext, challengeId: string) {
  return ctx.tx
    .select({ level: hintUsage.level, at: hintUsage.createdAt })
    .from(hintUsage)
    .where(and(eq(hintUsage.sessionId, ctx.sessionId), eq(hintUsage.challengeId, challengeId)))
    .orderBy(hintUsage.level);
}

async function reveal(ctx: BuiltinContext, c: ChallengeRow): Promise<BuiltinResult> {
  const used = await usageFor(ctx, c.id);
  const next = used.length + 1;
  const header: Line = { k: "accent", t: `DICA · ${c.hintTitle}` };
  if (next > c.hints.length) {
    return {
      lines: [header, ...c.hints.map((h, i) => ({ k: "out" as const, t: `  ${i + 1}. ${h}` })), dim("todas as dicas deste enigma já foram liberadas.")],
    };
  }
  if (next > 1) {
    const last = used[used.length - 1]!;
    const elapsed = (Date.now() - last.at.getTime()) / 1000;
    const failures = await ctx.tx
      .select({ n: sql<number>`count(*)::int` })
      .from(attempts)
      .where(and(eq(attempts.sessionId, ctx.sessionId), eq(attempts.scope, c.command), eq(attempts.success, false), gt(attempts.createdAt, last.at)));
    const failed = Number(failures[0]?.n ?? 0);
    if (elapsed < HINT_COOLDOWN_SECONDS && failed < FAILURES_TO_SKIP_COOLDOWN) {
      const wait = Math.ceil(HINT_COOLDOWN_SECONDS - elapsed);
      return {
        lines: [
          header,
          ...c.hints.slice(0, used.length).map((h, i) => ({ k: "out" as const, t: `  ${i + 1}. ${h}` })),
          dim(`a próxima dica fica disponível em ${wait}s — ou depois de mais algumas tentativas.`),
        ],
      };
    }
  }
  await ctx.tx.insert(hintUsage).values({ sessionId: ctx.sessionId, challengeId: c.id, level: next }).onConflictDoNothing();
  return {
    lines: [
      header,
      ...c.hints.slice(0, next).map((h, i) => ({ k: (i + 1 === next ? "warn" : "out") as Line["k"], t: `  ${i + 1}. ${h}` })),
      dim(next < c.hints.length ? `dica ${next} de ${c.hints.length}. peça de novo para a próxima.` : "esta era a última dica."),
    ],
  };
}

export async function hintCommand(ctx: BuiltinContext): Promise<BuiltinResult> {
  const open = openPuzzles(ctx);
  if (open.length === 0) {
    return { lines: [dim("nenhuma investigação em andamento — ou você ainda não notou nada de estranho.")] };
  }
  const arg = ctx.args[0];
  if (arg !== undefined) {
    const n = Number(arg);
    const target = Number.isInteger(n) ? open[n - 1] : undefined;
    if (!target) return { lines: [{ k: "err", t: `hint: escolha um número entre 1 e ${open.length}` }] };
    return reveal(ctx, target);
  }
  if (open.length === 1) return reveal(ctx, open[0]!);
  const lines: Line[] = [{ k: "accent", t: "INVESTIGAÇÕES EM ANDAMENTO" }];
  for (const [i, c] of open.entries()) {
    const used = (await usageFor(ctx, c.id)).length;
    lines.push({ k: "out", t: `  ${i + 1}  ${c.hintTitle}  ${"●".repeat(used)}${"○".repeat(Math.max(0, c.hints.length - used))}` });
  }
  lines.push(dim("use: hint <número>"));
  return { lines };
}

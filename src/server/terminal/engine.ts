import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import {
  UI_SLOTS,
  type Line,
  type SignalKind,
  type SignalResponse,
  type TerminalEvent,
  type TerminalResponse,
  type UiStateResponse,
} from "../../lib/terminal/protocol";
import { getContent, satisfied, type ChallengeRow, type ProtectedContent, type RuleRow } from "../content/repository";
import type { Db } from "../db/client";
import { attempts, commandLog, discoveries, progressionEvents, sessionFlags, sessions, solves } from "../db/schema";
import { getEnv } from "../env";
import { answerVerifier, matchesAnyVerifier } from "../security/crypto";
import { normalizeAnswer, normalizeArgs, type Normalization } from "../security/normalize";
import { IP_FAILURE_LIMIT } from "../security/rate-limit";
import { BUILTINS, type BuiltinResult } from "./builtins";
import { parseInput } from "./parser";
import type { Tx } from "./types";
import { displayPath } from "./vfs";

export interface EngineResult extends TerminalResponse {
  endSession?: boolean;
}

const MAX_OUTPUT_LINES = 400;

/** Estado acumulado durante a execução de um único comando. */
class Turn {
  lines: Line[] = [];
  events: TerminalEvent[] = [];
  pendingFlags = new Set<string>();
  pendingEggs = new Set<string>();
  progress: Array<{ kind: string; ref: string }> = [];

  constructor(
    readonly tx: Tx,
    readonly sessionId: string,
    readonly flags: Set<string>,
    readonly content: ProtectedContent,
  ) {}

  push(lines: readonly Line[]) {
    for (const l of lines) this.lines.push(l);
  }

  addFlags(flags: readonly string[]) {
    for (const f of flags) if (!this.flags.has(f)) this.pendingFlags.add(f);
  }

  applyEffects(source: { setsFlags?: string[] | null; events?: TerminalEvent[] | null; eggId?: string | null }) {
    if (source.setsFlags) this.addFlags(source.setsFlags);
    if (source.events) this.events.push(...source.events);
    if (source.eggId) this.pendingEggs.add(source.eggId);
  }

  /** Persiste flags, aplica regras de desbloqueio até estabilizar e registra descobertas. */
  async commit() {
    const all = new Set([...this.flags, ...this.pendingFlags]);
    for (let guard = 0; guard < 16; guard++) {
      let changed = false;
      for (const rule of this.content.unlockRules) {
        if (!rule.whenAll.every((f) => all.has(f))) continue;
        const fresh = rule.sets.filter((f) => !all.has(f));
        if (fresh.length === 0) continue;
        for (const f of fresh) {
          all.add(f);
          this.pendingFlags.add(f);
        }
        this.push(rule.output);
        this.events.push(...rule.events);
        changed = true;
      }
      if (!changed) break;
    }

    const newFlags = [...this.pendingFlags].filter((f) => !this.flags.has(f));
    if (newFlags.length) {
      await this.tx
        .insert(sessionFlags)
        .values(newFlags.map((flag) => ({ sessionId: this.sessionId, flag })))
        .onConflictDoNothing();
      for (const f of newFlags) {
        this.flags.add(f);
        if (f.startsWith("chapter.") || f.startsWith("ending.")) this.progress.push({ kind: "flag", ref: f });
      }
      // O estado visual pode depender das flags: o cliente pede /api/ui de novo.
      if (!this.events.some((e) => e.type === "ui")) this.events.push({ type: "ui" });
    }

    for (const eggId of this.pendingEggs) {
      const egg = this.content.eggs.get(eggId);
      if (!egg) continue;
      const inserted = await this.tx
        .insert(discoveries)
        .values({ sessionId: this.sessionId, eggId })
        .onConflictDoNothing()
        .returning({ eggId: discoveries.eggId });
      if (inserted.length) {
        this.lines.push({ k: "accent", t: `✦ conquista desbloqueada: ${egg.title}` });
        this.events.push({ type: "achievement", title: egg.title });
        this.progress.push({ kind: "egg", ref: eggId });
      }
    }

    if (this.progress.length) {
      await this.tx.insert(progressionEvents).values(this.progress.map((p) => ({ sessionId: this.sessionId, ...p })));
    }
  }

  completions(): string[] {
    const names = new Set<string>();
    for (const r of this.content.completionRules) if (satisfied(this.flags, r.requires, r.forbids)) names.add(r.command);
    return [...names].sort();
  }
}

async function lockSession(tx: Tx, sessionId: string) {
  const rows = await tx
    .select({ id: sessions.id, cwd: sessions.cwd, createdAt: sessions.createdAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .for("update");
  return rows[0] ?? null;
}

async function loadFlags(tx: Tx, sessionId: string): Promise<Set<string>> {
  const rows = await tx.select({ flag: sessionFlags.flag }).from(sessionFlags).where(eq(sessionFlags.sessionId, sessionId));
  return new Set(rows.map((r) => r.flag));
}

function matchingRules(content: ProtectedContent, flags: ReadonlySet<string>, command: string, argKey: string | null): RuleRow[] {
  return (content.rulesByCommand.get(command) ?? []).filter(
    (r) => satisfied(flags, r.requires, r.forbids) && (r.argsMatch === null || (argKey !== null && r.argsMatch.includes(argKey))),
  );
}

function prompt(cwd: string) {
  return { user: "visitor", host: "tryggport", cwd: displayPath(cwd) };
}

async function recentFailures(tx: Tx, sessionId: string, scope: string, windowSeconds: number) {
  const since = new Date(Date.now() - windowSeconds * 1000);
  const rows = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(attempts)
    .where(and(eq(attempts.sessionId, sessionId), eq(attempts.scope, scope), eq(attempts.success, false), gt(attempts.createdAt, since)));
  return Number(rows[0]?.n ?? 0);
}

async function recentIpFailures(tx: Tx, ipHash: string) {
  const since = new Date(Date.now() - IP_FAILURE_LIMIT.windowSeconds * 1000);
  const rows = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(attempts)
    .where(and(eq(attempts.ipHash, ipHash), eq(attempts.success, false), gt(attempts.createdAt, since)));
  return Number(rows[0]?.n ?? 0);
}

async function missingActions(tx: Tx, sessionId: string, challenge: ChallengeRow): Promise<boolean> {
  for (const action of challenge.requiredActions) {
    const rows = await tx
      .select({ id: commandLog.id })
      .from(commandLog)
      .where(and(eq(commandLog.sessionId, sessionId), eq(commandLog.command, action.command), inArray(commandLog.args, action.args)))
      .limit(1);
    if (rows.length === 0) return true;
  }
  return false;
}

type ChallengeOutcome = "solved" | "blocked" | "no_match" | "none";

/**
 * Avalia desafios abertos para o comando. Toda verificação acontece aqui, no
 * servidor: pré-requisitos (flags), ações anteriores (histórico), limite de
 * tentativas e comparação HMAC em tempo constante.
 */
async function evaluateChallenges(turn: Turn, command: string, args: string[], ipHash: string | null): Promise<{
  outcome: ChallengeOutcome;
  candidates: ChallengeRow[];
}> {
  const candidates = (turn.content.challengesByCommand.get(command) ?? []).filter(
    (c) => satisfied(turn.flags, c.requires, c.forbids) && !turn.flags.has(`solved:${c.id}`),
  );
  if (candidates.length === 0) return { outcome: "none", candidates };

  const limited = candidates.filter((c) => c.maxFailures !== null);
  if (limited.length) {
    const maxFailures = Math.min(...limited.map((c) => c.maxFailures as number));
    const windowSeconds = Math.max(...limited.map((c) => c.windowSeconds));
    const failures = await recentFailures(turn.tx, turn.sessionId, command, windowSeconds);
    const ipFailures = ipHash ? await recentIpFailures(turn.tx, ipHash) : 0;
    if (failures >= maxFailures || ipFailures >= IP_FAILURE_LIMIT.limit) {
      turn.push([
        { k: "warn", t: `${command}: tentativas demais em pouco tempo.` },
        { k: "dim", t: "O sistema precisa de uma pausa. Releia as pistas e tente novamente em alguns minutos." },
      ]);
      return { outcome: "blocked", candidates };
    }
  }

  const key = getEnv().PUZZLE_HMAC_KEY;
  const answer = args.join(" ");
  let matched: ChallengeRow | null = null;
  for (const c of candidates) {
    const normalized = normalizeAnswer(c.normalization as Normalization, answer);
    if (normalized === null) continue;
    const candidateVerifier = answerVerifier(key, c.id, normalized);
    if (matchesAnyVerifier(candidateVerifier, c.verifiers) && !matched) matched = c;
  }

  if (!matched) return { outcome: "no_match", candidates };

  if (await missingActions(turn.tx, turn.sessionId, matched)) {
    turn.push(
      matched.missingActionsOutput.length
        ? matched.missingActionsOutput
        : [{ k: "warn", t: `${command}: algo ainda não foi feito. A sequência importa.` }],
    );
    return { outcome: "blocked", candidates };
  }

  // Idempotente: a chave primária (session_id, challenge_id) impede duplicidade.
  const inserted = await turn.tx
    .insert(solves)
    .values({ sessionId: turn.sessionId, challengeId: matched.id })
    .onConflictDoNothing()
    .returning({ id: solves.challengeId });
  if (limited.length) {
    await turn.tx.insert(attempts).values({ sessionId: turn.sessionId, scope: command, success: true, ipHash });
  }
  if (inserted.length === 0) {
    turn.push([{ k: "dim", t: "Isso já foi feito." }]);
    return { outcome: "solved", candidates };
  }
  turn.push(matched.successOutput);
  turn.addFlags([...matched.rewards, `solved:${matched.id}`]);
  turn.applyEffects({ events: matched.events, eggId: matched.eggId });
  turn.progress.push({ kind: "solve", ref: matched.id });
  return { outcome: "solved", candidates };
}

export async function runCommand(db: Db, sessionId: string, input: string, ipHash: string | null): Promise<EngineResult> {
  const content = await getContent(db);
  const parsed = parseInput(input);

  return db.transaction(async (tx) => {
    const session = await lockSession(tx, sessionId);
    if (!session) throw new Error("sessão inexistente");
    const flags = await loadFlags(tx, sessionId);
    const turn = new Turn(tx, sessionId, flags, content);
    let cwd = session.cwd;
    let entries: string[] | undefined;
    let endSession = false;

    if (!parsed.ok) {
      if (parsed.reason === "too_long") turn.push([{ k: "err", t: "entrada longa demais" }]);
      else if (parsed.reason === "syntax") turn.push([{ k: "err", t: "não foi possível interpretar o comando" }]);
      return { lines: turn.lines, prompt: prompt(cwd), completions: turn.completions() };
    }

    const { command, args } = parsed.value;
    const argKey = normalizeArgs(args);
    await tx.insert(commandLog).values({ sessionId, command, args: argKey });

    const challenge = await evaluateChallenges(turn, command, args, ipHash);

    if (challenge.outcome === "none" || challenge.outcome === "no_match") {
      const rules = matchingRules(content, flags, command, argKey);
      const replace = rules.find((r) => r.mode === "replace");
      const prepend = rules.filter((r) => r.mode === "prepend");
      const append = rules.filter((r) => r.mode === "append");
      const builtin = BUILTINS[command];

      let base: BuiltinResult | null = null;
      if (replace) {
        base = { lines: replace.output };
        turn.applyEffects(replace);
      } else if (builtin) {
        base = await builtin({ tx, sessionId, args, cwd, flags, content, sessionStartedAt: session.createdAt });
      }

      if (base) {
        for (const r of prepend) {
          turn.push(r.output);
          turn.applyEffects(r);
        }
        turn.push(base.lines);
        if (base.events) turn.events.push(...base.events);
        if (base.setsFlags || base.eggId) turn.applyEffects({ setsFlags: base.setsFlags, eggId: base.eggId });
        if (base.cwd) cwd = base.cwd;
        if (base.entries) entries = base.entries;
        if (base.endSession) endSession = true;
        for (const r of append) {
          turn.push(r.output);
          turn.applyEffects(r);
        }
      } else if (challenge.outcome === "no_match") {
        const limited = challenge.candidates.some((c) => c.maxFailures !== null);
        if (limited) await tx.insert(attempts).values({ sessionId, scope: command, success: false, ipHash });
        for (const c of challenge.candidates) if (c.failureFlags.length) turn.addFlags(c.failureFlags);
        const first = challenge.candidates[0];
        turn.push(first && first.failureOutput.length ? first.failureOutput : [{ k: "dim", t: `${command}: nada acontece.` }]);
      } else {
        // Comandos bloqueados e inexistentes recebem exatamente a mesma resposta.
        turn.push([
          { k: "err", t: `comando não encontrado: ${command}` },
          { k: "dim", t: "digite 'help' para ver os comandos disponíveis" },
        ]);
      }
    }

    if (endSession) {
      return { lines: turn.lines, events: [...turn.events, { type: "ui" }], prompt: prompt("/home/visitor"), endSession: true };
    }

    await turn.commit();
    if (cwd !== session.cwd) await tx.update(sessions).set({ cwd }).where(eq(sessions.id, sessionId));

    if (Math.random() < 0.1) {
      await tx.execute(sql`
        DELETE FROM command_log WHERE session_id = ${sessionId} AND id < (
          SELECT id FROM command_log WHERE session_id = ${sessionId} ORDER BY id DESC OFFSET 199 LIMIT 1
        )`);
    }

    return {
      lines: turn.lines.slice(0, MAX_OUTPUT_LINES),
      events: turn.events.length ? turn.events : undefined,
      prompt: prompt(cwd),
      completions: turn.completions(),
      entries,
    };
  });
}

/** Sinais de interface (cliques, sequências de teclas). O efeito é decidido apenas aqui. */
export async function runSignal(db: Db, sessionId: string, kind: SignalKind): Promise<SignalResponse> {
  const content = await getContent(db);
  return db.transaction(async (tx) => {
    const session = await lockSession(tx, sessionId);
    if (!session) throw new Error("sessão inexistente");
    const flags = await loadFlags(tx, sessionId);
    const turn = new Turn(tx, sessionId, flags, content);
    const rules = matchingRules(content, flags, `signal:${kind}`, null);
    const replace = rules.find((r) => r.mode === "replace");
    if (replace) {
      turn.push(replace.output);
      turn.applyEffects(replace);
    }
    for (const r of rules.filter((x) => x.mode === "append")) {
      turn.push(r.output);
      turn.applyEffects(r);
    }
    await turn.commit();
    return { lines: turn.lines.slice(0, 40), events: turn.events.length ? turn.events : undefined };
  });
}

/**
 * Pistas da interface visual liberadas para a sessão. Cada slot vem de uma
 * regra `ui:<slot>` no banco; somente slots cujas condições a sessão já
 * satisfez são enviados. Leitura pura: não altera progresso.
 */
export async function runUi(db: Db, sessionId: string | null): Promise<UiStateResponse> {
  if (!sessionId) return { slots: {} };
  const content = await getContent(db);
  const flags = new Set(
    (await db.select({ flag: sessionFlags.flag }).from(sessionFlags).where(eq(sessionFlags.sessionId, sessionId))).map((r) => r.flag),
  );
  const slots: UiStateResponse["slots"] = {};
  for (const slot of UI_SLOTS) {
    const rule = matchingRules(content, flags, `ui:${slot}`, null).find((r) => r.mode === "replace");
    if (rule) slots[slot] = rule.output.slice(0, 24);
  }
  return { slots };
}

/** Estado inicial do prompt para uma sessão (sem executar comandos). */
export async function sessionPrompt(db: Db, sessionId: string) {
  const rows = await db.select({ cwd: sessions.cwd }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  return prompt(rows[0]?.cwd ?? "/home/visitor");
}

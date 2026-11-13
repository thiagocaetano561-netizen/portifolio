import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Line, TerminalEvent } from "../../lib/terminal/protocol";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ------------------------------------------------------------------------- */
/* Estado dos visitantes                                                      */
/* ------------------------------------------------------------------------- */

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** SHA-256 do token do cookie. O token em si nunca é armazenado. */
  tokenHash: text("token_hash").notNull().unique(),
  cwd: text("cwd").notNull().default("/home/visitor"),
  ipHash: text("ip_hash"),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
});

export const sessionFlags = pgTable(
  "session_flags",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    flag: text("flag").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.flag] })],
);

export const commandLog = pgTable(
  "command_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    command: text("command").notNull(),
    args: text("args").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("command_log_session_idx").on(t.sessionId, t.id)],
);

export const attempts = pgTable(
  "attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    success: boolean("success").notNull(),
    ipHash: text("ip_hash"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("attempts_session_scope_idx").on(t.sessionId, t.scope, t.createdAt),
    index("attempts_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

export const solves = pgTable(
  "solves",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.challengeId] })],
);

export const discoveries = pgTable(
  "discoveries",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    eggId: text("egg_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.eggId] })],
);

export const progressionEvents = pgTable(
  "progression_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    ref: text("ref").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("progression_events_session_idx").on(t.sessionId, t.id)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/* ------------------------------------------------------------------------- */
/* Conteúdo protegido (provisionado por `npm run db:seed`)                    */
/* ------------------------------------------------------------------------- */

export interface RequiredAction {
  command: string;
  args: string[];
}

export const chapters = pgTable("chapters", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  difficulty: text("difficulty").notNull(),
  sort: integer("sort").notNull(),
});

export const challenges = pgTable(
  "challenges",
  {
    id: text("id").primaryKey(),
    chapterId: integer("chapter_id").notNull(),
    command: text("command").notNull(),
    normalization: text("normalization").notNull(),
    /** Verificadores HMAC-SHA256 das respostas aceitas. Nunca o texto da resposta. */
    verifiers: jsonb("verifiers").$type<string[]>().notNull(),
    requires: jsonb("requires").$type<string[]>().notNull(),
    forbids: jsonb("forbids").$type<string[]>().notNull(),
    requiredActions: jsonb("required_actions").$type<RequiredAction[]>().notNull(),
    maxFailures: integer("max_failures"),
    windowSeconds: integer("window_seconds").notNull().default(900),
    rewards: jsonb("rewards").$type<string[]>().notNull(),
    failureFlags: jsonb("failure_flags").$type<string[]>().notNull(),
    successOutput: jsonb("success_output").$type<Line[]>().notNull(),
    failureOutput: jsonb("failure_output").$type<Line[]>().notNull(),
    missingActionsOutput: jsonb("missing_actions_output").$type<Line[]>().notNull(),
    events: jsonb("events").$type<TerminalEvent[]>().notNull(),
    eggId: text("egg_id"),
    sort: integer("sort").notNull(),
    /** Título exibido pelo comando `hint` (só para enigmas já abertos na sessão). */
    hintTitle: text("hint_title"),
    /** Até três níveis de dica, do mais discreto ao mais explícito. Nunca a resposta. */
    hints: jsonb("hints").$type<string[]>().notNull(),
  },
  (t) => [index("challenges_command_idx").on(t.command)],
);

export const hintUsage = pgTable(
  "hint_usage",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    challengeId: text("challenge_id").notNull(),
    level: integer("level").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.challengeId, t.level] })],
);

export const virtualFiles = pgTable(
  "virtual_files",
  {
    id: serial("id").primaryKey(),
    path: text("path").notNull(),
    kind: text("kind").$type<"file" | "dir">().notNull(),
    content: text("content").notNull(),
    requires: jsonb("requires").$type<string[]>().notNull(),
    forbids: jsonb("forbids").$type<string[]>().notNull(),
    readRequires: jsonb("read_requires").$type<string[]>().notNull(),
    deniedMessage: text("denied_message"),
    priority: integer("priority").notNull().default(0),
    setsFlags: jsonb("sets_flags").$type<string[]>().notNull(),
    eggId: text("egg_id"),
  },
  (t) => [index("virtual_files_path_idx").on(t.path)],
);

export const commandRules = pgTable(
  "command_rules",
  {
    id: serial("id").primaryKey(),
    command: text("command").notNull(),
    /** Argumentos normalizados aceitos; null = qualquer argumento. */
    argsMatch: jsonb("args_match").$type<string[] | null>(),
    mode: text("mode").$type<"replace" | "append" | "prepend" | "complete">().notNull(),
    requires: jsonb("requires").$type<string[]>().notNull(),
    forbids: jsonb("forbids").$type<string[]>().notNull(),
    priority: integer("priority").notNull().default(0),
    output: jsonb("output").$type<Line[]>().notNull(),
    setsFlags: jsonb("sets_flags").$type<string[]>().notNull(),
    events: jsonb("events").$type<TerminalEvent[]>().notNull(),
    eggId: text("egg_id"),
  },
  (t) => [index("command_rules_command_idx").on(t.command)],
);

export const easterEggs = pgTable("easter_eggs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  difficulty: text("difficulty").notNull(),
  reveal: text("reveal").notNull(),
});

export const unlockRules = pgTable("unlock_rules", {
  id: serial("id").primaryKey(),
  whenAll: jsonb("when_all").$type<string[]>().notNull(),
  sets: jsonb("sets").$type<string[]>().notNull(),
  output: jsonb("output").$type<Line[]>().notNull(),
  events: jsonb("events").$type<TerminalEvent[]>().notNull(),
});

export const contentMeta = pgTable("content_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

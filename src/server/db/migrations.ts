/**
 * Migrações SQL versionadas. Nunca edite uma migração já aplicada em produção:
 * adicione uma nova entrada ao final da lista.
 */
export interface Migration {
  id: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    id: "0001_initial",
    statements: [
      `CREATE TABLE sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash text NOT NULL UNIQUE,
        cwd text NOT NULL DEFAULT '/home/visitor',
        ip_hash text,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      )`,
      `CREATE INDEX sessions_expires_idx ON sessions (expires_at)`,
      `CREATE TABLE session_flags (
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        flag text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (session_id, flag)
      )`,
      `CREATE TABLE command_log (
        id bigserial PRIMARY KEY,
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        command text NOT NULL,
        args text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX command_log_session_idx ON command_log (session_id, id)`,
      `CREATE TABLE attempts (
        id bigserial PRIMARY KEY,
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        scope text NOT NULL,
        success boolean NOT NULL,
        ip_hash text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX attempts_session_scope_idx ON attempts (session_id, scope, created_at)`,
      `CREATE INDEX attempts_ip_idx ON attempts (ip_hash, created_at)`,
      `CREATE TABLE solves (
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        challenge_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (session_id, challenge_id)
      )`,
      `CREATE TABLE discoveries (
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        egg_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (session_id, egg_id)
      )`,
      `CREATE TABLE progression_events (
        id bigserial PRIMARY KEY,
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        kind text NOT NULL,
        ref text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX progression_events_session_idx ON progression_events (session_id, id)`,
      `CREATE TABLE rate_limits (
        key text NOT NULL,
        window_start timestamptz NOT NULL,
        count integer NOT NULL DEFAULT 0,
        PRIMARY KEY (key, window_start)
      )`,
      `CREATE TABLE chapters (
        id integer PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        title text NOT NULL,
        difficulty text NOT NULL,
        sort integer NOT NULL
      )`,
      `CREATE TABLE challenges (
        id text PRIMARY KEY,
        chapter_id integer NOT NULL,
        command text NOT NULL,
        normalization text NOT NULL,
        verifiers jsonb NOT NULL,
        requires jsonb NOT NULL,
        forbids jsonb NOT NULL,
        required_actions jsonb NOT NULL,
        max_failures integer,
        window_seconds integer NOT NULL DEFAULT 900,
        rewards jsonb NOT NULL,
        failure_flags jsonb NOT NULL,
        success_output jsonb NOT NULL,
        failure_output jsonb NOT NULL,
        missing_actions_output jsonb NOT NULL,
        events jsonb NOT NULL,
        egg_id text,
        sort integer NOT NULL
      )`,
      `CREATE INDEX challenges_command_idx ON challenges (command)`,
      `CREATE TABLE virtual_files (
        id serial PRIMARY KEY,
        path text NOT NULL,
        kind text NOT NULL CHECK (kind IN ('file', 'dir')),
        content text NOT NULL,
        requires jsonb NOT NULL,
        forbids jsonb NOT NULL,
        read_requires jsonb NOT NULL,
        denied_message text,
        priority integer NOT NULL DEFAULT 0,
        sets_flags jsonb NOT NULL,
        egg_id text
      )`,
      `CREATE INDEX virtual_files_path_idx ON virtual_files (path)`,
      `CREATE TABLE command_rules (
        id serial PRIMARY KEY,
        command text NOT NULL,
        args_match jsonb,
        mode text NOT NULL CHECK (mode IN ('replace', 'append', 'prepend', 'complete')),
        requires jsonb NOT NULL,
        forbids jsonb NOT NULL,
        priority integer NOT NULL DEFAULT 0,
        output jsonb NOT NULL,
        sets_flags jsonb NOT NULL,
        events jsonb NOT NULL,
        egg_id text
      )`,
      `CREATE INDEX command_rules_command_idx ON command_rules (command)`,
      `CREATE TABLE easter_eggs (
        id text PRIMARY KEY,
        title text NOT NULL,
        difficulty text NOT NULL,
        reveal text NOT NULL
      )`,
      `CREATE TABLE unlock_rules (
        id serial PRIMARY KEY,
        when_all jsonb NOT NULL,
        sets jsonb NOT NULL,
        output jsonb NOT NULL,
        events jsonb NOT NULL
      )`,
      `CREATE TABLE content_meta (
        key text PRIMARY KEY,
        value text NOT NULL
      )`,
    ],
  },
  {
    id: "0002_hints",
    statements: [
      `ALTER TABLE challenges ADD COLUMN hint_title text`,
      `ALTER TABLE challenges ADD COLUMN hints jsonb NOT NULL DEFAULT '[]'::jsonb`,
      `CREATE TABLE hint_usage (
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        challenge_id text NOT NULL,
        level integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (session_id, challenge_id, level)
      )`,
    ],
  },
];

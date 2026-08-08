import Database from 'better-sqlite3';
import { config } from './config.js';

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  email        TEXT PRIMARY KEY,
  name         TEXT,
  company      TEXT,
  notes        TEXT,
  source       TEXT,            -- 'inbound' | 'import' | 'manual'
  is_client    INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  gmail_message_id TEXT PRIMARY KEY,
  gmail_thread_id  TEXT NOT NULL,
  direction        TEXT NOT NULL,   -- 'in' | 'out'
  from_email       TEXT NOT NULL,
  to_email         TEXT,
  subject          TEXT,
  body             TEXT,
  snippet          TEXT,
  received_at      INTEGER NOT NULL,
  processed_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(gmail_thread_id);

CREATE TABLE IF NOT EXISTS drafts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  kind               TEXT NOT NULL,          -- 'reply' | 'outreach' | 'followup'
  status             TEXT NOT NULL,          -- 'pending' | 'sent' | 'rejected' | 'failed'
  contact_email      TEXT NOT NULL,
  gmail_thread_id    TEXT,
  in_reply_to_id     TEXT,
  subject            TEXT NOT NULL,
  body               TEXT NOT NULL,
  category           TEXT,
  confidence         REAL,
  risk_flags         TEXT,                   -- JSON array
  assumptions        TEXT,                   -- JSON array
  decision           TEXT,                   -- 'auto_send' | 'hold'
  decision_reason    TEXT,
  campaign_id        INTEGER,
  error              TEXT,
  created_at         INTEGER NOT NULL,
  sent_at            INTEGER,
  sent_gmail_id      TEXT
);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS campaigns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  goal          TEXT NOT NULL,
  offer         TEXT,
  tone          TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'running' | 'paused' | 'done'
  daily_cap     INTEGER NOT NULL DEFAULT 20,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_targets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  stage         INTEGER NOT NULL DEFAULT 0,     -- 0 = first touch, 1..n = follow-ups
  status        TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'drafted' | 'sent' | 'replied' | 'stopped'
  next_action_at INTEGER,
  last_sent_at  INTEGER,
  gmail_thread_id TEXT,
  UNIQUE(campaign_id, contact_email)
);
CREATE INDEX IF NOT EXISTS idx_targets_due ON campaign_targets(status, next_action_at);

CREATE TABLE IF NOT EXISTS suppression (
  email      TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,   -- 'unsubscribed' | 'bounced' | 'complaint' | 'manual'
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS send_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  email     TEXT NOT NULL,
  kind      TEXT NOT NULL,
  sent_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_send_log_time ON send_log(sent_at);

CREATE TABLE IF NOT EXISTS audit (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      INTEGER NOT NULL,
  actor   TEXT NOT NULL,        -- 'agent' | 'human'
  action  TEXT NOT NULL,
  detail  TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit(at DESC);

CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export function now(): number {
  return Date.now();
}

export function audit(actor: 'agent' | 'human', action: string, detail?: unknown): void {
  db.prepare('INSERT INTO audit (at, actor, action, detail) VALUES (?, ?, ?, ?)').run(
    now(),
    actor,
    action,
    detail === undefined ? null : JSON.stringify(detail),
  );
}

export function kvGet(key: string): string | null {
  const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function kvSet(key: string, value: string): void {
  db.prepare(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

export function upsertContact(input: {
  email: string;
  name?: string | null;
  company?: string | null;
  notes?: string | null;
  source?: string;
  isClient?: boolean;
}): void {
  const email = input.email.toLowerCase().trim();
  const ts = now();
  db.prepare(
    `INSERT INTO contacts (email, name, company, notes, source, is_client, created_at, updated_at)
     VALUES (@email, @name, @company, @notes, @source, @isClient, @ts, @ts)
     ON CONFLICT(email) DO UPDATE SET
       name       = COALESCE(NULLIF(excluded.name, ''), contacts.name),
       company    = COALESCE(NULLIF(excluded.company, ''), contacts.company),
       notes      = COALESCE(NULLIF(excluded.notes, ''), contacts.notes),
       is_client  = MAX(contacts.is_client, excluded.is_client),
       updated_at = excluded.updated_at`,
  ).run({
    email,
    name: input.name ?? null,
    company: input.company ?? null,
    notes: input.notes ?? null,
    source: input.source ?? 'inbound',
    isClient: input.isClient ? 1 : 0,
    ts,
  });
}

export function isSuppressed(email: string): boolean {
  const row = db
    .prepare('SELECT 1 AS ok FROM suppression WHERE email = ?')
    .get(email.toLowerCase().trim());
  return Boolean(row);
}

export function suppress(email: string, reason: string): void {
  db.prepare(
    `INSERT INTO suppression (email, reason, created_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET reason = excluded.reason`,
  ).run(email.toLowerCase().trim(), reason, now());
  audit('agent', 'suppressed', { email, reason });
}

export function logSend(email: string, kind: string): void {
  db.prepare('INSERT INTO send_log (email, kind, sent_at) VALUES (?, ?, ?)').run(
    email.toLowerCase().trim(),
    kind,
    now(),
  );
}

export function sendsInLastHours(hours: number, kinds?: string[]): number {
  const since = now() - hours * 3600_000;
  if (kinds && kinds.length) {
    const placeholders = kinds.map(() => '?').join(',');
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM send_log WHERE sent_at >= ? AND kind IN (${placeholders})`,
      )
      .get(since, ...kinds) as { n: number };
    return row.n;
  }
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM send_log WHERE sent_at >= ?')
    .get(since) as { n: number };
  return row.n;
}

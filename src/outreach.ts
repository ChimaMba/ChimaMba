import { policy } from './config.js';
import { draftOutreach } from './claude.js';
import { canSendTo, outreachFooter } from './compliance.js';
import { audit, db, isSuppressed, now } from './db.js';
import { sendDraft } from './inbound.js';

interface CampaignRow {
  id: number;
  name: string;
  goal: string;
  offer: string | null;
  tone: string | null;
  status: string;
  daily_cap: number;
}

interface TargetRow {
  id: number;
  campaign_id: number;
  contact_email: string;
  stage: number;
  status: string;
  next_action_at: number | null;
  gmail_thread_id: string | null;
}

interface ContactRow {
  email: string;
  name: string | null;
  company: string | null;
  notes: string | null;
}

export interface OutreachResult {
  drafted: number;
  sent: number;
  skipped: number;
  errors: number;
}

/** Targets whose turn has come: never contacted, or a follow-up now due. */
function dueTargets(limit: number): TargetRow[] {
  return db
    .prepare(
      `SELECT t.* FROM campaign_targets t
         JOIN campaigns c ON c.id = t.campaign_id
        WHERE c.status = 'running'
          AND t.status IN ('queued')
          AND (t.next_action_at IS NULL OR t.next_action_at <= ?)
        ORDER BY COALESCE(t.next_action_at, 0) ASC
        LIMIT ?`,
    )
    .all(now(), limit) as TargetRow[];
}

export async function runOutreach(): Promise<OutreachResult> {
  const result: OutreachResult = { drafted: 0, sent: 0, skipped: 0, errors: 0 };

  if (!policy.outreach.enabled) return result;

  // One send per tick keeps the cadence human and respects the throttle.
  const targets = dueTargets(5);

  for (const target of targets) {
    try {
      const handled = await handleTarget(target, result);
      if (handled === 'sent') break; // throttle: at most one outreach send per tick
    } catch (err) {
      result.errors++;
      audit('agent', 'outreach_failed', {
        targetId: target.id,
        email: target.contact_email,
        error: String(err),
      });
    }
  }

  return result;
}

async function handleTarget(
  target: TargetRow,
  result: OutreachResult,
): Promise<'sent' | 'drafted' | 'skipped'> {
  const campaign = db
    .prepare('SELECT * FROM campaigns WHERE id = ?')
    .get(target.campaign_id) as CampaignRow | undefined;
  if (!campaign) return 'skipped';

  if (isSuppressed(target.contact_email)) {
    db.prepare(`UPDATE campaign_targets SET status = 'stopped' WHERE id = ?`).run(target.id);
    result.skipped++;
    return 'skipped';
  }

  const kind = target.stage === 0 ? 'outreach' : 'followup';
  const gate = canSendTo(target.contact_email, kind);

  // A throttle or cap is a "come back later", not a failure — leave it queued.
  if (!gate.ok) {
    result.skipped++;
    return 'skipped';
  }

  const contact =
    (db.prepare('SELECT * FROM contacts WHERE email = ?').get(target.contact_email) as
      | ContactRow
      | undefined) ?? {
      email: target.contact_email,
      name: null,
      company: null,
      notes: null,
    };

  const prior =
    target.stage > 0
      ? (db
          .prepare(
            `SELECT body FROM drafts
              WHERE contact_email = ? AND campaign_id = ? AND status = 'sent'
              ORDER BY sent_at ASC LIMIT 1`,
          )
          .get(target.contact_email, campaign.id) as { body: string } | undefined)
      : undefined;

  const drafted = await draftOutreach({
    campaignGoal: campaign.goal,
    offer: campaign.offer,
    tone: campaign.tone,
    contact,
    stage: target.stage,
    priorBody: prior?.body ?? null,
  });

  const body = `${drafted.body.trim()}${outreachFooter(target.contact_email)}`;
  const subject = drafted.subject.trim() || campaign.name;

  const info = db
    .prepare(
      `INSERT INTO drafts
        (kind, status, contact_email, gmail_thread_id, subject, body, assumptions,
         decision, decision_reason, campaign_id, created_at)
       VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      kind,
      target.contact_email,
      target.gmail_thread_id,
      subject,
      body,
      JSON.stringify(drafted.assumptions),
      policy.outreach.requireApprovalForFirstTouch && target.stage === 0 ? 'hold' : 'auto_send',
      policy.outreach.requireApprovalForFirstTouch && target.stage === 0
        ? 'First contact with a new prospect — policy requires your approval.'
        : `Campaign "${campaign.name}", stage ${target.stage}.`,
      campaign.id,
      now(),
    );

  const draftId = Number(info.lastInsertRowid);
  db.prepare(`UPDATE campaign_targets SET status = 'drafted' WHERE id = ?`).run(target.id);
  result.drafted++;

  const needsApproval = policy.outreach.requireApprovalForFirstTouch && target.stage === 0;
  if (needsApproval) {
    audit('agent', 'outreach_drafted', { draftId, to: target.contact_email, awaiting: 'approval' });
    return 'drafted';
  }

  await sendDraft(draftId);
  advanceTarget(target.id, draftId);
  result.sent++;
  return 'sent';
}

/**
 * Called after a campaign email actually goes out — schedules the next
 * follow-up, or retires the target once the sequence is exhausted.
 */
export function advanceTarget(targetId: number, draftId: number): void {
  const target = db.prepare('SELECT * FROM campaign_targets WHERE id = ?').get(targetId) as
    | TargetRow
    | undefined;
  if (!target) return;

  const sent = db.prepare('SELECT sent_gmail_id, gmail_thread_id FROM drafts WHERE id = ?').get(
    draftId,
  ) as { sent_gmail_id: string | null; gmail_thread_id: string | null } | undefined;

  const nextStage = target.stage + 1;
  const delays = policy.outreach.followUpDelaysDays;
  const delayDays = delays[target.stage];

  if (nextStage > policy.outreach.maxFollowUps || delayDays === undefined) {
    db.prepare(
      `UPDATE campaign_targets
          SET status = 'stopped', last_sent_at = ?, next_action_at = NULL, gmail_thread_id = COALESCE(?, gmail_thread_id)
        WHERE id = ?`,
    ).run(now(), sent?.gmail_thread_id ?? null, targetId);
    return;
  }

  db.prepare(
    `UPDATE campaign_targets
        SET status = 'queued', stage = ?, last_sent_at = ?, next_action_at = ?,
            gmail_thread_id = COALESCE(?, gmail_thread_id)
      WHERE id = ?`,
  ).run(
    nextStage,
    now(),
    now() + delayDays * 86400_000,
    sent?.gmail_thread_id ?? null,
    targetId,
  );
}

/* ------------------------------------------------------------------ */
/* Campaign management (called from the dashboard API)                 */
/* ------------------------------------------------------------------ */

export function createCampaign(input: {
  name: string;
  goal: string;
  offer?: string;
  tone?: string;
  dailyCap?: number;
}): number {
  const info = db
    .prepare(
      `INSERT INTO campaigns (name, goal, offer, tone, status, daily_cap, created_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
    )
    .run(
      input.name,
      input.goal,
      input.offer ?? null,
      input.tone ?? null,
      input.dailyCap ?? policy.outreach.maxNewContactsPerDay,
      now(),
    );
  const id = Number(info.lastInsertRowid);
  audit('human', 'campaign_created', { id, name: input.name });
  return id;
}

export function addTargets(
  campaignId: number,
  contacts: { email: string; name?: string; company?: string; notes?: string }[],
): { added: number; skipped: string[] } {
  const skipped: string[] = [];
  let added = 0;

  const insertContact = db.prepare(
    `INSERT INTO contacts (email, name, company, notes, source, is_client, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'import', 0, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = COALESCE(NULLIF(excluded.name,''), contacts.name),
       company = COALESCE(NULLIF(excluded.company,''), contacts.company),
       notes = COALESCE(NULLIF(excluded.notes,''), contacts.notes),
       updated_at = excluded.updated_at`,
  );
  const insertTarget = db.prepare(
    `INSERT OR IGNORE INTO campaign_targets (campaign_id, contact_email, stage, status, next_action_at)
     VALUES (?, ?, 0, 'queued', NULL)`,
  );

  for (const c of contacts) {
    const email = c.email.toLowerCase().trim();
    if (!email.includes('@')) {
      skipped.push(`${c.email} (not an email address)`);
      continue;
    }
    if (isSuppressed(email)) {
      skipped.push(`${email} (unsubscribed)`);
      continue;
    }
    const ts = now();
    insertContact.run(email, c.name ?? null, c.company ?? null, c.notes ?? null, ts, ts);
    const res = insertTarget.run(campaignId, email);
    if (res.changes > 0) added++;
    else skipped.push(`${email} (already in this campaign)`);
  }

  audit('human', 'targets_added', { campaignId, added, skipped: skipped.length });
  return { added, skipped };
}

export function setCampaignStatus(campaignId: number, status: 'running' | 'paused' | 'done'): void {
  db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run(status, campaignId);
  audit('human', 'campaign_status', { campaignId, status });
}

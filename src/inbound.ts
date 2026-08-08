import { config } from './config.js';
import { classify, draftReply } from './claude.js';
import { canSendTo, replySignature, unsubscribeUrl } from './compliance.js';
import {
  audit,
  db,
  isSuppressed,
  logSend,
  now,
  suppress,
  upsertContact,
} from './db.js';
import {
  addLabel,
  ensureLabel,
  fetchThread,
  fetchUnread,
  getRfc822MessageId,
  markRead,
  sendEmail,
} from './gmail.js';
import { decide, shouldIgnore } from './policy.js';
import type { ParsedMessage } from './types.js';

let handledLabelId: string | null = null;

async function labelFor(name: string): Promise<string> {
  if (handledLabelId) return handledLabelId;
  handledLabelId = await ensureLabel(name);
  return handledLabelId;
}

function alreadySeen(gmailMessageId: string): boolean {
  return Boolean(
    db.prepare('SELECT 1 AS ok FROM messages WHERE gmail_message_id = ?').get(gmailMessageId),
  );
}

function recordMessage(msg: ParsedMessage, direction: 'in' | 'out'): void {
  db.prepare(
    `INSERT OR IGNORE INTO messages
      (gmail_message_id, gmail_thread_id, direction, from_email, to_email, subject, body, snippet, received_at, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    msg.gmailMessageId,
    msg.gmailThreadId,
    direction,
    msg.from,
    msg.to,
    msg.subject,
    msg.body,
    msg.snippet,
    msg.receivedAt,
    now(),
  );
}

/** Someone replying "unsubscribe" / "stop" should never need a link to work. */
function looksLikeOptOut(msg: ParsedMessage): boolean {
  const text = `${msg.subject}\n${msg.body}`.toLowerCase().slice(0, 400);
  return /\b(unsubscribe|remove me|stop emailing|take me off|opt[- ]?out|do not contact)\b/.test(
    text,
  );
}

/**
 * If a cold contact replies, halt their campaign sequence immediately.
 * Nothing is more damaging than a follow-up that arrives after a real answer.
 */
function stopCampaignsFor(email: string, threadId: string): void {
  const updated = db
    .prepare(
      `UPDATE campaign_targets
          SET status = 'replied', next_action_at = NULL, gmail_thread_id = COALESCE(gmail_thread_id, ?)
        WHERE contact_email = ? AND status IN ('queued','drafted','sent')`,
    )
    .run(threadId, email.toLowerCase());
  if (updated.changes > 0) {
    audit('agent', 'campaign_stopped_on_reply', { email, targets: updated.changes });
  }
}

export interface ProcessResult {
  processed: number;
  autoSent: number;
  held: number;
  ignored: number;
  errors: number;
}

export async function processInbox(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, autoSent: 0, held: 0, ignored: 0, errors: 0 };

  let unread: ParsedMessage[];
  try {
    unread = await fetchUnread();
  } catch (err) {
    audit('agent', 'inbox_fetch_failed', { error: String(err) });
    result.errors++;
    return result;
  }

  for (const msg of unread) {
    if (alreadySeen(msg.gmailMessageId)) continue;
    recordMessage(msg, 'in');
    result.processed++;

    try {
      await handleOne(msg, result);
    } catch (err) {
      result.errors++;
      audit('agent', 'process_failed', {
        gmailMessageId: msg.gmailMessageId,
        from: msg.from,
        error: String(err),
      });
    }
  }

  return result;
}

async function handleOne(msg: ParsedMessage, result: ProcessResult): Promise<void> {
  // 1. Opt-outs are honoured before anything else, including classification.
  if (looksLikeOptOut(msg)) {
    suppress(msg.from, 'unsubscribed');
    stopCampaignsFor(msg.from, msg.gmailThreadId);
    await markRead(msg.gmailMessageId);
    result.ignored++;
    return;
  }

  stopCampaignsFor(msg.from, msg.gmailThreadId);

  // 2. Cheap structural filters before we spend a token.
  const ignore = shouldIgnore(msg);
  if (ignore.ignore) {
    audit('agent', 'ignored', { from: msg.from, subject: msg.subject, reason: ignore.reason });
    result.ignored++;
    return;
  }

  if (isSuppressed(msg.from)) {
    audit('agent', 'ignored', { from: msg.from, reason: 'suppressed' });
    result.ignored++;
    return;
  }

  const thread = await fetchThread(msg.gmailThreadId);
  const priorFromOwner = thread.some((m) => m.from === config.ownerEmail);

  // 3. Classify.
  const classification = await classify(msg, thread);

  upsertContact({
    email: msg.from,
    name: classification.contact_name ?? msg.fromName,
    company: classification.contact_company,
    source: 'inbound',
    isClient: priorFromOwner,
  });

  if (!classification.is_from_a_human) {
    audit('agent', 'ignored', { from: msg.from, reason: 'non-human sender' });
    result.ignored++;
    await markRead(msg.gmailMessageId);
    return;
  }

  // 4. Draft.
  const contact = db
    .prepare('SELECT notes FROM contacts WHERE email = ?')
    .get(msg.from) as { notes: string | null } | undefined;

  const drafted = await draftReply({
    msg,
    thread,
    classification,
    contactNotes: contact?.notes ?? null,
  });

  const body = `${drafted.body.trim()}${replySignature()}`;

  // 5. Decide.
  const decision = decide(classification, body);
  const gate = decision.action === 'auto_send' ? canSendTo(msg.from, 'reply') : { ok: true, reason: '' };

  const finalAction = decision.action === 'auto_send' && !gate.ok ? 'hold' : decision.action;
  const finalReason = decision.action === 'auto_send' && !gate.ok ? gate.reason : decision.reason;

  if (finalAction === 'ignore') {
    audit('agent', 'ignored', { from: msg.from, reason: finalReason });
    result.ignored++;
    await markRead(msg.gmailMessageId);
    return;
  }

  const subject = drafted.subject.trim() || `Re: ${msg.subject}`;

  const info = db
    .prepare(
      `INSERT INTO drafts
        (kind, status, contact_email, gmail_thread_id, in_reply_to_id, subject, body,
         category, confidence, risk_flags, assumptions, decision, decision_reason, created_at)
       VALUES ('reply', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      msg.from,
      msg.gmailThreadId,
      msg.gmailMessageId,
      subject,
      body,
      classification.category,
      classification.confidence,
      JSON.stringify(classification.risk_flags),
      JSON.stringify(drafted.assumptions),
      finalAction,
      finalReason,
      now(),
    );

  const draftId = Number(info.lastInsertRowid);

  if (finalAction === 'hold') {
    result.held++;
    audit('agent', 'held_for_review', {
      draftId,
      from: msg.from,
      category: classification.category,
      reason: finalReason,
    });
    try {
      await addLabel(msg.gmailMessageId, await labelFor('Inbox Agent/Needs review'));
    } catch {
      /* labelling is a nicety, not worth failing the run over */
    }
    return;
  }

  // 6. Auto-send.
  await sendDraft(draftId);
  result.autoSent++;
  await markRead(msg.gmailMessageId);
}

/** Sends a pending draft by id. Used by the auto path and by the dashboard. */
export async function sendDraft(draftId: number): Promise<void> {
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as
    | {
        id: number;
        kind: 'reply' | 'outreach' | 'followup';
        status: string;
        contact_email: string;
        gmail_thread_id: string | null;
        in_reply_to_id: string | null;
        subject: string;
        body: string;
      }
    | undefined;

  if (!draft) throw new Error(`Draft ${draftId} not found.`);
  if (draft.status === 'sent') return;

  const gate = canSendTo(draft.contact_email, draft.kind);
  if (!gate.ok) {
    db.prepare('UPDATE drafts SET status = ?, error = ? WHERE id = ?').run(
      'failed',
      gate.reason,
      draftId,
    );
    throw new Error(gate.reason);
  }

  const inReplyTo = draft.in_reply_to_id
    ? await getRfc822MessageId(draft.in_reply_to_id).catch(() => null)
    : null;

  try {
    const sent = await sendEmail({
      to: draft.contact_email,
      subject: draft.subject,
      body: draft.body,
      threadId: draft.gmail_thread_id,
      inReplyTo,
      // Replies to people who wrote to you first are not bulk commercial mail
      // and don't carry an unsubscribe header. Cold mail always does.
      unsubscribeUrl: draft.kind === 'reply' ? null : unsubscribeUrl(draft.contact_email),
    });

    db.prepare(
      'UPDATE drafts SET status = ?, sent_at = ?, sent_gmail_id = ?, error = NULL WHERE id = ?',
    ).run('sent', now(), sent.id, draftId);

    logSend(draft.contact_email, draft.kind);
    audit('agent', 'sent', {
      draftId,
      kind: draft.kind,
      to: draft.contact_email,
      subject: draft.subject,
    });
  } catch (err) {
    db.prepare('UPDATE drafts SET status = ?, error = ? WHERE id = ?').run(
      'failed',
      String(err),
      draftId,
    );
    throw err;
  }
}

import crypto from 'node:crypto';
import { config, policy } from './config.js';
import { db, isSuppressed, sendsInLastHours } from './db.js';

/* ------------------------------------------------------------------ */
/* Unsubscribe                                                         */
/* ------------------------------------------------------------------ */

export function unsubscribeToken(email: string): string {
  const normalized = email.toLowerCase().trim();
  const sig = crypto
    .createHmac('sha256', config.appSecret)
    .update(normalized)
    .digest('base64url')
    .slice(0, 24);
  return `${Buffer.from(normalized).toString('base64url')}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let email: string;
  try {
    email = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = unsubscribeToken(email).split('.')[1] ?? '';
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return email;
}

export function unsubscribeUrl(email: string): string {
  return `${config.publicBaseUrl}/u/${unsubscribeToken(email)}`;
}

/**
 * CAN-SPAM (US) requires commercial email to carry a working opt-out and a valid
 * physical postal address. GDPR/PECR (EU/UK) additionally require a lawful basis
 * for contacting the person at all — that part is your call, not the code's.
 * This footer covers the mechanical requirements for outreach mail only; replies
 * to people who wrote to you first are not commercial bulk mail and don't get it.
 */
export function outreachFooter(email: string): string {
  const parts = ['', '—', policy.voice.signature];
  if (config.postalAddress) parts.push('', config.postalAddress);
  parts.push('', `Don't want these? Unsubscribe: ${unsubscribeUrl(email)}`);
  return parts.join('\n');
}

export function replySignature(): string {
  return `\n\n${policy.voice.signature}`;
}

/* ------------------------------------------------------------------ */
/* Gates                                                               */
/* ------------------------------------------------------------------ */

export interface GateResult {
  ok: boolean;
  reason: string;
}

export function inQuietHours(at = new Date()): boolean {
  const { start, end, timezone } = policy.autoSend.quietHours;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).format(at),
  );
  // Window wraps midnight when start > end (e.g. 22 -> 7).
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/** Checks that apply to every automated send, reply or outreach. */
export function canSendTo(email: string, kind: 'reply' | 'outreach' | 'followup'): GateResult {
  const normalized = email.toLowerCase().trim();

  if (!normalized || !normalized.includes('@')) {
    return { ok: false, reason: 'Not a valid email address.' };
  }
  if (normalized === config.ownerEmail) {
    return { ok: false, reason: 'Refusing to email yourself.' };
  }
  if (isSuppressed(normalized)) {
    return { ok: false, reason: 'Address is on the suppression list.' };
  }

  if (kind === 'reply') {
    const today = sendsInLastHours(24, ['reply']);
    if (today >= policy.autoSend.maxPerDay) {
      return {
        ok: false,
        reason: `Daily auto-reply cap reached (${policy.autoSend.maxPerDay}).`,
      };
    }
    if (inQuietHours()) {
      return { ok: false, reason: 'Inside configured quiet hours.' };
    }
    return { ok: true, reason: '' };
  }

  // Outreach and follow-ups: stricter.
  if (!policy.outreach.enabled) {
    return { ok: false, reason: 'Outreach is disabled in policy.json.' };
  }
  if (!config.postalAddress) {
    return {
      ok: false,
      reason:
        'POSTAL_ADDRESS is not set. Commercial email legally requires a physical address in the footer.',
    };
  }
  if (inQuietHours()) {
    return { ok: false, reason: 'Inside configured quiet hours.' };
  }

  const sentToday = sendsInLastHours(24, ['outreach', 'followup']);
  if (sentToday >= policy.outreach.maxNewContactsPerDay) {
    return {
      ok: false,
      reason: `Daily outreach cap reached (${policy.outreach.maxNewContactsPerDay}). Sending more risks the account being flagged.`,
    };
  }

  const lastRow = db
    .prepare(
      `SELECT sent_at FROM send_log WHERE kind IN ('outreach','followup') ORDER BY sent_at DESC LIMIT 1`,
    )
    .get() as { sent_at: number } | undefined;
  if (lastRow) {
    const gapMs = Date.now() - lastRow.sent_at;
    const requiredMs = policy.outreach.minSecondsBetweenSends * 1000;
    if (gapMs < requiredMs) {
      return {
        ok: false,
        reason: `Throttled — ${Math.ceil((requiredMs - gapMs) / 1000)}s until the next outreach send is allowed.`,
      };
    }
  }

  const alreadyContacted = db
    .prepare(
      `SELECT 1 AS ok FROM send_log WHERE email = ? AND kind IN ('outreach','followup') AND sent_at >= ?`,
    )
    .get(normalized, Date.now() - 90 * 86400_000);
  if (alreadyContacted && kind === 'outreach') {
    return { ok: false, reason: 'Already cold-emailed this address in the last 90 days.' };
  }

  return { ok: true, reason: '' };
}

/** A random pause so sends don't land on a machine-perfect cadence. */
export function jitterMs(): number {
  return Math.floor(Math.random() * policy.outreach.jitterSeconds * 1000);
}

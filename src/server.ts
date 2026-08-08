import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ROOT, config, policy } from './config.js';
import { audit, db, now, suppress } from './db.js';
import { verifyUnsubscribeToken } from './compliance.js';
import { sendDraft } from './inbound.js';
import { addTargets, advanceTarget, createCampaign, setCampaignStatus } from './outreach.js';
import { makeOAuthClient, saveTokens } from './gmail.js';

export function buildServer(triggerRun: () => Promise<unknown>) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  /* ---------------- auth ---------------- */

  const sessionCookie = 'inbox_agent_session';

  function expectedToken(): string {
    return crypto
      .createHmac('sha256', config.appSecret)
      .update(`dashboard:${config.dashboardPassword}`)
      .digest('base64url');
  }

  function readCookie(req: Request, name: string): string | null {
    const raw = req.headers.cookie;
    if (!raw) return null;
    for (const part of raw.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === name) return decodeURIComponent(rest.join('='));
    }
    return null;
  }

  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!config.dashboardPassword) return next(); // auth disabled
    if (readCookie(req, sessionCookie) === expectedToken()) return next();
    res.status(401).json({ error: 'unauthorized' });
  }

  app.post('/api/login', (req, res) => {
    if (!config.dashboardPassword) return res.json({ ok: true });
    const supplied = String(req.body?.password ?? '');
    const a = Buffer.from(supplied);
    const b = Buffer.from(config.dashboardPassword);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(401).json({ error: 'Wrong password.' });
    res.setHeader(
      'Set-Cookie',
      `${sessionCookie}=${expectedToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
    );
    res.json({ ok: true });
  });

  app.get('/api/session', (req, res) => {
    res.json({
      authRequired: Boolean(config.dashboardPassword),
      authed: !config.dashboardPassword || readCookie(req, sessionCookie) === expectedToken(),
    });
  });

  /* ---------------- public: unsubscribe ---------------- */

  const unsubPage = (title: string, message: string) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:34rem;margin:18vh auto;padding:0 1.5rem;color:#1a1a1a}
h1{font-size:1.3rem;margin:0 0 .5rem}p{color:#555;margin:0}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}p{color:#aaa}}
</style></head><body><h1>${title}</h1><p>${message}</p></body></html>`;

  app.get('/u/:token', (req, res) => {
    const email = verifyUnsubscribeToken(req.params.token);
    if (!email) {
      res.status(400).send(unsubPage('Invalid link', 'That unsubscribe link is not valid.'));
      return;
    }
    suppress(email, 'unsubscribed');
    db.prepare(
      `UPDATE campaign_targets SET status='stopped', next_action_at=NULL WHERE contact_email = ?`,
    ).run(email);
    res.send(
      unsubPage(
        'Unsubscribed',
        `<strong>${email}</strong> has been removed. You will not receive further emails from ${config.ownerName}.`,
      ),
    );
  });

  // One-click unsubscribe (RFC 8058) — mail clients POST here.
  app.post('/u/:token', (req, res) => {
    const email = verifyUnsubscribeToken(req.params.token);
    if (!email) return res.status(400).end();
    suppress(email, 'unsubscribed');
    db.prepare(
      `UPDATE campaign_targets SET status='stopped', next_action_at=NULL WHERE contact_email = ?`,
    ).run(email);
    res.status(200).end();
  });

  /* ---------------- public: oauth callback ---------------- */

  app.get('/oauth/callback', async (req, res) => {
    const code = String(req.query.code ?? '');
    if (!code) return res.status(400).send(unsubPage('Missing code', 'No authorisation code.'));
    try {
      const client = makeOAuthClient();
      const { tokens } = await client.getToken(code);
      saveTokens(tokens);
      res.send(
        unsubPage('Gmail connected', 'You can close this tab and restart the agent.'),
      );
    } catch (err) {
      res.status(500).send(unsubPage('Connection failed', String(err)));
    }
  });

  /* ---------------- api ---------------- */

  app.get('/api/state', requireAuth, (_req, res) => {
    const pending = db
      .prepare(
        `SELECT id, kind, contact_email, subject, body, category, confidence, risk_flags,
                assumptions, decision, decision_reason, campaign_id, created_at
           FROM drafts WHERE status = 'pending' ORDER BY created_at DESC LIMIT 100`,
      )
      .all();

    const recent = db
      .prepare(
        `SELECT id, kind, status, contact_email, subject, decision, decision_reason, error,
                created_at, sent_at
           FROM drafts WHERE status != 'pending' ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 50`,
      )
      .all();

    const dayAgo = now() - 86400_000;
    const stats = {
      pending: (db.prepare(`SELECT COUNT(*) n FROM drafts WHERE status='pending'`).get() as { n: number }).n,
      sent24h: (db.prepare(`SELECT COUNT(*) n FROM send_log WHERE sent_at >= ?`).get(dayAgo) as { n: number }).n,
      autoSent24h: (
        db
          .prepare(
            `SELECT COUNT(*) n FROM drafts WHERE status='sent' AND decision='auto_send' AND sent_at >= ?`,
          )
          .get(dayAgo) as { n: number }
      ).n,
      outreach24h: (
        db
          .prepare(`SELECT COUNT(*) n FROM send_log WHERE kind IN ('outreach','followup') AND sent_at >= ?`)
          .get(dayAgo) as { n: number }
      ).n,
      contacts: (db.prepare(`SELECT COUNT(*) n FROM contacts`).get() as { n: number }).n,
      suppressed: (db.prepare(`SELECT COUNT(*) n FROM suppression`).get() as { n: number }).n,
    };

    const campaigns = db
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM campaign_targets t WHERE t.campaign_id=c.id) AS total,
                (SELECT COUNT(*) FROM campaign_targets t WHERE t.campaign_id=c.id AND t.status='queued') AS queued,
                (SELECT COUNT(*) FROM campaign_targets t WHERE t.campaign_id=c.id AND t.status='replied') AS replied
           FROM campaigns c ORDER BY c.created_at DESC`,
      )
      .all();

    res.json({
      pending,
      recent,
      stats,
      campaigns,
      policy: {
        autonomy: policy.autonomy,
        autoSendCategories: policy.autoSend.categories,
        outreachEnabled: policy.outreach.enabled,
        requireApprovalForFirstTouch: policy.outreach.requireApprovalForFirstTouch,
        postalAddressSet: Boolean(config.postalAddress),
      },
      owner: { email: config.ownerEmail, name: config.ownerName },
    });
  });

  app.put('/api/drafts/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const subject = String(req.body?.subject ?? '');
    const body = String(req.body?.body ?? '');
    if (!subject.trim() || !body.trim()) {
      return res.status(400).json({ error: 'Subject and body are both required.' });
    }
    db.prepare(`UPDATE drafts SET subject = ?, body = ? WHERE id = ? AND status = 'pending'`).run(
      subject,
      body,
      id,
    );
    audit('human', 'draft_edited', { id });
    res.json({ ok: true });
  });

  app.post('/api/drafts/:id/approve', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
      await sendDraft(id);
      const target = db
        .prepare(
          `SELECT t.id FROM campaign_targets t
             JOIN drafts d ON d.contact_email = t.contact_email AND d.campaign_id = t.campaign_id
            WHERE d.id = ?`,
        )
        .get(id) as { id: number } | undefined;
      if (target) advanceTarget(target.id, id);
      audit('human', 'draft_approved', { id });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  app.post('/api/drafts/:id/reject', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    db.prepare(`UPDATE drafts SET status='rejected' WHERE id = ? AND status='pending'`).run(id);
    audit('human', 'draft_rejected', { id, note: req.body?.note ?? null });
    res.json({ ok: true });
  });

  app.post('/api/campaigns', requireAuth, (req, res) => {
    const { name, goal, offer, tone, dailyCap } = req.body ?? {};
    if (!name?.trim() || !goal?.trim()) {
      return res.status(400).json({ error: 'name and goal are required.' });
    }
    const id = createCampaign({ name, goal, offer, tone, dailyCap });
    res.json({ id });
  });

  app.post('/api/campaigns/:id/targets', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts : [];
    if (!contacts.length) return res.status(400).json({ error: 'No contacts supplied.' });
    res.json(addTargets(id, contacts));
  });

  app.post('/api/campaigns/:id/status', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status ?? '');
    if (!['running', 'paused', 'done'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    if (status === 'running' && !config.postalAddress) {
      return res.status(400).json({
        error:
          'Set POSTAL_ADDRESS in .env before running outreach — commercial email legally requires a physical address.',
      });
    }
    setCampaignStatus(id, status as 'running' | 'paused' | 'done');
    res.json({ ok: true });
  });

  app.post('/api/suppress', requireAuth, (req, res) => {
    const email = String(req.body?.email ?? '').toLowerCase().trim();
    if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email.' });
    suppress(email, String(req.body?.reason ?? 'manual'));
    res.json({ ok: true });
  });

  app.post('/api/run-now', requireAuth, async (_req, res) => {
    try {
      const result = await triggerRun();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/audit', requireAuth, (_req, res) => {
    res.json(db.prepare('SELECT * FROM audit ORDER BY at DESC LIMIT 200').all());
  });

  /* ---------------- static ---------------- */

  app.use(express.static(path.join(ROOT, 'web')));

  return app;
}

import { config } from './config.js';
import { audit } from './db.js';
import { processInbox } from './inbound.js';
import { runOutreach } from './outreach.js';
import { hasTokens } from './gmail.js';

let running = false;

export interface TickResult {
  inbox: Awaited<ReturnType<typeof processInbox>> | null;
  outreach: Awaited<ReturnType<typeof runOutreach>> | null;
  skipped?: string;
}

/**
 * One pass: read the inbox, then advance any outreach that is due.
 * Guarded so a slow Claude call can never let two passes overlap and
 * double-send the same draft.
 */
export async function tick(): Promise<TickResult> {
  if (running) return { inbox: null, outreach: null, skipped: 'A run is already in progress.' };
  if (!hasTokens()) {
    return { inbox: null, outreach: null, skipped: 'Gmail is not connected — run `npm run auth`.' };
  }

  running = true;
  const started = Date.now();
  try {
    const inbox = await processInbox();
    const outreach = await runOutreach();

    if (inbox.processed || outreach.drafted || outreach.sent || inbox.errors) {
      console.log(
        `[tick ${new Date().toISOString()}] ` +
          `inbox: ${inbox.processed} seen, ${inbox.autoSent} auto-sent, ${inbox.held} held, ` +
          `${inbox.ignored} ignored, ${inbox.errors} errors · ` +
          `outreach: ${outreach.drafted} drafted, ${outreach.sent} sent ` +
          `(${Date.now() - started}ms)`,
      );
    }

    return { inbox, outreach };
  } catch (err) {
    audit('agent', 'tick_failed', { error: String(err) });
    console.error('[tick] failed:', err);
    return { inbox: null, outreach: null, skipped: String(err) };
  } finally {
    running = false;
  }
}

export function startWorker(): NodeJS.Timeout {
  const intervalMs = Math.max(30, config.pollIntervalSeconds) * 1000;
  console.log(`Worker polling every ${intervalMs / 1000}s.`);
  void tick();
  return setInterval(() => void tick(), intervalMs);
}

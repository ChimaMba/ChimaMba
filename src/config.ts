import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in — see docs/SETUP.md.`,
    );
  }
  return v.trim();
}

function optional(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

export interface Policy {
  autonomy: 'auto_routine' | 'draft_all' | 'auto_all';
  model: string;
  classifyEffort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  draftEffort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  autoSend: {
    minConfidence: number;
    categories: string[];
    blockIfBodyMatches: string[];
    maxPerDay: number;
    quietHours: { start: number; end: number; timezone: string };
  };
  voice: {
    signOff: string;
    notes: string[];
    signature: string;
  };
  outreach: {
    enabled: boolean;
    maxNewContactsPerDay: number;
    minSecondsBetweenSends: number;
    jitterSeconds: number;
    followUpDelaysDays: number[];
    maxFollowUps: number;
    requireApprovalForFirstTouch: boolean;
    stopOnReply: boolean;
  };
  ignore: {
    fromPatterns: string[];
    subjectPatterns: string[];
    gmailLabelsToSkip: string[];
  };
}

const policyPath = path.join(ROOT, 'config', 'policy.json');

export function loadPolicy(): Policy {
  const raw = fs.readFileSync(policyPath, 'utf8');
  return JSON.parse(raw) as Policy;
}

export const policy = loadPolicy();

export const config = {
  // Validated lazily in claude.ts so `npm run auth` works before you have a key.
  anthropicApiKey: optional('ANTHROPIC_API_KEY'),
  google: {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    redirectUri: optional('GOOGLE_REDIRECT_URI', 'http://localhost:8787/oauth/callback'),
  },
  port: Number(optional('PORT', '8787')),
  publicBaseUrl: optional('PUBLIC_BASE_URL', 'http://localhost:8787').replace(/\/+$/, ''),
  appSecret: required('APP_SECRET'),
  dashboardPassword: optional('DASHBOARD_PASSWORD'),
  ownerEmail: required('OWNER_EMAIL').toLowerCase(),
  ownerName: optional('OWNER_NAME', 'Me'),
  postalAddress: optional('POSTAL_ADDRESS'),
  pollIntervalSeconds: Number(optional('POLL_INTERVAL_SECONDS', '120')),
  dataDir: path.join(ROOT, 'data'),
  tokenPath: path.join(ROOT, 'data', 'token.json'),
  dbPath: path.join(ROOT, 'data', 'inbox-agent.db'),
};

fs.mkdirSync(config.dataDir, { recursive: true });

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
];

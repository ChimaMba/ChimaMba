# Setup

About fifteen minutes, most of it clicking through Google Cloud. Do the steps in
order — step 3 depends on values from step 2.

---

## 1. Install

```bash
git clone <this repo>
cd ChimaMba
npm install
```

Node 20 or newer.

## 2. Get a Claude API key

1. Go to <https://console.claude.com/settings/keys>
2. Create a key and copy it. It starts with `sk-ant-`.
3. Add a payment method — this is a paid API, separate from any Claude
   subscription you may already have.

## 3. Create Google OAuth credentials

This is the fiddly part. You're creating an app that can access *your own*
Gmail, so you never have to publish or verify it.

1. Go to <https://console.cloud.google.com/> and create a project — call it
   anything, e.g. `inbox-agent`.
2. **Enable the Gmail API.** APIs & Services → Library → search "Gmail API" →
   Enable.
3. **Configure the consent screen.** APIs & Services → OAuth consent screen.
   - User type: **External**
   - App name, your email for support and developer contact — the rest can stay
     blank.
   - On the **Test users** step, add your own Gmail address. This is the step
     people miss; without it, sign-in fails with "app has not completed
     verification".
   - Leave it in **Testing** status. Do not publish it. A testing-status app
     works indefinitely for its listed test users.
4. **Create the credential.** APIs & Services → Credentials → Create
   Credentials → **OAuth client ID**.
   - Application type: **Web application**
   - Authorized redirect URIs → Add: `http://localhost:8787/oauth/callback`
     (exactly this — a trailing slash will break it)
   - Create, then copy the **Client ID** and **Client secret**.

## 4. Configure

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable                                | What to put                                                    |
| --------------------------------------- | -------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                     | The `sk-ant-…` key from step 2                                  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From step 3                                                 |
| `OWNER_EMAIL`                           | The Gmail address the agent reads and sends from                |
| `OWNER_NAME`                            | The name that appears in the From header                        |
| `APP_SECRET`                            | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DASHBOARD_PASSWORD`                    | Set one if this will ever be reachable from outside your machine |
| `POSTAL_ADDRESS`                        | Required **only** for outreach — see below                      |

### About `POSTAL_ADDRESS`

Commercial email is legally required to carry a valid physical postal address
(CAN-SPAM in the US, and equivalents elsewhere). Campaigns will refuse to send
until this is set. Replies to people who emailed you first are not commercial
bulk mail and don't need it.

If you work from home and don't want to publish your address, a registered
business address or a mailbox service is the normal answer. Making one up is
not — it's the single easiest way to turn a compliance formality into an actual
violation.

## 5. Connect Gmail

```bash
npm run auth
```

It prints a Google URL. Open it in a browser signed in as `OWNER_EMAIL`, accept
the scopes, and you'll be redirected back to a "Gmail connected" page. The token
is written to `data/token.json`.

You'll see an "unverified app" warning — that's expected for a testing-status
app. Click **Advanced → Go to (app name)**.

## 6. Check the configuration

```bash
npm run check
```

This runs offline — no Gmail, no Claude calls. It validates your policy file,
compiles every regex, and runs the send/hold decision against a set of cases
including several that *should* be blocked. Run it again any time you edit
`config/policy.json`.

## 7. Start

```bash
npm run dev
```

Open <http://localhost:8787>.

---

## First week

Start cautious and loosen once you trust it.

**Day one:** open `config/policy.json` and set `"autonomy": "draft_all"`. Nothing
sends without you. Watch the review queue for a few days and read what it would
have sent.

**When the drafts read like you:** switch to `"auto_routine"`. Now scheduling
and acknowledgments go out on their own; everything else still waits.

**Tune the voice.** `voice.notes` in `policy.json` is where the agent's register
lives. Adding a specific instruction there works better than editing individual
drafts forever — if you find yourself making the same correction twice, it
belongs in `voice.notes`.

**Tune the boundary.** If something keeps getting held that you're happy to
automate, add its category to `autoSend.categories`. If something got sent that
shouldn't have, add a pattern to `autoSend.blockIfBodyMatches` and raise
`minConfidence`. Run `npm run check` after either.

## Running outreach

1. Set `POSTAL_ADDRESS` in `.env` and restart.
2. Dashboard → **Outreach** → create a campaign. Be specific in the goal — it's
   the main input to what gets written.
3. Paste contacts, one per line: `email, name, company, note`. The note is what
   makes a cold email land, so use it. The agent is instructed never to invent a
   detail about someone; with no note you get an honest generic email rather
   than a fake compliment.
4. **Start sending.** With `requireApprovalForFirstTouch` on (the default),
   first-contact emails appear in the review queue rather than sending. Approve
   them individually until you trust the output.
5. Follow-ups go out automatically on the `followUpDelaysDays` schedule and stop
   the instant someone replies.

Sending pace is deliberately slow — one email per polling cycle, a minimum gap
between sends, randomised jitter, and a daily cap. Don't raise the cap to get
through a list faster; volume from a personal Gmail account is exactly what
triggers spam filtering, and a burned sending domain takes months to recover.

---

## Running it always-on

The agent only works while the process is running. On a Mac or Linux box that
sleeps, it'll catch up when it wakes.

For genuinely continuous operation, put it on a small VPS ($5/month is plenty):

```bash
npm run build
# then run `npm start` under a process manager
```

Use systemd, pm2, or a Docker restart policy. Set `PUBLIC_BASE_URL` to the
box's real URL so unsubscribe links work for recipients, put it behind HTTPS,
and set `DASHBOARD_PASSWORD`.

## Troubleshooting

**"app has not completed verification"** — your Gmail address isn't in the Test
users list on the OAuth consent screen. Step 3.3.

**"redirect_uri_mismatch"** — the URI in Google Cloud doesn't byte-match
`GOOGLE_REDIRECT_URI`. Watch for a trailing slash or `https` vs `http`.

**Google didn't return a refresh token** — you've authorised this app before.
Revoke it at <https://myaccount.google.com/permissions> and run `npm run auth`
again.

**Nothing is happening** — the agent only looks at *unread* mail in the inbox.
Anything already read is skipped. Click "Check inbox now" to force a pass.

**Everything is being held** — that's `auto_routine` working. The reason is on
each card. If it's consistently the confidence threshold, lower
`autoSend.minConfidence` a little; if it's the category, add it to
`autoSend.categories`.

**Port 8787 already in use** — another copy is running, or something else has
the port. Change `PORT` in `.env` (and the redirect URI in Google Cloud to
match).

## Backups

`data/` holds the Gmail token and every email the agent has processed. Losing it
means re-running `npm run auth` and re-importing contacts. Back it up
somewhere encrypted; never commit it.

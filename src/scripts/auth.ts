/**
 * One-time Gmail connection.
 *
 *   npm run auth
 *
 * Opens a local listener on the redirect URI, prints a Google consent URL,
 * and writes the resulting refresh token to data/token.json.
 */
import http from 'node:http';
import { config } from '../config.js';
import { authUrl, makeOAuthClient, saveTokens } from '../gmail.js';

const client = makeOAuthClient();
const url = new URL(config.google.redirectUri);
const port = Number(url.port || 80);
const callbackPath = url.pathname;

const page = (title: string, body: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:32rem;margin:18vh auto;padding:0 1.5rem}
h1{font-size:1.25rem}p{color:#555}</style></head>
<body><h1>${title}</h1><p>${body}</p></body></html>`;

const server = http.createServer(async (req, res) => {
  const incoming = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (incoming.pathname !== callbackPath) {
    res.writeHead(404).end();
    return;
  }

  const error = incoming.searchParams.get('error');
  if (error) {
    res.writeHead(400, { 'content-type': 'text/html' });
    res.end(page('Authorisation denied', error));
    console.error(`\n✗ Google returned: ${error}\n`);
    server.close();
    process.exit(1);
  }

  const code = incoming.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'content-type': 'text/html' });
    res.end(page('Missing code', 'No authorisation code in the callback.'));
    return;
  }

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      console.warn(
        '\n⚠ Google did not return a refresh token. Revoke this app at\n' +
          '  https://myaccount.google.com/permissions\n' +
          '  and run `npm run auth` again.\n',
      );
    }
    saveTokens(tokens);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page('Gmail connected', 'You can close this tab and start the agent with <code>npm run dev</code>.'));
    console.log(`\n✓ Token saved to ${config.tokenPath}`);
    console.log('  Start the agent:  npm run dev\n');
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/html' });
    res.end(page('Token exchange failed', String(err)));
    console.error('\n✗ Token exchange failed:', err, '\n');
    server.close();
    process.exit(1);
  }
});

server.listen(port, () => {
  console.log('\nOpen this URL in the browser where you are signed in as');
  console.log(`${config.ownerEmail}:\n`);
  console.log(authUrl(client));
  console.log(`\nWaiting for the callback on ${config.google.redirectUri} ...\n`);
});
